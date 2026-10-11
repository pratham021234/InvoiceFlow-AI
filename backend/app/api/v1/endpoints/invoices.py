from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member
from app.models.user import User
from app.models.organization import OrganizationMember, Organization
from app.models.client import Client
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceCancelRequest,
    InvoiceListResponse,
)
from app.services.invoice_service import (
    get_invoices,
    get_invoice_by_id,
    create_invoice,
    update_draft_invoice,
    issue_invoice,
    cancel_invoice,
    duplicate_invoice,
    delete_draft_invoice,
    compute_effective_status,
)
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter()


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    organization_id: str,
    status: Optional[str] = None,
    client_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Lists invoices scoped to active organization with status and search filters."""
    invoices, total = get_invoices(
        db=db,
        organization_id=organization_id,
        status=status,
        client_id=client_id,
        search=search,
        skip=skip,
        limit=limit,
    )

    items = []
    for inv in invoices:
        resp = InvoiceResponse.model_validate(inv)
        resp.effective_status = compute_effective_status(inv)
        items.append(resp)

    return InvoiceListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_new_invoice(
    organization_id: str,
    invoice_in: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Creates a new DRAFT invoice with server-verified line item calculations."""
    try:
        inv = create_invoice(
            db=db,
            organization_id=organization_id,
            user_id=current_user.id,
            invoice_in=invoice_in,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    resp = InvoiceResponse.model_validate(inv)
    resp.effective_status = compute_effective_status(inv)
    return resp


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice_detail(
    organization_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Retrieves invoice details, line items, client details, and effective status."""
    inv = get_invoice_by_id(db=db, organization_id=organization_id, invoice_id=invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    resp = InvoiceResponse.model_validate(inv)
    resp.effective_status = compute_effective_status(inv)
    return resp


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    organization_id: str,
    invoice_id: str,
    invoice_update: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Updates a draft invoice. Modification of issued or paid invoices is forbidden."""
    try:
        inv = update_draft_invoice(
            db=db,
            organization_id=organization_id,
            user_id=current_user.id,
            invoice_id=invoice_id,
            invoice_update=invoice_update,
        )
    except LookupError as le:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(pe))

    resp = InvoiceResponse.model_validate(inv)
    resp.effective_status = compute_effective_status(inv)
    return resp


@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
def issue_invoice_endpoint(
    organization_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Officially issues invoice and assigns an immutable sequential organization invoice number."""
    try:
        inv = issue_invoice(
            db=db,
            organization_id=organization_id,
            user_id=current_user.id,
            invoice_id=invoice_id,
        )
    except LookupError as le:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    resp = InvoiceResponse.model_validate(inv)
    resp.effective_status = compute_effective_status(inv)
    return resp


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice_endpoint(
    organization_id: str,
    invoice_id: str,
    cancel_in: InvoiceCancelRequest,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Cancels an invoice with an auditable reason."""
    try:
        inv = cancel_invoice(
            db=db,
            organization_id=organization_id,
            user_id=current_user.id,
            invoice_id=invoice_id,
            reason=cancel_in.reason,
        )
    except LookupError as le:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    resp = InvoiceResponse.model_validate(inv)
    resp.effective_status = compute_effective_status(inv)
    return resp


@router.post("/{invoice_id}/duplicate", response_model=InvoiceResponse)
def duplicate_invoice_endpoint(
    organization_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Duplicates line items and terms of an invoice into a fresh DRAFT invoice."""
    try:
        inv = duplicate_invoice(
            db=db,
            organization_id=organization_id,
            user_id=current_user.id,
            invoice_id=invoice_id,
        )
    except LookupError as le:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    resp = InvoiceResponse.model_validate(inv)
    resp.effective_status = compute_effective_status(inv)
    return resp


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice_endpoint(
    organization_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Deletes a draft invoice. Attempting to delete an issued or paid invoice is rejected."""
    try:
        delete_draft_invoice(
            db=db,
            organization_id=organization_id,
            user_id=current_user.id,
            invoice_id=invoice_id,
        )
    except LookupError as le:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(le))
    except (ValueError, PermissionError) as pe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(pe))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    organization_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Generates and streams an authoritative, professional PDF invoice."""
    inv = get_invoice_by_id(db=db, organization_id=organization_id, invoice_id=invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    client = db.query(Client).filter(Client.id == inv.client_id).first()

    if not org or not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization or Client not found.")

    pdf_bytes = generate_invoice_pdf(invoice=inv, organization=org, client=client)

    filename = f"Invoice_{inv.invoice_number.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
