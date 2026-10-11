import enum
from sqlalchemy import Column, String, Text, ForeignKey, Enum as SQLEnum, Index, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid, TimestampMixin, utc_now


class ReminderType(str, enum.Enum):
    UPCOMING = "upcoming"
    DUE_TODAY = "due_today"
    OVERDUE = "overdue"
    MANUAL = "manual"


class ReminderStatus(str, enum.Enum):
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


class ReminderLog(Base, TimestampMixin):
    __tablename__ = "reminder_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)

    reminder_type = Column(
        SQLEnum(ReminderType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    recipient_email = Column(String(255), nullable=False)
    status = Column(
        SQLEnum(ReminderStatus, values_callable=lambda x: [e.value for e in x]),
        default=ReminderStatus.SENT,
        nullable=False,
    )
    # Idempotency key prevents duplicate emails for the same invoice, date, and reminder tier
    idempotency_key = Column(String(128), unique=True, index=True, nullable=False)
    subject = Column(String(255), nullable=True)
    message_body = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="reminder_logs")
    invoice = relationship("Invoice", back_populates="reminder_logs")

    __table_args__ = (
        Index("ix_reminders_org_invoice", "organization_id", "invoice_id"),
    )
