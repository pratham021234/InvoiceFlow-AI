import secrets
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus, generate_public_token
from app.models.organization import Organization
from app.models.client import Client
from app.models.base import utc_now
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceItemCreate
from app.core.decimal_utils import calculate_line_item, quantize_money
from app.services.audit_service import log_security_event


def compute_effective_status(invoice: Invoice) -> InvoiceStatus:
    """Computes dynamic status taking due dates and balances into account."""
    if invoice.status == InvoiceStatus.CANCELLED:
        return InvoiceStatus.CANCELLED
    if invoice.status == InvoiceStatus.DRAFT:
        return InvoiceStatus.DRAFT

    # Settle status
    if invoice.balance_due <= Decimal("0.00") and invoice.total_amount > Decimal("0.00"):
        return InvoiceStatus.PAID

    # Overdue status
    today = date.today()
    if invoice.due_date < today and invoice.balance_due > Decimal("0.00"):
        return InvoiceStatus.OVERDUE

    # Partially paid status
    if invoice.amount_paid > Decimal("0.00") and invoice.balance_due > Decimal("0.00"):
        return InvoiceStatus.PARTIALLY_PAID

    return invoice.status


def generate_next_invoice_number(db: Session, organization_id: str) -> str:
    """
    Safely generates a unique, sequential invoice number for the organization.
    Uses database row locking to prevent race conditions during concurrent issuance.
    """
    is_sqlite = db.bind.dialect.name == "sqlite"
    query = db.query(Organization).filter(Organization.id == organization_id)
    if not is_sqlite:
        query = query.with_for_update()

    org = query.first()
    if not org:
        raise ValueError("Organization not found.")

    prefix = (org.invoice_prefix or "INV").strip().upper()
    current_num_str = org.next_invoice_number or "1001"

    try:
        current_seq = int(current_num_str)
    except ValueError:
        current_seq = 1001

    candidate_number = f"{prefix}-{current_seq}"

    # Guard against collision in case a number was manually set or previously used
    while db.query(Invoice).filter(
        Invoice.organization_id == organization_id,
        Invoice.invoice_number == candidate_number,
    ).first() is not None:
        current_seq += 1
        candidate_number = f"{prefix}-{current_seq}"

    # Update organization next invoice sequence
    org.next_invoice_number = str(current_seq + 1)
    db.flush()

    return candidate_number


def calculate_items_and_totals(items_in: List[InvoiceItemCreate]) -> Tuple[List[Dict[str, Any]], Decimal, Decimal, Decimal, Decimal]:
    """Calculates all line items and aggregates totals on the backend."""
    calculated_items = []
    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_tax = Decimal("0.00")

    for idx, item in enumerate(items_in):
        calc = calculate_line_item(
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_percent=item.discount_percent,
            tax_rate=item.tax_rate,
        )
        calculated_items.append({
            "description": item.description.strip(),
            "quantity": calc["quantity"],
            "unit_price": calc["unit_price"],
            "discount_percent": calc["discount_percent"],
            "tax_rate": calc["tax_rate"],
            "line_subtotal": calc["line_subtotal"],
            "line_discount": calc["line_discount"],
            "line_tax": calc["line_tax"],
            "line_total": calc["line_total"],
            "display_order": item.display_order if item.display_order > 0 else idx,
        })
        subtotal += calc["line_subtotal"]
        total_discount += calc["line_discount"]
        total_tax += calc["line_tax"]

    subtotal = quantize_money(subtotal)
    total_discount = quantize_money(total_discount)
    total_tax = quantize_money(total_tax)
    total_amount = quantize_money(max(Decimal("0.00"), subtotal - total_discount) + total_tax)

    return calculated_items, subtotal, total_discount, total_tax, total_amount


def create_invoice(
    db: Session,
    organization_id: str,
    user_id: str,
    invoice_in: InvoiceCreate,
) -> Invoice:
    """Creates a new invoice in DRAFT status with server-calculated financial totals."""
    # Validate client belongs to the active organization
    client = (
        db.query(Client)
        .filter(Client.id == invoice_in.client_id, Client.organization_id == organization_id)
        .first()
    )
    if not client:
        raise ValueError("Selected client does not exist or does not belong to this organization.")

    calc_items, subtotal, discount_amount, tax_amount, total_amount = calculate_items_and_totals(invoice_in.items)

    # Initial draft temporary number
    draft_number = f"DRAFT-{secrets.token_hex(4).upper()}"

    invoice = Invoice(
        organization_id=organization_id,
        client_id=client.id,
        invoice_number=draft_number,
        status=InvoiceStatus.DRAFT,
        issue_date=invoice_in.issue_date,
        due_date=invoice_in.due_date,
        currency=invoice_in.currency.upper(),
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        amount_paid=Decimal("0.00"),
        balance_due=total_amount,
        notes=invoice_in.notes,
        payment_terms=invoice_in.payment_terms,
        public_token=generate_public_token(),
        public_token_active=True,
    )
    db.add(invoice)
    db.flush()

    for item_data in calc_items:
        inv_item = InvoiceItem(
            invoice_id=invoice.id,
            **item_data
        )
        db.add(inv_item)

    db.commit()
    db.refresh(invoice)

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="invoice_created",
        entity_type="invoice",
        entity_id=invoice.id,
        user_id=user_id,
        details={"status": invoice.status.value, "total_amount": str(invoice.total_amount)},
    )

    return invoice


def update_draft_invoice(
    db: Session,
    organization_id: str,
    user_id: str,
    invoice_id: str,
    invoice_update: InvoiceUpdate,
) -> Invoice:
    """Updates an invoice strictly if it is still in DRAFT status."""
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not invoice:
        raise LookupError("Invoice not found.")

    if invoice.status != InvoiceStatus.DRAFT:
        raise PermissionError("Cannot modify an issued invoice. Cancel or duplicate the invoice instead.")

    if invoice_update.client_id:
        client = (
            db.query(Client)
            .filter(Client.id == invoice_update.client_id, Client.organization_id == organization_id)
            .first()
        )
        if not client:
            raise ValueError("Selected client does not belong to this organization.")
        invoice.client_id = client.id

    if invoice_update.issue_date:
        invoice.issue_date = invoice_update.issue_date
    if invoice_update.due_date:
        invoice.due_date = invoice_update.due_date
    if invoice_update.currency:
        invoice.currency = invoice_update.currency.upper()
    if invoice_update.notes is not None:
        invoice.notes = invoice_update.notes
    if invoice_update.payment_terms is not None:
        invoice.payment_terms = invoice_update.payment_terms

    if invoice_update.items is not None:
        calc_items, subtotal, discount_amount, tax_amount, total_amount = calculate_items_and_totals(invoice_update.items)
        invoice.subtotal = subtotal
        invoice.discount_amount = discount_amount
        invoice.tax_amount = tax_amount
        invoice.total_amount = total_amount
        invoice.balance_due = quantize_money(total_amount - invoice.amount_paid)

        # Clear existing items and replace with new calculations
        db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).delete()
        for item_data in calc_items:
            inv_item = InvoiceItem(invoice_id=invoice.id, **item_data)
            db.add(inv_item)

    db.commit()
    db.refresh(invoice)

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="invoice_updated",
        entity_type="invoice",
        entity_id=invoice.id,
        user_id=user_id,
    )
    return invoice


def issue_invoice(
    db: Session,
    organization_id: str,
    user_id: str,
    invoice_id: str,
) -> Invoice:
    """Officially issues an invoice, assigning a sequential organization invoice number."""
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not invoice:
        raise LookupError("Invoice not found.")

    if invoice.status != InvoiceStatus.DRAFT:
        return invoice

    # Atomically acquire unique invoice number
    official_number = generate_next_invoice_number(db, organization_id)

    invoice.invoice_number = official_number
    invoice.status = InvoiceStatus.ISSUED
    invoice.issued_at = utc_now()

    db.commit()
    db.refresh(invoice)

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="invoice_issued",
        entity_type="invoice",
        entity_id=invoice.id,
        user_id=user_id,
        details={"invoice_number": official_number, "total_amount": str(invoice.total_amount)},
    )
    return invoice


def cancel_invoice(
    db: Session,
    organization_id: str,
    user_id: str,
    invoice_id: str,
    reason: str,
) -> Invoice:
    """Cancels an invoice with an auditable reason."""
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not invoice:
        raise LookupError("Invoice not found.")

    if invoice.status == InvoiceStatus.CANCELLED:
        return invoice

    invoice.status = InvoiceStatus.CANCELLED
    invoice.cancellation_reason = reason.strip()

    db.commit()
    db.refresh(invoice)

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="invoice_cancelled",
        entity_type="invoice",
        entity_id=invoice.id,
        user_id=user_id,
        details={"reason": reason},
    )
    return invoice


def duplicate_invoice(
    db: Session,
    organization_id: str,
    user_id: str,
    invoice_id: str,
) -> Invoice:
    """Duplicates an invoice into a fresh DRAFT invoice."""
    source = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not source:
        raise LookupError("Source invoice not found.")

    items_create = [
        InvoiceItemCreate(
            description=it.description,
            quantity=it.quantity,
            unit_price=it.unit_price,
            discount_percent=it.discount_percent,
            tax_rate=it.tax_rate,
            display_order=it.display_order,
        )
        for it in source.items
    ]

    create_payload = InvoiceCreate(
        client_id=source.client_id,
        issue_date=date.today(),
        due_date=source.due_date,
        currency=source.currency,
        notes=source.notes,
        payment_terms=source.payment_terms,
        items=items_create,
    )

    return create_invoice(db, organization_id, user_id, create_payload)


def delete_draft_invoice(
    db: Session,
    organization_id: str,
    user_id: str,
    invoice_id: str,
) -> None:
    """Deletes an invoice strictly if it is still a DRAFT. Issued invoices cannot be deleted."""
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not invoice:
        raise LookupError("Invoice not found.")

    if invoice.status != InvoiceStatus.DRAFT:
        raise PermissionError("Only draft invoices can be deleted. Issued invoices must be cancelled.")

    db.delete(invoice)
    db.commit()

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="invoice_draft_deleted",
        entity_type="invoice",
        entity_id=invoice_id,
        user_id=user_id,
    )


def get_invoices(
    db: Session,
    organization_id: str,
    status: Optional[str] = None,
    client_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Invoice], int]:
    """Retrieves paginated and filtered invoices scoped to the organization."""
    query = db.query(Invoice).filter(Invoice.organization_id == organization_id)

    if status:
        query = query.filter(Invoice.status == status)

    if client_id:
        query = query.filter(Invoice.client_id == client_id)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.join(Client).filter(
            or_(
                Invoice.invoice_number.ilike(search_pattern),
                Client.name.ilike(search_pattern),
            )
        )

    total = query.count()
    invoices = query.order_by(desc(Invoice.created_at)).offset(skip).limit(limit).all()
    return invoices, total


def get_invoice_by_id(db: Session, organization_id: str, invoice_id: str) -> Optional[Invoice]:
    """Fetch invoice strictly scoped by organization ID."""
    return (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
