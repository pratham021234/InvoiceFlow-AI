import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.invoice import Invoice, InvoiceStatus
from app.models.client import Client
from app.models.reminder import EmailLog, EmailType, EmailStatus
from app.models.base import utc_now
from app.services.email_service import send_payment_reminder_email, EmailConfigurationError


# Default reminder milestone rules (days relative to due date)
# Negative values mean days before due date, positive mean days overdue
DEFAULT_REMINDER_RULES = [
    {"rule_name": "upcoming_3d", "days_offset": -3, "description": "3 days before due date"},
    {"rule_name": "due_today", "days_offset": 0, "description": "On due date"},
    {"rule_name": "overdue_3d", "days_offset": 3, "description": "3 days overdue"},
    {"rule_name": "overdue_7d", "days_offset": 7, "description": "7 days overdue"},
    {"rule_name": "overdue_14d", "days_offset": 14, "description": "14 days overdue"},
    {"rule_name": "overdue_30d", "days_offset": 30, "description": "30 days overdue"},
]

MAX_RETRIES = 3


def get_applicable_reminder_rules(invoice: Invoice, today: Optional[datetime.date] = None) -> List[Dict[str, Any]]:
    """
    Determines which reminder rules apply to the invoice on the given date.
    """
    if today is None:
        today = datetime.date.today()

    if not invoice.due_date:
        return []

    # Calculate days offset: today - due_date
    # e.g., if due_date is in 3 days: today - due_date = -3
    # if due_date was 7 days ago: today - due_date = +7
    days_from_due = (today - invoice.due_date).days

    applicable = []
    for rule in DEFAULT_REMINDER_RULES:
        if days_from_due == rule["days_offset"]:
            applicable.append(rule)

    return applicable


def process_scheduled_reminders(
    db: Session,
    organization_id: Optional[str] = None,
    evaluation_date: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """
    Evaluates all active invoices across organizations (or a single organization)
    and delivers due payment reminders with idempotent de-duplication.

    Safety controls:
    - Strictly excludes DRAFT, CANCELLED, and PAID invoices.
    - Strictly excludes invoices where balance_due <= 0.
    - Enforces idempotency per rule and due date.
    - Limits retries on transient failures.
    - Handles concurrent workers gracefully via atomic idempotency keys.
    """
    if evaluation_date is None:
        evaluation_date = datetime.date.today()

    query = (
        db.query(Invoice)
        .join(Client, Invoice.client_id == Client.id)
        .filter(
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]),
            Invoice.balance_due > 0,
            Client.email.isnot(None),
            Client.email != "",
        )
    )

    if organization_id:
        query = query.filter(Invoice.organization_id == organization_id)

    eligible_invoices = query.all()

    total_evaluated = len(eligible_invoices)
    sent_count = 0
    skipped_count = 0
    failed_count = 0
    results: List[Dict[str, Any]] = []

    for invoice in eligible_invoices:
        # Check current balance invariant
        if invoice.balance_due <= 0:
            skipped_count += 1
            continue

        applicable_rules = get_applicable_reminder_rules(invoice, today=evaluation_date)
        if not applicable_rules:
            skipped_count += 1
            continue

        for rule in applicable_rules:
            rule_name = rule["rule_name"]
            idempotency_key = f"reminder:{invoice.id}:{rule_name}:{invoice.due_date}"

            # Check if already successfully delivered or reached max retries
            existing_log = (
                db.query(EmailLog)
                .filter(
                    EmailLog.organization_id == invoice.organization_id,
                    EmailLog.idempotency_key == idempotency_key,
                )
                .first()
            )

            if existing_log:
                if existing_log.delivery_status == EmailStatus.ACCEPTED_BY_PROVIDER:
                    # Already successfully sent
                    skipped_count += 1
                    continue
                if existing_log.attempt_count >= MAX_RETRIES:
                    # Exceeded maximum retry attempts
                    skipped_count += 1
                    continue

            # Attempt delivery
            try:
                log_entry = send_payment_reminder_email(
                    db=db,
                    organization_id=invoice.organization_id,
                    invoice_id=invoice.id,
                    user_id=None,
                    idempotency_key=idempotency_key,
                )
                if log_entry.delivery_status == EmailStatus.ACCEPTED_BY_PROVIDER:
                    sent_count += 1
                    results.append({
                        "invoice_id": invoice.id,
                        "invoice_number": invoice.invoice_number,
                        "rule": rule_name,
                        "status": "sent",
                        "provider_message_id": log_entry.provider_message_id,
                    })
                else:
                    failed_count += 1
                    results.append({
                        "invoice_id": invoice.id,
                        "invoice_number": invoice.invoice_number,
                        "rule": rule_name,
                        "status": "failed",
                        "error": log_entry.error_message,
                    })
            except EmailConfigurationError as config_err:
                failed_count += 1
                results.append({
                    "invoice_id": invoice.id,
                    "invoice_number": invoice.invoice_number,
                    "rule": rule_name,
                    "status": "config_error",
                    "error": str(config_err),
                })
            except Exception as exc:
                failed_count += 1
                results.append({
                    "invoice_id": invoice.id,
                    "invoice_number": invoice.invoice_number,
                    "rule": rule_name,
                    "status": "error",
                    "error": str(exc),
                })

    return {
        "evaluation_date": evaluation_date.isoformat(),
        "total_evaluated": total_evaluated,
        "sent": sent_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "results": results,
    }
