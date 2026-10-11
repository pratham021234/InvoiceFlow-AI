from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member
from app.models.user import User
from app.models.organization import OrganizationMember
from app.models.reminder import EmailLog, EmailStatus, EmailType
from app.schemas.email_log import (
    EmailSendRequest,
    EmailLogResponse,
    EmailLogListResponse,
)
from app.services.email_service import (
    send_invoice_email,
    send_payment_reminder_email,
    EmailConfigurationError,
)
from app.services.reminder_service import process_scheduled_reminders

router = APIRouter()


@router.post("/invoices/{invoice_id}/send-email", response_model=EmailLogResponse)
def send_invoice_email_endpoint(
    organization_id: str,
    invoice_id: str,
    payload: Optional[EmailSendRequest] = None,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Sends the invoice with attached PDF to the client via transactional email provider.
    Distinguishes provider acceptance from confirmed delivery.
    """
    recipient_email = payload.recipient_email if payload else None
    custom_subject = payload.subject if payload else None
    custom_message = payload.message if payload else None
    attach_pdf = payload.attach_pdf if payload is not None else True

    try:
        log_entry = send_invoice_email(
            db=db,
            organization_id=organization_id,
            invoice_id=invoice_id,
            user_id=current_user.id,
            recipient_email=recipient_email,
            custom_subject=custom_subject,
            custom_message=custom_message,
            attach_pdf=attach_pdf,
        )
        return log_entry
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except EmailConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Email service not configured: {str(e)}",
        )


@router.post("/invoices/{invoice_id}/remind", response_model=EmailLogResponse)
def send_payment_reminder_endpoint(
    organization_id: str,
    invoice_id: str,
    payload: Optional[EmailSendRequest] = None,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Manually triggers a payment reminder for an eligible invoice.
    Excludes drafts, cancelled, and settled invoices.
    """
    custom_message = payload.message if payload else None

    try:
        log_entry = send_payment_reminder_email(
            db=db,
            organization_id=organization_id,
            invoice_id=invoice_id,
            user_id=current_user.id,
            custom_message=custom_message,
        )
        return log_entry
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except EmailConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Email service not configured: {str(e)}",
        )


@router.get("/email-logs", response_model=EmailLogListResponse)
def list_email_logs(
    organization_id: str,
    invoice_id: Optional[str] = None,
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    notification_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Lists transactional email logs scoped to the organization."""
    query = db.query(EmailLog).filter(EmailLog.organization_id == organization_id)

    if invoice_id:
        query = query.filter(EmailLog.invoice_id == invoice_id)
    if client_id:
        query = query.filter(EmailLog.client_id == client_id)
    if status:
        query = query.filter(EmailLog.delivery_status == status)
    if notification_type:
        query = query.filter(EmailLog.notification_type == notification_type)

    total = query.count()
    items = query.order_by(EmailLog.created_at.desc()).offset(skip).limit(limit).all()

    return EmailLogListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("/reminders/process")
def process_scheduled_reminders_endpoint(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """Triggers scheduled payment reminders evaluation for the organization."""
    summary = process_scheduled_reminders(db=db, organization_id=organization_id)
    return summary
