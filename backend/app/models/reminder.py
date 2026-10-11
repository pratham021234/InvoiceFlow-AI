import enum
from sqlalchemy import Column, String, Text, ForeignKey, Enum as SQLEnum, Index, DateTime, Integer
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


class EmailType(str, enum.Enum):
    INVOICE_SEND = "invoice_send"
    PAYMENT_REMINDER = "payment_reminder"
    PAYMENT_RECEIPT = "payment_receipt"
    MANUAL = "manual"


class EmailStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    ACCEPTED_BY_PROVIDER = "accepted_by_provider"
    FAILED = "failed"


class EmailLog(Base, TimestampMixin):
    __tablename__ = "email_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id = Column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)

    notification_type = Column(
        SQLEnum(EmailType, values_callable=lambda x: [e.value for e in x]),
        default=EmailType.INVOICE_SEND,
        nullable=False,
    )
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    delivery_status = Column(
        SQLEnum(EmailStatus, values_callable=lambda x: [e.value for e in x]),
        default=EmailStatus.QUEUED,
        nullable=False,
        index=True,
    )
    provider_message_id = Column(String(255), nullable=True)
    attempt_count = Column(Integer, default=1, nullable=False)
    last_attempt_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    error_message = Column(Text, nullable=True)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="email_logs")
    invoice = relationship("Invoice", back_populates="email_logs")
    client = relationship("Client", back_populates="email_logs")

    __table_args__ = (
        Index("ix_email_logs_org_status", "organization_id", "delivery_status"),
        Index("ix_email_logs_org_invoice", "organization_id", "invoice_id"),
    )
