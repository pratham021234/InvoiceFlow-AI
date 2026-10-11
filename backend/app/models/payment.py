import enum
from sqlalchemy import (
    Column,
    String,
    Text,
    Numeric,
    Date,
    DateTime,
    Boolean,
    ForeignKey,
    Index,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid, TimestampMixin, utc_now


class PaymentStatus(str, enum.Enum):
    COMPLETED = "completed"
    REVERSED = "reversed"
    FAILED = "failed"


class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    CASH = "cash"
    ONLINE_GATEWAY = "online_gateway"
    OTHER = "other"


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True)

    payment_number = Column(String(50), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    payment_date = Column(Date, nullable=False, index=True)
    payment_method = Column(String(50), default="bank_transfer", nullable=False)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    payment_status = Column(
        SQLEnum(PaymentStatus, values_callable=lambda x: [e.value for e in x]),
        default=PaymentStatus.COMPLETED,
        nullable=False,
        index=True,
    )
    is_manual = Column(Boolean, default=True, nullable=False)

    created_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reversal_reason = Column(String(500), nullable=True)
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    reversed_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payments")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    reversed_by = relationship("User", foreign_keys=[reversed_by_user_id])

    __table_args__ = (
        Index("ix_payments_org_date", "organization_id", "payment_date"),
        Index("ix_payments_org_status", "organization_id", "payment_status"),
        Index("ix_payments_inv_status", "invoice_id", "payment_status"),
    )
