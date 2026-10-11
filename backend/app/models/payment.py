from sqlalchemy import Column, String, Text, Numeric, Date, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid, TimestampMixin


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True)

    payment_number = Column(String(50), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(Date, nullable=False, index=True)
    payment_method = Column(String(50), default="bank_transfer", nullable=False)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payments")

    __table_args__ = (
        Index("ix_payments_org_date", "organization_id", "payment_date"),
    )
