from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid, TimestampMixin


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)  # Business / Company Name
    contact_name = Column(String(255), nullable=True)  # Contact Person
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    billing_address = Column(Text, nullable=True)
    country = Column(String(100), default="United States", nullable=False)
    tax_id = Column(String(100), nullable=True)  # Tax ID / VAT Number
    currency = Column(String(3), default="USD", nullable=False)
    notes = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)

    # Relationships - strictly prevent cascading deletes of financial invoices
    organization = relationship("Organization", back_populates="clients")
    invoices = relationship("Invoice", back_populates="client")
    email_logs = relationship("EmailLog", back_populates="client")

    __table_args__ = (
        Index("ix_clients_org_archived", "organization_id", "is_archived"),
        Index("ix_clients_org_name", "organization_id", "name"),
        Index("ix_clients_org_email", "organization_id", "email"),
    )
