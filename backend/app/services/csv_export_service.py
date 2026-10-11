import io
import csv
import datetime
from decimal import Decimal
from typing import Generator, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentStatus
from app.models.client import Client
from app.models.organization import Organization
from app.services.analytics_service import get_revenue_and_collection_trends


def sanitize_csv_value(val: Any) -> str:
    """
    Mitigates CSV / Spreadsheet Formula Injection (CWE-1236).
    If a string cell starts with '=', '+', '-', '@', '\t', or '\r',
    prepend a single quote "'" so spreadsheet programs treat it strictly as text.
    Numeric types (Decimal, int, float) are safely formatted without quotes.
    """
    if val is None:
        return ""
    if isinstance(val, (Decimal, int, float)):
        if isinstance(val, Decimal):
            return f"{val:.2f}"
        return str(val)
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.isoformat()

    s = str(val)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s


def export_invoices_csv(
    db: Session,
    organization_id: str,
    status_filter: Optional[str] = None,
) -> str:
    """Exports all filtered invoices for the organization as UTF-8 CSV."""
    output = io.StringIO()
    # Write UTF-8 BOM for Microsoft Excel compatibility
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Invoice Number",
        "Client Name",
        "Issue Date",
        "Due Date",
        "Currency",
        "Subtotal",
        "Discount Amount",
        "Tax Amount",
        "Total Amount",
        "Amount Paid",
        "Balance Due",
        "Status",
        "Created At",
    ]
    writer.writerow(headers)

    query = (
        db.query(Invoice, Client)
        .outerjoin(Client, Invoice.client_id == Client.id)
        .filter(Invoice.organization_id == organization_id)
    )
    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    invoices = query.order_by(desc(Invoice.issue_date), desc(Invoice.created_at)).all()

    for inv, client in invoices:
        writer.writerow([
            sanitize_csv_value(inv.invoice_number),
            sanitize_csv_value(client.name if client else "N/A"),
            sanitize_csv_value(inv.issue_date),
            sanitize_csv_value(inv.due_date),
            sanitize_csv_value(inv.currency),
            sanitize_csv_value(inv.subtotal),
            sanitize_csv_value(inv.discount_amount),
            sanitize_csv_value(inv.tax_amount),
            sanitize_csv_value(inv.total_amount),
            sanitize_csv_value(inv.amount_paid),
            sanitize_csv_value(inv.balance_due),
            sanitize_csv_value(inv.status.value if hasattr(inv.status, "value") else inv.status),
            sanitize_csv_value(inv.created_at.strftime("%Y-%m-%d %H:%M:%S") if inv.created_at else ""),
        ])

    return output.getvalue()


def export_payments_csv(
    db: Session,
    organization_id: str,
    status_filter: Optional[str] = None,
) -> str:
    """Exports all payments for the organization as UTF-8 CSV."""
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Payment Number",
        "Invoice Number",
        "Payment Date",
        "Method",
        "Amount",
        "Currency",
        "Status",
        "Manual / Verified",
        "Reference",
        "Notes",
        "Reversal Reason",
        "Created At",
    ]
    writer.writerow(headers)

    query = (
        db.query(Payment, Invoice)
        .outerjoin(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Payment.organization_id == organization_id)
    )
    if status_filter:
        query = query.filter(Payment.payment_status == status_filter)

    payments = query.order_by(desc(Payment.payment_date), desc(Payment.created_at)).all()

    for pay, inv in payments:
        writer.writerow([
            sanitize_csv_value(pay.payment_number or pay.id[:8]),
            sanitize_csv_value(inv.invoice_number if inv else "N/A"),
            sanitize_csv_value(pay.payment_date),
            sanitize_csv_value(pay.payment_method),
            sanitize_csv_value(pay.amount),
            sanitize_csv_value(pay.currency),
            sanitize_csv_value(pay.payment_status.value if hasattr(pay.payment_status, "value") else pay.payment_status),
            sanitize_csv_value("Manual" if pay.is_manual else "Gateway Verified"),
            sanitize_csv_value(pay.reference or ""),
            sanitize_csv_value(pay.notes or ""),
            sanitize_csv_value(pay.reversal_reason or ""),
            sanitize_csv_value(pay.created_at.strftime("%Y-%m-%d %H:%M:%S") if pay.created_at else ""),
        ])

    return output.getvalue()


def export_clients_csv(
    db: Session,
    organization_id: str,
) -> str:
    """Exports client directory for the organization as UTF-8 CSV."""
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Client Name",
        "Contact Person",
        "Email",
        "Phone",
        "Billing Address",
        "Country",
        "Tax ID",
        "Total Invoiced",
        "Outstanding Balance",
        "Archived Status",
        "Created At",
    ]
    writer.writerow(headers)

    clients = (
        db.query(Client)
        .filter(Client.organization_id == organization_id)
        .order_by(Client.name)
        .all()
    )

    invoices = (
        db.query(
            Invoice.client_id,
            func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")).label("total_invoiced"),
            func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")).label("total_balance"),
        )
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
        )
        .group_by(Invoice.client_id)
        .all()
    )
    inv_totals = {r.client_id: (r.total_invoiced, r.total_balance) for r in invoices}

    for c in clients:
        invoiced, balance = inv_totals.get(c.id, (Decimal("0.00"), Decimal("0.00")))
        writer.writerow([
            sanitize_csv_value(c.name),
            sanitize_csv_value(c.contact_name or ""),
            sanitize_csv_value(c.email or ""),
            sanitize_csv_value(c.phone or ""),
            sanitize_csv_value(c.billing_address or ""),
            sanitize_csv_value(c.country or ""),
            sanitize_csv_value(c.tax_id or ""),
            sanitize_csv_value(invoiced),
            sanitize_csv_value(balance),
            sanitize_csv_value("Archived" if c.is_archived else "Active"),
            sanitize_csv_value(c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else ""),
        ])

    return output.getvalue()


def export_receivables_csv(
    db: Session,
    organization_id: str,
    overdue_only: bool = False,
) -> str:
    """Exports open receivables or overdue invoices as UTF-8 CSV."""
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Invoice Number",
        "Client Name",
        "Client Email",
        "Issue Date",
        "Due Date",
        "Days Overdue",
        "Total Invoiced",
        "Amount Paid",
        "Balance Due",
        "Currency",
        "Status",
    ]
    writer.writerow(headers)

    today = datetime.date.today()
    query = (
        db.query(Invoice, Client)
        .join(Client, Invoice.client_id == Client.id)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]),
            Invoice.balance_due > Decimal("0.00"),
        )
    )

    if overdue_only:
        query = query.filter(Invoice.due_date < today)

    records = query.order_by(Invoice.due_date).all()

    for inv, client in records:
        days_od = (today - inv.due_date).days if (inv.due_date and inv.due_date < today) else 0
        writer.writerow([
            sanitize_csv_value(inv.invoice_number),
            sanitize_csv_value(client.name),
            sanitize_csv_value(client.email or ""),
            sanitize_csv_value(inv.issue_date),
            sanitize_csv_value(inv.due_date),
            sanitize_csv_value(days_od),
            sanitize_csv_value(inv.total_amount),
            sanitize_csv_value(inv.amount_paid),
            sanitize_csv_value(inv.balance_due),
            sanitize_csv_value(inv.currency),
            sanitize_csv_value("overdue" if days_od > 0 else inv.status.value),
        ])

    return output.getvalue()


def export_monthly_summary_csv(
    db: Session,
    organization_id: str,
) -> str:
    """Exports 12-month financial operational summary as UTF-8 CSV."""
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Month Period",
        "Month Label",
        "Invoiced Amount",
        "Payments Collected",
        "Net Cashflow",
        "Invoices Count",
        "Payments Count",
    ]
    writer.writerow(headers)

    trends = get_revenue_and_collection_trends(db=db, organization_id=organization_id, months_count=12)

    for item in trends.items:
        writer.writerow([
            sanitize_csv_value(item.period),
            sanitize_csv_value(item.period_label),
            sanitize_csv_value(item.invoiced_amount),
            sanitize_csv_value(item.collected_amount),
            sanitize_csv_value(item.net_difference),
            sanitize_csv_value(item.invoice_count),
            sanitize_csv_value(item.payment_count),
        ])

    return output.getvalue()
