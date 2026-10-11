from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member
from app.models.user import User
from app.models.organization import OrganizationMember
from app.schemas.receivables import ReceivablesSummaryResponse
from app.services.receivables_service import get_receivables_summary

router = APIRouter()


@router.get("", response_model=ReceivablesSummaryResponse)
def get_receivables(
    organization_id: str,
    status: Optional[str] = Query(None, description="Filter: overdue, due_soon, partially_paid, paid"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    search: Optional[str] = Query(None, description="Search by invoice number or client name"),
    start_date: Optional[date] = Query(None, description="Start date filter (inclusive)"),
    end_date: Optional[date] = Query(None, description="End date filter (inclusive)"),
    aging_bracket: Optional[str] = Query(None, description="Filter: current, 1_7_days, 8_30_days, 31_60_days, over_60_days"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Returns authoritative Accounts Receivable summary with aging breakdown,
    overdue metrics, and filtered list of invoices.
    """
    return get_receivables_summary(
        db=db,
        organization_id=organization_id,
        status_filter=status,
        client_id=client_id,
        search=search,
        start_date=start_date,
        end_date=end_date,
        aging_bracket=aging_bracket,
        skip=skip,
        limit=limit,
    )
