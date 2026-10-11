from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member
from app.models.user import User
from app.models.organization import OrganizationMember
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientDetailResponse,
)
from app.schemas.invoice import InvoiceResponse
from app.services.client_service import (
    get_clients,
    get_client_by_id,
    create_client,
    update_client,
    archive_client,
    restore_client,
    get_client_financial_aggregates,
)
from app.services.invoice_service import compute_effective_status
from app.models.invoice import Invoice

router = APIRouter()


@router.get("", response_model=List[ClientResponse])
def list_clients(
    organization_id: str,
    search: Optional[str] = None,
    is_archived: Optional[bool] = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """List paginated clients scoped strictly to active organization."""
    clients, _ = get_clients(
        db=db,
        organization_id=organization_id,
        search=search,
        is_archived=is_archived,
        skip=skip,
        limit=limit,
    )
    return clients


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_new_client(
    organization_id: str,
    client_in: ClientCreate,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Creates a new client inside the specified organization."""
    client = create_client(db=db, organization_id=organization_id, client_in=client_in)
    return client


@router.get("/{client_id}", response_model=ClientDetailResponse)
def get_client_details(
    organization_id: str,
    client_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Fetch client profile along with real-time aggregated financial totals."""
    client = get_client_by_id(db=db, organization_id=organization_id, client_id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    aggregates = get_client_financial_aggregates(db=db, organization_id=organization_id, client_id=client_id)
    resp = ClientDetailResponse.model_validate(client)
    resp.total_invoiced = aggregates["total_invoiced"]
    resp.total_paid = aggregates["total_paid"]
    resp.balance_due = aggregates["balance_due"]
    resp.invoice_count = aggregates["invoice_count"]
    return resp


@router.patch("/{client_id}", response_model=ClientResponse)
def update_client_details(
    organization_id: str,
    client_id: str,
    client_update: ClientUpdate,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Updates client contact and billing address details."""
    client = update_client(
        db=db,
        organization_id=organization_id,
        client_id=client_id,
        client_update=client_update,
    )
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    return client


@router.post("/{client_id}/archive", response_model=ClientResponse)
def archive_client_endpoint(
    organization_id: str,
    client_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Soft-archives a client while preserving historical invoice links."""
    client = archive_client(db=db, organization_id=organization_id, client_id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    return client


@router.post("/{client_id}/restore", response_model=ClientResponse)
def restore_client_endpoint(
    organization_id: str,
    client_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Restores an archived client back to active state."""
    client = restore_client(db=db, organization_id=organization_id, client_id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    return client


@router.get("/{client_id}/invoices", response_model=List[InvoiceResponse])
def get_client_invoices_endpoint(
    organization_id: str,
    client_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Returns invoice history for the specified client."""
    client = get_client_by_id(db=db, organization_id=organization_id, client_id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")

    invoices = (
        db.query(Invoice)
        .filter(Invoice.organization_id == organization_id, Invoice.client_id == client_id)
        .order_by(Invoice.issue_date.desc())
        .all()
    )

    responses = []
    for inv in invoices:
        resp = InvoiceResponse.model_validate(inv)
        resp.effective_status = compute_effective_status(inv)
        responses.append(resp)
    return responses
