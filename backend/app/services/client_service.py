from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceStatus
from app.schemas.client import ClientCreate, ClientUpdate


def get_clients(
    db: Session,
    organization_id: str,
    search: Optional[str] = None,
    is_archived: Optional[bool] = False,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Client], int]:
    """Returns paginated clients filtered by organization and optional search term."""
    query = db.query(Client).filter(Client.organization_id == organization_id)

    if is_archived is not None:
        query = query.filter(Client.is_archived == is_archived)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Client.name.ilike(search_pattern),
                Client.contact_name.ilike(search_pattern),
                Client.email.ilike(search_pattern),
            )
        )

    total = query.count()
    clients = query.order_by(Client.name.asc()).offset(skip).limit(limit).all()
    return clients, total


def get_client_by_id(db: Session, organization_id: str, client_id: str) -> Optional[Client]:
    """Fetch client strictly scoped by organization ID."""
    return (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.organization_id == organization_id,
        )
        .first()
    )


def create_client(db: Session, organization_id: str, client_in: ClientCreate) -> Client:
    """Create a new client within the specified organization."""
    client = Client(
        organization_id=organization_id,
        name=client_in.name.strip(),
        contact_name=client_in.contact_name.strip() if client_in.contact_name else None,
        email=client_in.email.strip().lower() if client_in.email else None,
        phone=client_in.phone.strip() if client_in.phone else None,
        billing_address=client_in.billing_address,
        country=client_in.country,
        tax_id=client_in.tax_id.strip() if client_in.tax_id else None,
        currency=client_in.currency.upper(),
        notes=client_in.notes,
        is_archived=False,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(
    db: Session,
    organization_id: str,
    client_id: str,
    client_update: ClientUpdate,
) -> Optional[Client]:
    """Update client fields within the specified organization."""
    client = get_client_by_id(db, organization_id, client_id)
    if not client:
        return None

    update_data = client_update.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"]:
        update_data["email"] = update_data["email"].strip().lower()
    if "currency" in update_data and update_data["currency"]:
        update_data["currency"] = update_data["currency"].upper()

    for field, value in update_data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client


def archive_client(db: Session, organization_id: str, client_id: str) -> Optional[Client]:
    """Soft-archive client, preserving historical invoices."""
    client = get_client_by_id(db, organization_id, client_id)
    if not client:
        return None
    client.is_archived = True
    db.commit()
    db.refresh(client)
    return client


def restore_client(db: Session, organization_id: str, client_id: str) -> Optional[Client]:
    """Restore previously archived client."""
    client = get_client_by_id(db, organization_id, client_id)
    if not client:
        return None
    client.is_archived = False
    db.commit()
    db.refresh(client)
    return client


def get_client_financial_aggregates(db: Session, organization_id: str, client_id: str) -> Dict[str, Any]:
    """Calculate client totals directly from database records."""
    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.client_id == client_id,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
        .all()
    )

    total_invoiced = sum((inv.total_amount for inv in invoices if inv.status != InvoiceStatus.DRAFT), Decimal("0.00"))
    total_paid = sum((inv.amount_paid for inv in invoices), Decimal("0.00"))
    balance_due = sum((inv.balance_due for inv in invoices if inv.status != InvoiceStatus.DRAFT), Decimal("0.00"))

    return {
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "balance_due": balance_due,
        "invoice_count": len(invoices),
    }
