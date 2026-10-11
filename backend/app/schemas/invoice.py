from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.models.invoice import InvoiceStatus
from app.schemas.client import ClientResponse


class InvoiceItemBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1.0000"), gt=Decimal("0.0000"), description="Quantity must be greater than zero")
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), description="Unit price cannot be negative")
    discount_percent: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"), description="Discount percent must be between 0 and 100")
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"), description="Tax rate must be between 0 and 100")
    display_order: int = Field(default=0, ge=0)


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemResponse(InvoiceItemBase):
    id: str
    line_subtotal: Decimal
    line_discount: Decimal
    line_tax: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    client_id: str
    issue_date: date
    due_date: date
    currency: str = Field(default="USD", min_length=3, max_length=3)
    notes: Optional[str] = None
    payment_terms: Optional[str] = None

    @field_validator("currency", mode="before")
    def uppercase_currency(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v


class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = Field(..., min_length=1, description="An invoice must contain at least one line item")


class InvoiceUpdate(BaseModel):
    client_id: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    items: Optional[List[InvoiceItemCreate]] = None

    @field_validator("currency", mode="before")
    def uppercase_currency(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if isinstance(v, str) else v


class InvoiceCancelRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for invoice cancellation")


class InvoiceResponse(InvoiceBase):
    id: str
    organization_id: str
    invoice_number: str
    status: InvoiceStatus
    effective_status: Optional[InvoiceStatus] = None  # Computed status (handles overdue)
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    public_token: str
    public_token_active: bool
    issued_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[InvoiceItemResponse] = []
    client: Optional[ClientResponse] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceListResponse(BaseModel):
    items: List[InvoiceResponse]
    total: int
    skip: int
    limit: int
