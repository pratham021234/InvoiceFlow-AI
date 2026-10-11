from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from app.models.organization import MemberRole, MembershipStatus


class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    country: str = Field(default="United States", max_length=100)
    currency: str = Field(default="USD", min_length=3, max_length=3, description="ISO 4217 currency code")
    timezone: str = Field(default="UTC", max_length=50)
    tax_id: Optional[str] = Field(None, max_length=100)
    logo_url: Optional[str] = Field(None, max_length=500)
    invoice_prefix: str = Field(default="INV", min_length=1, max_length=10)
    payment_instructions: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    slug: Optional[str] = Field(None, min_length=2, max_length=255)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    country: Optional[str] = Field(None, max_length=100)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    timezone: Optional[str] = Field(None, max_length=50)
    tax_id: Optional[str] = Field(None, max_length=100)
    logo_url: Optional[str] = Field(None, max_length=500)
    invoice_prefix: Optional[str] = Field(None, min_length=1, max_length=10)
    next_invoice_number: Optional[str] = Field(None, max_length=20)
    payment_instructions: Optional[str] = None


class OrganizationResponse(OrganizationBase):
    id: str
    slug: str
    owner_id: Optional[str] = None
    next_invoice_number: str
    created_at: datetime
    updated_at: datetime
    user_role: Optional[MemberRole] = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: MemberRole
    status: MembershipStatus
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganizationDetailResponse(OrganizationResponse):
    members: List[OrganizationMemberResponse] = []
