from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, ConfigDict


class ClientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Business or client company name")
    contact_name: Optional[str] = Field(None, max_length=255, description="Primary contact person")
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    billing_address: Optional[str] = None
    country: str = Field(default="United States", max_length=100)
    tax_id: Optional[str] = Field(None, max_length=100, description="Tax ID / VAT number")
    currency: str = Field(default="USD", min_length=3, max_length=3, description="Default currency")
    notes: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    billing_address: Optional[str] = None
    country: Optional[str] = Field(None, max_length=100)
    tax_id: Optional[str] = Field(None, max_length=100)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    notes: Optional[str] = None


class ClientResponse(ClientBase):
    id: str
    organization_id: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientDetailResponse(ClientResponse):
    total_invoiced: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    balance_due: Decimal = Decimal("0.00")
    invoice_count: int = 0
