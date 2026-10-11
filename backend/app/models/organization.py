import enum
from sqlalchemy import Column, String, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid, TimestampMixin


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class MembershipStatus(str, enum.Enum):
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String(100), default="United States", nullable=False)
    currency = Column(String(3), default="USD", nullable=False)  # ISO 4217 code
    timezone = Column(String(50), default="UTC", nullable=False)
    tax_id = Column(String(100), nullable=True)  # EIN, VAT, GST
    logo_url = Column(String(500), nullable=True)
    invoice_prefix = Column(String(10), default="INV", nullable=False)
    next_invoice_number = Column(String(20), default="1001", nullable=False)
    payment_instructions = Column(Text, nullable=True)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_organizations")
    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="organization")
    invoices = relationship("Invoice", back_populates="organization")
    payments = relationship("Payment", back_populates="organization")
    reminder_logs = relationship("ReminderLog", back_populates="organization")


class OrganizationMember(Base, TimestampMixin):
    __tablename__ = "organization_members"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SQLEnum(MemberRole, values_callable=lambda x: [e.value for e in x]), default=MemberRole.MEMBER, nullable=False)
    status = Column(SQLEnum(MembershipStatus, values_callable=lambda x: [e.value for e in x]), default=MembershipStatus.ACTIVE, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
        Index("ix_org_member_org_user", "organization_id", "user_id"),
        Index("ix_org_member_status", "organization_id", "status"),
    )
