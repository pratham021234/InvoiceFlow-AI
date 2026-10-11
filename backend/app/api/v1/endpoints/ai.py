from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member
from app.models.user import User
from app.models.organization import OrganizationMember
from app.schemas.ai import (
    AISummaryRequest,
    AISummaryResponse,
    AIDraftReminderRequest,
    AIDraftReminderResponse,
    AINaturalQueryRequest,
    AINaturalQueryResponse,
)
from app.services.ai_assistant_service import (
    generate_financial_summary,
    draft_payment_reminder,
    answer_natural_language_query,
)

router = APIRouter()


@router.post("/summary", response_model=AISummaryResponse)
def get_ai_summary(
    organization_id: str,
    payload: Optional[AISummaryRequest] = None,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Generates an executive financial summary based on verified backend metrics.
    Works offline/mock if OpenAI API key is not configured.
    """
    currency = payload.currency if payload else None
    return generate_financial_summary(
        db=db,
        organization_id=organization_id,
        currency=currency,
    )


@router.post("/draft-reminder", response_model=AIDraftReminderResponse)
def draft_reminder_endpoint(
    organization_id: str,
    payload: AIDraftReminderRequest,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Drafts an editable payment reminder with tone adjustment (friendly, professional, firm).
    Never mutates records or sends emails autonomously.
    """
    try:
        return draft_payment_reminder(
            db=db,
            organization_id=organization_id,
            invoice_id=payload.invoice_id,
            tone=payload.tone,
            custom_instructions=payload.custom_instructions,
        )
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/query", response_model=AINaturalQueryResponse)
def natural_language_query_endpoint(
    organization_id: str,
    payload: AINaturalQueryRequest,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Answers read-only financial questions using validated intent matching and trusted analytics.
    STRICT SECURITY: Never executes arbitrary or LLM-generated SQL against the database.
    """
    return answer_natural_language_query(
        db=db,
        organization_id=organization_id,
        query_text=payload.query,
    )
