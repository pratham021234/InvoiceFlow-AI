from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from app.models.reminder import EmailType, EmailStatus


class EmailSendRequest(BaseModel):
    recipient_email: Optional[EmailStr] = Field(None, description="Recipient email (defaults to client email if omitted)")
    subject: Optional[str] = Field(None, max_length=255, description="Custom email subject")
    message: Optional[str] = Field(None, description="Optional custom personal message to accompany the email")
    attach_pdf: bool = Field(default=True, description="Whether to attach the invoice PDF")


class EmailLogResponse(BaseModel):
    id: str
    organization_id: str
    invoice_id: Optional[str] = None
    client_id: Optional[str] = None
    notification_type: EmailType
    recipient_email: str
    subject: str
    delivery_status: EmailStatus
    provider_message_id: Optional[str] = None
    attempt_count: int
    last_attempt_at: datetime
    error_message: Optional[str] = None
    idempotency_key: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmailLogListResponse(BaseModel):
    items: List[EmailLogResponse]
    total: int
    skip: int
    limit: int
