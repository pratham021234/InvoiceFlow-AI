import datetime
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentStatus
from app.models.client import Client
from app.models.organization import Organization
from app.core.decimal_utils import quantize_money
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    MomChangeMetric,
    MonthlyTrendItem,
    RevenueTrendsResponse,
    AgingBracketMetric,
    AgingAnalyticsResponse,
    StatusDistributionItem,
    StatusDistributionResponse,
    ClientPerformanceItem,
    ClientPerformanceResponse,
)


def resolve_date_range(
    preset: Optional[str] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    today: Optional[datetime.date] = None,
) -> Tuple[datetime.date, datetime.date]:
    """
    Resolves standard analytics date boundaries.
    Defaults to last 30 days if unspecified.
    """
    if today is None:
        today = datetime.date.today()

    if start_date and end_date:
        return start_date, end_date

    preset = (preset or "30d").lower().strip()
    if preset == "30d":
        return today - datetime.timedelta(days=30), today
    elif preset == "90d":
        return today - datetime.timedelta(days=90), today
    elif preset == "current_month":
        first_day = today.replace(day=1)
        return first_day, today
    elif preset == "last_month":
        first_of_this_month = today.replace(day=1)
        last_day_prev_month = first_of_this_month - datetime.timedelta(days=1)
        first_day_prev_month = last_day_prev_month.replace(day=1)
        return first_day_prev_month, last_day_prev_month
    elif preset == "current_year":
        first_day_year = today.replace(month=1, day=1)
        return first_day_year, today
    elif preset == "all":
        return today.replace(year=today.year - 5, month=1, day=1), today
    else:
        # Default fallback
        return today - datetime.timedelta(days=30), today


def compute_percentage_change(current: Decimal, prior: Decimal) -> Optional[Decimal]:
    """
    Computes safe percentage change between two Decimal amounts:
    ((current - prior) / prior) * 100
    Handles zero denominators safely.
    """
    current_q = quantize_money(current)
    prior_q = quantize_money(prior)

    if prior_q == Decimal("0.00"):
        if current_q == Decimal("0.00"):
            return Decimal("0.00")
        else:
            return Decimal("100.00")

    pct = ((current_q - prior_q) / abs(prior_q)) * Decimal("100.00")
    return quantize_money(pct)


def get_analytics_summary(
    db: Session,
    organization_id: str,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    preset: Optional[str] = None,
    currency: Optional[str] = None,
) -> AnalyticsSummaryResponse:
    """
    Computes authoritative financial summary metrics for the organization.
    All calculations use Decimal arithmetic and organization boundaries.
    """
    today = datetime.date.today()
    s_date, e_date = resolve_date_range(preset=preset, start_date=start_date, end_date=end_date, today=today)

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    selected_currency = currency or (org.currency if org else "USD")

    # 1. Invoiced Amount in selected period (issue_date between s_date and e_date)
    # Excludes DRAFT and CANCELLED
    invoiced_query = (
        db.query(func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")))
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
            Invoice.issue_date >= s_date,
            Invoice.issue_date <= e_date,
        )
    )
    invoiced_amount = quantize_money(invoiced_query.scalar() or Decimal("0.00"))

    # 2. Payments Collected in selected period (payment_date between s_date and e_date)
    # Includes only valid COMPLETED payments
    collected_query = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(
            Payment.organization_id == organization_id,
            Payment.currency == selected_currency,
            Payment.payment_status == PaymentStatus.COMPLETED,
            Payment.payment_date >= s_date,
            Payment.payment_date <= e_date,
        )
    )
    payments_collected = quantize_money(collected_query.scalar() or Decimal("0.00"))

    # 3. Outstanding Receivables (active balance due on eligible invoices)
    outstanding_query = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
            Invoice.balance_due > Decimal("0.00"),
        )
    )
    outstanding_receivables = quantize_money(outstanding_query.scalar() or Decimal("0.00"))

    # 4. Overdue Receivables (due_date < today and balance_due > 0 and not draft/cancelled/paid)
    overdue_query = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]),
            Invoice.due_date < today,
            Invoice.balance_due > Decimal("0.00"),
        )
    )
    overdue_receivables = quantize_money(overdue_query.scalar() or Decimal("0.00"))

    # 5. Partially Paid Amount (balance_due on invoices where amount_paid > 0 and balance_due > 0)
    partially_paid_query = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
            Invoice.amount_paid > Decimal("0.00"),
            Invoice.balance_due > Decimal("0.00"),
        )
    )
    partially_paid_amount = quantize_money(partially_paid_query.scalar() or Decimal("0.00"))

    # 6. Collection Rate:
    # Defined consistently as: (lifetime/active payments collected / lifetime/active invoiced amount) * 100
    # Or for period: if invoiced_amount > 0: (payments_collected / invoiced_amount) * 100
    all_time_invoiced_query = (
        db.query(func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")))
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
        )
    )
    all_time_invoiced = quantize_money(all_time_invoiced_query.scalar() or Decimal("0.00"))

    all_time_collected_query = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(
            Payment.organization_id == organization_id,
            Payment.currency == selected_currency,
            Payment.payment_status == PaymentStatus.COMPLETED,
        )
    )
    all_time_collected = quantize_money(all_time_collected_query.scalar() or Decimal("0.00"))

    if all_time_invoiced > Decimal("0.00"):
        collection_rate = quantize_money((all_time_collected / all_time_invoiced) * Decimal("100.00"))
    else:
        collection_rate = Decimal("0.00")

    # 7. Average Collection Time (Days to Settle) for fully PAID invoices:
    # (final_payment_date - issue_date)
    settled_invoices = (
        db.query(Invoice.issue_date, func.max(Payment.payment_date).label("settled_date"))
        .join(Payment, Invoice.id == Payment.invoice_id)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status == InvoiceStatus.PAID,
            Invoice.balance_due <= Decimal("0.00"),
            Payment.payment_status == PaymentStatus.COMPLETED,
        )
        .group_by(Invoice.id, Invoice.issue_date)
        .all()
    )

    if settled_invoices:
        total_days = sum((row.settled_date - row.issue_date).days for row in settled_invoices if row.settled_date and row.issue_date)
        average_collection_days = quantize_money(Decimal(total_days) / Decimal(len(settled_invoices)))
    else:
        average_collection_days = None

    # Counts
    active_invoices_count = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
            Invoice.balance_due > Decimal("0.00"),
        )
        .count()
    )

    overdue_invoices_count = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]),
            Invoice.due_date < today,
            Invoice.balance_due > Decimal("0.00"),
        )
        .count()
    )

    paid_invoices_count = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status == InvoiceStatus.PAID,
        )
        .count()
    )

    # 8. Month-over-Month (Prior Period) Comparisons
    period_length = (e_date - s_date).days + 1
    prior_e_date = s_date - datetime.timedelta(days=1)
    prior_s_date = prior_e_date - datetime.timedelta(days=period_length - 1)

    prior_invoiced = quantize_money(
        db.query(func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")))
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
            Invoice.issue_date >= prior_s_date,
            Invoice.issue_date <= prior_e_date,
        )
        .scalar()
        or Decimal("0.00")
    )

    prior_collected = quantize_money(
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(
            Payment.organization_id == organization_id,
            Payment.currency == selected_currency,
            Payment.payment_status == PaymentStatus.COMPLETED,
            Payment.payment_date >= prior_s_date,
            Payment.payment_date <= prior_e_date,
        )
        .scalar()
        or Decimal("0.00")
    )

    mom_invoiced = MomChangeMetric(
        current=invoiced_amount,
        prior=prior_invoiced,
        absolute_change=quantize_money(invoiced_amount - prior_invoiced),
        percentage_change=compute_percentage_change(invoiced_amount, prior_invoiced),
    )

    mom_collected = MomChangeMetric(
        current=payments_collected,
        prior=prior_collected,
        absolute_change=quantize_money(payments_collected - prior_collected),
        percentage_change=compute_percentage_change(payments_collected, prior_collected),
    )

    return AnalyticsSummaryResponse(
        currency=selected_currency,
        start_date=s_date,
        end_date=e_date,
        invoiced_amount=invoiced_amount,
        payments_collected=payments_collected,
        outstanding_receivables=outstanding_receivables,
        overdue_receivables=overdue_receivables,
        partially_paid_amount=partially_paid_amount,
        collection_rate=collection_rate,
        average_collection_days=average_collection_days,
        active_invoices_count=active_invoices_count,
        overdue_invoices_count=overdue_invoices_count,
        paid_invoices_count=paid_invoices_count,
        mom_invoiced=mom_invoiced,
        mom_collected=mom_collected,
    )


def get_revenue_and_collection_trends(
    db: Session,
    organization_id: str,
    months_count: int = 6,
    currency: Optional[str] = None,
) -> RevenueTrendsResponse:
    """
    Computes monthly invoiced versus collected time series across the last N calendar months.
    """
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    selected_currency = currency or (org.currency if org else "USD")

    today = datetime.date.today()
    # Build list of month periods (earliest to latest)
    periods = []
    current_m = today.month
    current_y = today.year

    for i in range(months_count - 1, -1, -1):
        target_month = current_m - i
        target_year = current_y
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        periods.append((target_year, target_month))

    items: List[MonthlyTrendItem] = []
    total_invoiced_agg = Decimal("0.00")
    total_collected_agg = Decimal("0.00")

    for year, month in periods:
        first_day = datetime.date(year, month, 1)
        if month == 12:
            last_day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            last_day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)

        period_key = f"{year:04d}-{month:02d}"
        period_label = first_day.strftime("%b %Y")

        # Invoiced in this month
        inv_data = (
            db.query(
                func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")).label("total"),
                func.count(Invoice.id).label("count"),
            )
            .filter(
                Invoice.organization_id == organization_id,
                Invoice.currency == selected_currency,
                Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
                Invoice.issue_date >= first_day,
                Invoice.issue_date <= last_day,
            )
            .first()
        )
        month_invoiced = quantize_money(inv_data.total or Decimal("0.00"))
        inv_count = inv_data.count or 0

        # Collected in this month
        pay_data = (
            db.query(
                func.coalesce(func.sum(Payment.amount), Decimal("0.00")).label("total"),
                func.count(Payment.id).label("count"),
            )
            .filter(
                Payment.organization_id == organization_id,
                Payment.currency == selected_currency,
                Payment.payment_status == PaymentStatus.COMPLETED,
                Payment.payment_date >= first_day,
                Payment.payment_date <= last_day,
            )
            .first()
        )
        month_collected = quantize_money(pay_data.total or Decimal("0.00"))
        pay_count = pay_data.count or 0

        total_invoiced_agg += month_invoiced
        total_collected_agg += month_collected

        items.append(
            MonthlyTrendItem(
                period=period_key,
                period_label=period_label,
                invoiced_amount=month_invoiced,
                collected_amount=month_collected,
                net_difference=quantize_money(month_collected - month_invoiced),
                invoice_count=inv_count,
                payment_count=pay_count,
            )
        )

    return RevenueTrendsResponse(
        currency=selected_currency,
        items=items,
        total_invoiced=quantize_money(total_invoiced_agg),
        total_collected=quantize_money(total_collected_agg),
    )


def get_aging_analytics(
    db: Session,
    organization_id: str,
    currency: Optional[str] = None,
) -> AgingAnalyticsResponse:
    """
    Computes GAAP-compliant overdue aging breakdown by outstanding balance.
    """
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    selected_currency = currency or (org.currency if org else "USD")

    today = datetime.date.today()

    # Query all active invoices with remaining balance
    eligible_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]),
            Invoice.balance_due > Decimal("0.00"),
        )
        .all()
    )

    brackets: Dict[str, Dict[str, Any]] = {
        "current": {"label": "Current (Not Overdue)", "total": Decimal("0.00"), "count": 0},
        "1_7_days": {"label": "1 - 7 Days", "total": Decimal("0.00"), "count": 0},
        "8_30_days": {"label": "8 - 30 Days", "total": Decimal("0.00"), "count": 0},
        "31_60_days": {"label": "31 - 60 Days", "total": Decimal("0.00"), "count": 0},
        "over_60_days": {"label": "60+ Days", "total": Decimal("0.00"), "count": 0},
    }

    total_receivables = Decimal("0.00")
    total_overdue = Decimal("0.00")

    for inv in eligible_invoices:
        bal = inv.balance_due
        total_receivables += bal

        if not inv.due_date or inv.due_date >= today:
            brackets["current"]["total"] += bal
            brackets["current"]["count"] += 1
        else:
            days_od = (today - inv.due_date).days
            total_overdue += bal

            if 1 <= days_od <= 7:
                brackets["1_7_days"]["total"] += bal
                brackets["1_7_days"]["count"] += 1
            elif 8 <= days_od <= 30:
                brackets["8_30_days"]["total"] += bal
                brackets["8_30_days"]["count"] += 1
            elif 31 <= days_od <= 60:
                brackets["31_60_days"]["total"] += bal
                brackets["31_60_days"]["count"] += 1
            else:
                brackets["over_60_days"]["total"] += bal
                brackets["over_60_days"]["count"] += 1

    total_receivables_q = quantize_money(total_receivables)
    total_overdue_q = quantize_money(total_overdue)

    bracket_items = []
    for k, v in brackets.items():
        bal_q = quantize_money(v["total"])
        pct = (
            quantize_money((bal_q / total_receivables_q) * Decimal("100.00"))
            if total_receivables_q > Decimal("0.00")
            else Decimal("0.00")
        )
        bracket_items.append(
            AgingBracketMetric(
                bracket=k,
                label=v["label"],
                total_balance=bal_q,
                invoice_count=v["count"],
                percentage_of_receivables=pct,
            )
        )

    return AgingAnalyticsResponse(
        currency=selected_currency,
        total_receivables=total_receivables_q,
        total_overdue=total_overdue_q,
        brackets=bracket_items,
    )


def get_status_distribution(
    db: Session,
    organization_id: str,
    currency: Optional[str] = None,
) -> StatusDistributionResponse:
    """
    Computes status distribution for all invoices in the organization.
    """
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    selected_currency = currency or (org.currency if org else "USD")

    rows = (
        db.query(
            Invoice.status,
            func.count(Invoice.id).label("count"),
            func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")).label("total"),
        )
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
        )
        .group_by(Invoice.status)
        .all()
    )

    total_invoices = sum(r.count for r in rows)
    total_amount_all = sum((quantize_money(r.total) for r in rows), Decimal("0.00"))

    labels_map = {
        InvoiceStatus.DRAFT.value: "Draft",
        InvoiceStatus.ISSUED.value: "Issued",
        InvoiceStatus.SENT.value: "Sent",
        InvoiceStatus.PARTIALLY_PAID.value: "Partially Paid",
        InvoiceStatus.PAID.value: "Paid",
        InvoiceStatus.OVERDUE.value: "Overdue",
        InvoiceStatus.CANCELLED.value: "Cancelled",
    }

    items = []
    for r in rows:
        status_val = r.status.value if hasattr(r.status, "value") else str(r.status)
        amt = quantize_money(r.total)
        pct = (
            quantize_money((Decimal(r.count) / Decimal(total_invoices)) * Decimal("100.00"))
            if total_invoices > 0
            else Decimal("0.00")
        )
        items.append(
            StatusDistributionItem(
                status=status_val,
                label=labels_map.get(status_val, status_val.capitalize()),
                count=r.count,
                total_amount=amt,
                percentage=pct,
            )
        )

    return StatusDistributionResponse(
        currency=selected_currency,
        total_invoices=total_invoices,
        items=items,
    )


def get_client_performance_report(
    db: Session,
    organization_id: str,
    search: Optional[str] = None,
    sort_by: str = "total_invoiced",
    descending: bool = True,
    skip: int = 0,
    limit: int = 50,
    currency: Optional[str] = None,
) -> ClientPerformanceResponse:
    """
    Computes client performance metrics WITHOUT multi-table join duplication.
    Queries clients and aggregates invoices and payments via independent subqueries.
    """
    today = datetime.date.today()
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    selected_currency = currency or (org.currency if org else "USD")

    # 1. Base clients query
    client_q = db.query(Client).filter(Client.organization_id == organization_id)
    if search:
        s = f"%{search.strip()}%"
        client_q = client_q.filter(or_(Client.name.ilike(s), Client.email.ilike(s)))

    all_clients = client_q.all()

    # 2. Aggregated invoice metrics per client (independent to prevent cartesian product)
    inv_agg_rows = (
        db.query(
            Invoice.client_id,
            func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")).label("total_invoiced"),
            func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")).label("outstanding_balance"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED]),
        )
        .group_by(Invoice.client_id)
        .all()
    )
    inv_map = {r.client_id: r for r in inv_agg_rows}

    # 3. Overdue invoices metrics per client
    overdue_agg_rows = (
        db.query(
            Invoice.client_id,
            func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")).label("overdue_balance"),
            func.count(Invoice.id).label("overdue_count"),
        )
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]),
            Invoice.due_date < today,
            Invoice.balance_due > Decimal("0.00"),
        )
        .group_by(Invoice.client_id)
        .all()
    )
    overdue_map = {r.client_id: r for r in overdue_agg_rows}

    # 4. Payment metrics per client (via Invoice link, strictly non-cartesian)
    pay_agg_rows = (
        db.query(
            Invoice.client_id,
            func.coalesce(func.sum(Payment.amount), Decimal("0.00")).label("total_collected"),
            func.max(Payment.payment_date).label("latest_payment_date"),
        )
        .join(Payment, Invoice.id == Payment.invoice_id)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Payment.payment_status == PaymentStatus.COMPLETED,
        )
        .group_by(Invoice.client_id)
        .all()
    )
    pay_map = {r.client_id: r for r in pay_agg_rows}

    # 5. Average settlement days per client for fully settled invoices
    settled_rows = (
        db.query(
            Invoice.client_id,
            Invoice.issue_date,
            func.max(Payment.payment_date).label("settled_date"),
        )
        .join(Payment, Invoice.id == Payment.invoice_id)
        .filter(
            Invoice.organization_id == organization_id,
            Invoice.currency == selected_currency,
            Invoice.status == InvoiceStatus.PAID,
            Invoice.balance_due <= Decimal("0.00"),
            Payment.payment_status == PaymentStatus.COMPLETED,
        )
        .group_by(Invoice.id, Invoice.client_id, Invoice.issue_date)
        .all()
    )

    client_settlement_diffs: Dict[str, List[int]] = {}
    for r in settled_rows:
        if r.settled_date and r.issue_date:
            diff = (r.settled_date - r.issue_date).days
            client_settlement_diffs.setdefault(r.client_id, []).append(diff)

    items: List[ClientPerformanceItem] = []
    for c in all_clients:
        inv_info = inv_map.get(c.id)
        od_info = overdue_map.get(c.id)
        pay_info = pay_map.get(c.id)

        tot_invoiced = quantize_money(inv_info.total_invoiced) if inv_info else Decimal("0.00")
        out_balance = quantize_money(inv_info.outstanding_balance) if inv_info else Decimal("0.00")
        inv_cnt = inv_info.invoice_count if inv_info else 0

        tot_collected = quantize_money(pay_info.total_collected) if pay_info else Decimal("0.00")
        latest_pay = pay_info.latest_payment_date if pay_info else None

        od_balance = quantize_money(od_info.overdue_balance) if od_info else Decimal("0.00")
        od_cnt = od_info.overdue_count if od_info else 0

        diffs = client_settlement_diffs.get(c.id, [])
        avg_days = quantize_money(Decimal(sum(diffs)) / Decimal(len(diffs))) if diffs else None

        items.append(
            ClientPerformanceItem(
                client_id=c.id,
                client_name=c.name,
                email=c.email,
                currency=selected_currency,
                total_invoiced=tot_invoiced,
                total_collected=tot_collected,
                outstanding_balance=out_balance,
                overdue_balance=od_balance,
                invoice_count=inv_cnt,
                overdue_invoice_count=od_cnt,
                average_settlement_days=avg_days,
                latest_payment_date=latest_pay,
            )
        )

    # Sort
    sort_key_fn = lambda x: getattr(x, sort_by, x.total_invoiced) or Decimal("0.00")
    items.sort(key=sort_key_fn, reverse=descending)

    total_clients = len(items)
    paginated_items = items[skip : skip + limit]

    return ClientPerformanceResponse(
        items=paginated_items,
        total=total_clients,
        skip=skip,
        limit=limit,
    )
