from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.models.payment import PaymentStatus, PaymentMethod


class PaymentBase(BaseModel):
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Payment amount must be greater than zero")
    payment_date: date
    payment_method: str = Field(default="bank_transfer", description="Payment method used")
    reference: Optional[str] = Field(None, max_length=100, description="External reference number or transaction ID")
    notes: Optional[str] = None
    is_manual: bool = Field(default=True, description="True if manually recorded by user")


class PaymentCreate(PaymentBase):
    invoice_id: str
    idempotency_key: Optional[str] = Field(None, max_length=128, description="Optional key to prevent duplicate submissions")


class PaymentReverseRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Audit reason for reversing the payment")


class PaymentResponse(PaymentBase):
    id: str
    organization_id: str
    invoice_id: str
    payment_number: Optional[str] = None
    currency: str
    payment_status: PaymentStatus
    created_by_user_id: Optional[str] = None
    reversal_reason: Optional[str] = None
    reversed_at: Optional[datetime] = None
    reversed_by_user_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentListResponse(BaseModel):
    items: List[PaymentResponse]
    total: int
    skip: int
    limit: int
