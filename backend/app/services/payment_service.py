from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.invoice import Invoice, InvoiceStatus
from app.models.base import utc_now
from app.schemas.payment import PaymentCreate
from app.core.decimal_utils import quantize_money
from app.services.audit_service import log_security_event


class PaymentDomainError(ValueError):
    """Raised when payment business domain invariants are violated."""
    pass


def record_payment(
    db: Session,
    organization_id: str,
    user_id: str,
    payment_in: Optional[PaymentCreate] = None,
    invoice_id: Optional[str] = None,
    amount: Optional[Decimal] = None,
    payment_date: Optional[date] = None,
    payment_method: str = "bank_transfer",
    reference: Optional[str] = None,
    notes: Optional[str] = None,
    is_manual: bool = True,
    idempotency_key: Optional[str] = None,
) -> Payment:
    """
    Atomically records a payment against an issued invoice and recalculates invoice balances.
    Enforces overpayment prevention, positive amounts, currency matching, and idempotency.
    """
    if payment_in is not None:
        invoice_id = payment_in.invoice_id
        amount = payment_in.amount
        payment_date = payment_in.payment_date
        payment_method = payment_in.payment_method
        reference = payment_in.reference
        notes = payment_in.notes
        is_manual = payment_in.is_manual
        idempotency_key = payment_in.idempotency_key

    # 1. Idempotency check
    if idempotency_key:
        existing = (
            db.query(Payment)
            .filter(
                Payment.organization_id == organization_id,
                Payment.idempotency_key == idempotency_key,
            )
            .first()
        )
        if existing:
            return existing

    # 2. Amount validation
    if amount is None or quantize_money(amount) <= Decimal("0.00"):
        raise PaymentDomainError("Payment amount must be greater than zero.")
    amount = quantize_money(amount)

    if not payment_date:
        payment_date = date.today()

    # 3. Lock invoice for update
    is_sqlite = db.bind.dialect.name == "sqlite"
    query = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.organization_id == organization_id,
    )
    if not is_sqlite:
        query = query.with_for_update()

    invoice = query.first()
    if not invoice:
        raise LookupError("Invoice not found or does not belong to this organization.")

    # 4. Status eligibility check
    if invoice.status in (InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED):
        raise PaymentDomainError(f"Cannot record payments against invoice in '{invoice.status.value}' status.")


    # 5. Overpayment prevention
    # Sum all current valid completed payments
    completed_payments = (
        db.query(Payment)
        .filter(
            Payment.invoice_id == invoice.id,
            Payment.payment_status == PaymentStatus.COMPLETED,
        )
        .all()
    )
    current_paid = quantize_money(sum((p.amount for p in completed_payments), Decimal("0.00")))
    remaining_balance = quantize_money(max(Decimal("0.00"), invoice.total_amount - current_paid))

    if amount > remaining_balance:
        raise PaymentDomainError(
            f"Payment amount of {invoice.currency} {amount} exceeds remaining balance due of {invoice.currency} {remaining_balance}."
        )

    # 6. Generate payment reference / number
    payment_count = len(completed_payments) + 1
    payment_number = f"PAY-{invoice.invoice_number}-{payment_count:02d}"

    # 7. Create Payment record
    payment = Payment(
        organization_id=organization_id,
        invoice_id=invoice.id,
        payment_number=payment_number,
        amount=amount,
        currency=invoice.currency,
        payment_date=payment_date,
        payment_method=payment_method,
        reference=reference.strip() if reference else None,
        notes=notes.strip() if notes else None,
        payment_status=PaymentStatus.COMPLETED,
        is_manual=is_manual,
        created_by_user_id=user_id,
        idempotency_key=idempotency_key,
    )
    db.add(payment)

    # 8. Recalculate Invoice balance and status
    new_paid = quantize_money(current_paid + amount)
    new_balance = quantize_money(max(Decimal("0.00"), invoice.total_amount - new_paid))

    invoice.amount_paid = new_paid
    invoice.balance_due = new_balance

    if new_balance <= Decimal("0.00"):
        invoice.status = InvoiceStatus.PAID
    else:
        invoice.status = InvoiceStatus.PARTIALLY_PAID

    db.commit()
    db.refresh(payment)
    db.refresh(invoice)

    # 9. Audit trail
    log_security_event(
        db=db,
        organization_id=organization_id,
        action="payment_recorded",
        entity_type="payment",
        entity_id=payment.id,
        user_id=user_id,
        details={
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "amount": str(payment.amount),
            "currency": payment.currency,
            "new_balance_due": str(invoice.balance_due),
            "new_invoice_status": invoice.status.value,
        },
    )

    return payment


def reverse_payment(
    db: Session,
    organization_id: str,
    user_id: str,
    payment_id: str,
    reason: str,
) -> Payment:
    """
    Reverses an existing completed payment with an auditable reason and recalculates invoice balances.
    """
    if not reason or not reason.strip():
        raise PaymentDomainError("A valid reason is required to reverse a payment.")

    is_sqlite = db.bind.dialect.name == "sqlite"
    query = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.organization_id == organization_id,
    )
    if not is_sqlite:
        query = query.with_for_update()

    payment = query.first()
    if not payment:
        raise LookupError("Payment not found or does not belong to this organization.")

    if payment.payment_status != PaymentStatus.COMPLETED:
        raise PaymentDomainError(f"Cannot reverse a payment with status '{payment.payment_status.value}'.")

    # Mark payment as reversed
    payment.payment_status = PaymentStatus.REVERSED
    payment.reversal_reason = reason.strip()
    payment.reversed_at = utc_now()
    payment.reversed_by_user_id = user_id

    # Lock invoice and recalculate balances
    inv_query = db.query(Invoice).filter(
        Invoice.id == payment.invoice_id,
        Invoice.organization_id == organization_id,
    )
    if not is_sqlite:
        inv_query = inv_query.with_for_update()

    invoice = inv_query.first()
    if invoice:
        remaining_completed = (
            db.query(Payment)
            .filter(
                Payment.invoice_id == invoice.id,
                Payment.payment_status == PaymentStatus.COMPLETED,
                Payment.id != payment.id,
            )
            .all()
        )
        new_paid = quantize_money(sum((p.amount for p in remaining_completed), Decimal("0.00")))
        new_balance = quantize_money(max(Decimal("0.00"), invoice.total_amount - new_paid))

        invoice.amount_paid = new_paid
        invoice.balance_due = new_balance

        if new_balance <= Decimal("0.00") and invoice.total_amount > Decimal("0.00"):
            invoice.status = InvoiceStatus.PAID
        elif new_paid > Decimal("0.00"):
            invoice.status = InvoiceStatus.PARTIALLY_PAID
        else:
            invoice.status = InvoiceStatus.ISSUED

    db.commit()
    db.refresh(payment)
    if invoice:
        db.refresh(invoice)

    # Audit trail
    log_security_event(
        db=db,
        organization_id=organization_id,
        action="payment_reversed",
        entity_type="payment",
        entity_id=payment.id,
        user_id=user_id,
        details={
            "invoice_id": payment.invoice_id,
            "reversal_reason": payment.reversal_reason,
            "amount_reversed": str(payment.amount),
            "new_balance_due": str(invoice.balance_due) if invoice else None,
        },
    )

    return payment


def get_payment_by_id(
    db: Session,
    organization_id: str,
    payment_id: str,
) -> Optional[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.id == payment_id, Payment.organization_id == organization_id)
        .first()
    )


def get_payments(
    db: Session,
    organization_id: str,
    invoice_id: Optional[str] = None,
    payment_status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[Payment], int]:
    query = db.query(Payment).filter(Payment.organization_id == organization_id)

    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    if payment_status:
        query = query.filter(Payment.payment_status == payment_status)
    if payment_method:
        query = query.filter(Payment.payment_method == payment_method)
    if date_from:
        query = query.filter(Payment.payment_date >= date_from)
    if date_to:
        query = query.filter(Payment.payment_date <= date_to)

    total = query.count()
    items = query.order_by(desc(Payment.payment_date), desc(Payment.created_at)).offset(skip).limit(limit).all()
    return items, total


def list_payments(
    db: Session,
    organization_id: str,
    invoice_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[Payment], int]:
    return get_payments(
        db=db,
        organization_id=organization_id,
        invoice_id=invoice_id,
        payment_status=status,
        payment_method=payment_method,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )

