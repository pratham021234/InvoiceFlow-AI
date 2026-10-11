from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member
from app.models.user import User
from app.models.organization import OrganizationMember
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    RevenueTrendsResponse,
    AgingAnalyticsResponse,
    StatusDistributionResponse,
    ClientPerformanceResponse,
)
from app.services.analytics_service import (
    get_analytics_summary,
    get_revenue_and_collection_trends,
    get_aging_analytics,
    get_status_distribution,
    get_client_performance_report,
)
from app.services.csv_export_service import (
    export_invoices_csv,
    export_payments_csv,
    export_clients_csv,
    export_receivables_csv,
    export_monthly_summary_csv,
)

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_summary(
    organization_id: str,
    preset: Optional[str] = Query("30d", description="Preset: 30d, 90d, current_month, last_month, current_year, all"),
    start_date: Optional[date] = Query(None, description="Start date (inclusive)"),
    end_date: Optional[date] = Query(None, description="End date (inclusive)"),
    currency: Optional[str] = Query(None, description="Currency filter"),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Retrieves authoritative financial summary metrics and MoM changes."""
    return get_analytics_summary(
        db=db,
        organization_id=organization_id,
        start_date=start_date,
        end_date=end_date,
        preset=preset,
        currency=currency,
    )


@router.get("/revenue-trends", response_model=RevenueTrendsResponse)
def get_revenue_trends(
    organization_id: str,
    months: int = Query(6, ge=1, le=24, description="Number of past calendar months to evaluate"),
    currency: Optional[str] = Query(None, description="Currency filter"),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Retrieves monthly invoiced versus collected time series."""
    return get_revenue_and_collection_trends(
        db=db,
        organization_id=organization_id,
        months_count=months,
        currency=currency,
    )


@router.get("/aging", response_model=AgingAnalyticsResponse)
def get_aging(
    organization_id: str,
    currency: Optional[str] = Query(None, description="Currency filter"),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Retrieves GAAP-compliant overdue aging breakdown by outstanding balance."""
    return get_aging_analytics(
        db=db,
        organization_id=organization_id,
        currency=currency,
    )


@router.get("/status-distribution", response_model=StatusDistributionResponse)
def get_status_breakdown(
    organization_id: str,
    currency: Optional[str] = Query(None, description="Currency filter"),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Retrieves invoice count and amount breakdown across all status categories."""
    return get_status_distribution(
        db=db,
        organization_id=organization_id,
        currency=currency,
    )


@router.get("/clients", response_model=ClientPerformanceResponse)
def get_client_report(
    organization_id: str,
    search: Optional[str] = Query(None, description="Search client name or email"),
    sort_by: str = Query("total_invoiced", description="Sort field: total_invoiced, total_collected, outstanding_balance, overdue_balance"),
    descending: bool = Query(True, description="Sort direction"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    currency: Optional[str] = Query(None, description="Currency filter"),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Retrieves client performance leaderboard and collection metrics."""
    return get_client_performance_report(
        db=db,
        organization_id=organization_id,
        search=search,
        sort_by=sort_by,
        descending=descending,
        skip=skip,
        limit=limit,
        currency=currency,
    )


@router.get("/export/{export_type}")
def export_csv(
    organization_id: str,
    export_type: str,
    status_filter: Optional[str] = Query(None, alias="status", description="Optional status filter"),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Exports organization-scoped financial records as UTF-8 CSV with formula-injection mitigation.
    Supported types: invoices, payments, clients, receivables, overdue, monthly_summary
    """
    clean_type = export_type.lower().strip().replace("-", "_")
    today_str = date.today().strftime("%Y%m%d")

    if clean_type == "invoices":
        csv_data = export_invoices_csv(db=db, organization_id=organization_id, status_filter=status_filter)
        filename = f"invoices_export_{today_str}.csv"
    elif clean_type == "payments":
        csv_data = export_payments_csv(db=db, organization_id=organization_id, status_filter=status_filter)
        filename = f"payments_export_{today_str}.csv"
    elif clean_type == "clients":
        csv_data = export_clients_csv(db=db, organization_id=organization_id)
        filename = f"clients_export_{today_str}.csv"
    elif clean_type == "receivables":
        csv_data = export_receivables_csv(db=db, organization_id=organization_id, overdue_only=False)
        filename = f"receivables_export_{today_str}.csv"
    elif clean_type == "overdue":
        csv_data = export_receivables_csv(db=db, organization_id=organization_id, overdue_only=True)
        filename = f"overdue_invoices_{today_str}.csv"
    elif clean_type == "monthly_summary":
        csv_data = export_monthly_summary_csv(db=db, organization_id=organization_id)
        filename = f"financial_summary_{today_str}.csv"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export type '{export_type}'. Supported: invoices, payments, clients, receivables, overdue, monthly_summary",
        )

    return Response(
        content=csv_data.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
