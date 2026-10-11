import datetime
from decimal import Decimal
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.invoice import Invoice, InvoiceStatus
from app.models.client import Client
from app.models.reminder import EmailLog, EmailType, EmailStatus
from app.models.payment import Payment, PaymentStatus
from app.schemas.receivables import AgingBracketSummary, ReceivablesInvoiceItem, ReceivablesSummaryResponse
from app.services.invoice_service import compute_effective_status
from app.core.decimal_utils import quantize_money


def compute_days_overdue(due_date: Optional[datetime.date], balance_due: Decimal, status: InvoiceStatus, today: Optional[datetime.date] = None) -> int:
    """
    Computes days overdue consistently.
    Paid, draft, or cancelled invoices, or invoices with zero balance, are never overdue.
    """
    if today is None:
        today = datetime.date.today()

    if status in (InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID):
        return 0

    if balance_due <= Decimal("0.00"):
        return 0

    if not due_date or due_date >= today:
        return 0

    return (today - due_date).days


def categorize_aging_bracket(days_overdue: int) -> Tuple[str, str]:
    """
    Categorizes overdue days into standard accounting aging brackets:
    - Current (not yet overdue)
    - 1-7 days
    - 8-30 days
    - 31-60 days
    - 60+ days
    """
    if days_overdue <= 0:
        return "current", "Current (Not Overdue)"
    elif 1 <= days_overdue <= 7:
        return "1_7_days", "1 - 7 Days"
    elif 8 <= days_overdue <= 30:
        return "8_30_days", "8 - 30 Days"
    elif 31 <= days_overdue <= 60:
        return "31_60_days", "31 - 60 Days"
    else:
        return "over_60_days", "60+ Days"


def get_receivables_summary(
    db: Session,
    organization_id: str,
    status_filter: Optional[str] = None,
    client_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    aging_bracket: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> ReceivablesSummaryResponse:
    """
    Produces authoritative Accounts Receivable summary with aging breakdown,
    metrics, and filtered invoice list.
    """
    today = datetime.date.today()

    # 1. Base query for organization invoices (excluding draft and cancelled)
    base_query = (
        db.query(Invoice, Client)
        .join(Client, Invoice.client_id == Client.id)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
        )
    )

    # Calculate overall aggregate metrics for this organization
    all_open = (
        db.query(
            func.sum(Invoice.balance_due).label("total_receivables"),
            func.sum(Invoice.amount_paid).label("total_collected"),
            func.count(Invoice.id).label("total_count"),
        )
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
        )
        .first()
    )

    total_receivables = quantize_money(all_open.total_receivables or Decimal("0.00"))
    total_collected = quantize_money(all_open.total_collected or Decimal("0.00"))

    # Fetch all active open invoices to compute aging brackets accurately
    all_eligible_invoices = base_query.all()

    bracket_counts: Dict[str, Dict[str, Any]] = {
        "current": {"label": "Current", "total": Decimal("0.00"), "count": 0},
        "1_7_days": {"label": "1 - 7 Days", "total": Decimal("0.00"), "count": 0},
        "8_30_days": {"label": "8 - 30 Days", "total": Decimal("0.00"), "count": 0},
        "31_60_days": {"label": "31 - 60 Days", "total": Decimal("0.00"), "count": 0},
        "over_60_days": {"label": "60+ Days", "total": Decimal("0.00"), "count": 0},
    }

    total_overdue = Decimal("0.00")
    total_open_invoices = 0
    total_overdue_invoices = 0

    # Build map of latest reminder dates per invoice
    reminder_logs = (
        db.query(EmailLog.invoice_id, func.max(EmailLog.sent_at).label("latest_reminder"))
        .filter(
            EmailLog.organization_id == organization_id,
            EmailLog.notification_type == EmailType.PAYMENT_REMINDER,
            EmailLog.delivery_status == EmailStatus.ACCEPTED_BY_PROVIDER,
        )
        .group_by(EmailLog.invoice_id)
        .all()
    )
    reminder_map = {row.invoice_id: row.latest_reminder for row in reminder_logs if row.invoice_id}

    processed_items: List[ReceivablesInvoiceItem] = []

    for invoice, client in all_eligible_invoices:
        days_od = compute_days_overdue(invoice.due_date, invoice.balance_due, invoice.status, today=today)
        bracket_key, bracket_label = categorize_aging_bracket(days_od)

        if invoice.balance_due > Decimal("0.00"):
            total_open_invoices += 1
            bracket_counts[bracket_key]["total"] += invoice.balance_due
            bracket_counts[bracket_key]["count"] += 1

            if days_od > 0:
                total_overdue += invoice.balance_due
                total_overdue_invoices += 1

        eff_status = compute_effective_status(invoice)

        item = ReceivablesInvoiceItem(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            client_id=client.id,
            client_name=client.name,
            issue_date=invoice.issue_date,
            due_date=invoice.due_date,
            currency=invoice.currency,
            total_amount=quantize_money(invoice.total_amount),
            amount_paid=quantize_money(invoice.amount_paid),
            balance_due=quantize_money(invoice.balance_due),
            status=invoice.status.value,
            effective_status=eff_status.value,
            days_overdue=days_od,
            aging_bracket=bracket_key,
            latest_reminder_date=reminder_map.get(invoice.id),
        )
        processed_items.append(item)

    # Apply in-memory or query filters for presentation
    filtered_items = processed_items

    if status_filter:
        if status_filter == "overdue":
            filtered_items = [i for i in filtered_items if i.effective_status == "overdue"]
        elif status_filter == "due_soon":
            # Due in the next 7 days and balance > 0
            filtered_items = [
                i for i in filtered_items
                if i.balance_due > 0 and 0 <= (i.due_date - today).days <= 7
            ]
        elif status_filter == "partially_paid":
            filtered_items = [i for i in filtered_items if i.status == "partially_paid"]
        elif status_filter == "paid":
            filtered_items = [i for i in filtered_items if i.status == "paid"]
        else:
            filtered_items = [i for i in filtered_items if i.status == status_filter or i.effective_status == status_filter]

    if client_id:
        filtered_items = [i for i in filtered_items if i.client_id == client_id]

    if search:
        search_lower = search.lower().strip()
        filtered_items = [
            i for i in filtered_items
            if search_lower in i.invoice_number.lower() or search_lower in i.client_name.lower()
        ]

    if start_date:
        filtered_items = [i for i in filtered_items if i.issue_date >= start_date]

    if end_date:
        filtered_items = [i for i in filtered_items if i.issue_date <= end_date]

    if aging_bracket:
        filtered_items = [i for i in filtered_items if i.aging_bracket == aging_bracket]

    # Sort: overdue days descending, then due date ascending
    filtered_items.sort(key=lambda x: (x.days_overdue, -x.balance_due), reverse=True)

    paginated_items = filtered_items[skip : skip + limit]

    brackets_list = [
        AgingBracketSummary(
            bracket=k,
            label=v["label"],
            total_balance=quantize_money(v["total"]),
            invoice_count=v["count"],
        )
        for k, v in bracket_counts.items()
    ]

    return ReceivablesSummaryResponse(
        total_receivables=quantize_money(total_receivables),
        total_overdue=quantize_money(total_overdue),
        total_collected=quantize_money(total_collected),
        total_open_invoices=total_open_invoices,
        total_overdue_invoices=total_overdue_invoices,
        brackets=brackets_list,
        invoices=paginated_items,
        total=len(filtered_items),
        skip=skip,
        limit=limit,
    )
