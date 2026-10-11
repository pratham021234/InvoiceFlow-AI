from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member
from app.models.user import User
from app.models.organization import OrganizationMember
from app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
    PaymentListResponse,
    PaymentReverseRequest,
)
from app.services.payment_service import (
    record_payment,
    reverse_payment,
    get_payment_by_id,
    list_payments,
    PaymentDomainError,
)

router = APIRouter()


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    organization_id: str,
    payment_in: PaymentCreate,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Records a payment against an issued or partially paid invoice.
    Enforces tenant isolation, idempotency, and overpayment policy.
    """
    try:
        payment = record_payment(
            db=db,
            organization_id=organization_id,
            invoice_id=payment_in.invoice_id,
            user_id=current_user.id,
            amount=payment_in.amount,
            payment_date=payment_in.payment_date,
            payment_method=payment_in.payment_method,
            reference=payment_in.reference,
            notes=payment_in.notes,
            is_manual=payment_in.is_manual,
            idempotency_key=payment_in.idempotency_key,
        )
        return payment
    except PaymentDomainError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=PaymentListResponse)
def get_all_payments(
    organization_id: str,
    invoice_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Lists payments scoped to the organization with optional filtering."""
    items, total = list_payments(
        db=db,
        organization_id=organization_id,
        invoice_id=invoice_id,
        status=status,
        payment_method=payment_method,
        skip=skip,
        limit=limit,
    )
    return PaymentListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment_details(
    organization_id: str,
    payment_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Retrieves payment details by ID ensuring organization isolation."""
    payment = get_payment_by_id(db=db, organization_id=organization_id, payment_id=payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found.")
    return payment


@router.post("/{payment_id}/reverse", response_model=PaymentResponse)
def reverse_payment_endpoint(
    organization_id: str,
    payment_id: str,
    payload: PaymentReverseRequest,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Reverses a completed payment with an auditable reason and recalculates invoice balances.
    Does NOT delete the record, preserving financial audit trail.
    """
    try:
        payment = reverse_payment(
            db=db,
            organization_id=organization_id,
            payment_id=payment_id,
            user_id=current_user.id,
            reason=payload.reason,
        )
        return payment
    except (PaymentDomainError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
