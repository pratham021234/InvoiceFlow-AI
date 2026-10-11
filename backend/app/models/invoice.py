import enum
import secrets
from sqlalchemy import (
    Column,
    String,
    Text,
    Numeric,
    Date,
    DateTime,
    Integer,
    Boolean,
    ForeignKey,
    Enum as SQLEnum,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import generate_uuid, TimestampMixin


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


def generate_public_token() -> str:
    """Generate a high-entropy, URL-safe random token for revocable sharing."""
    return secrets.token_urlsafe(32)


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    client_id = Column(String(36), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True)

    invoice_number = Column(String(50), nullable=False)
    status = Column(
        SQLEnum(InvoiceStatus, values_callable=lambda x: [e.value for e in x]),
        default=InvoiceStatus.DRAFT,
        nullable=False,
        index=True,
    )
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    currency = Column(String(3), default="USD", nullable=False)

    # Exact monetary amounts stored with 2 decimal precision
    subtotal = Column(Numeric(14, 2), default=0.00, nullable=False)
    discount_amount = Column(Numeric(14, 2), default=0.00, nullable=False)
    tax_amount = Column(Numeric(14, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(14, 2), default=0.00, nullable=False)
    amount_paid = Column(Numeric(14, 2), default=0.00, nullable=False)
    balance_due = Column(Numeric(14, 2), default=0.00, nullable=False)

    notes = Column(Text, nullable=True)
    payment_terms = Column(String(255), nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(String(500), nullable=True)

    # Public revocable share link token
    public_token = Column(String(64), unique=True, index=True, default=generate_public_token, nullable=False)
    public_token_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="invoices")
    client = relationship("Client", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.display_order")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    reminder_logs = relationship("ReminderLog", back_populates="invoice", cascade="all, delete-orphan")

    @property
    def effective_status(self) -> InvoiceStatus:
        from datetime import date
        from decimal import Decimal
        if self.status == InvoiceStatus.CANCELLED:
            return InvoiceStatus.CANCELLED
        if self.status == InvoiceStatus.DRAFT:
            return InvoiceStatus.DRAFT

        balance = Decimal(str(self.balance_due)) if self.balance_due is not None else Decimal("0.00")
        total = Decimal(str(self.total_amount)) if self.total_amount is not None else Decimal("0.00")
        paid = Decimal(str(self.amount_paid)) if self.amount_paid is not None else Decimal("0.00")

        if balance <= Decimal("0.00") and total > Decimal("0.00"):
            return InvoiceStatus.PAID

        today = date.today()
        if self.due_date and self.due_date < today and balance > Decimal("0.00"):
            return InvoiceStatus.OVERDUE

        if paid > Decimal("0.00") and balance > Decimal("0.00"):
            return InvoiceStatus.PARTIALLY_PAID

        return self.status

    __table_args__ = (
        UniqueConstraint("organization_id", "invoice_number", name="uq_org_invoice_number"),
        Index("ix_invoices_org_status", "organization_id", "status"),
        Index("ix_invoices_org_due", "organization_id", "due_date"),
    )


class InvoiceItem(Base, TimestampMixin):
    __tablename__ = "invoice_items"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)

    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(12, 4), default=1.0000, nullable=False)
    unit_price = Column(Numeric(14, 2), default=0.00, nullable=False)
    discount_percent = Column(Numeric(6, 2), default=0.00, nullable=False)
    tax_rate = Column(Numeric(6, 2), default=0.00, nullable=False)

    # Calculated exact line values
    line_subtotal = Column(Numeric(14, 2), default=0.00, nullable=False)
    line_discount = Column(Numeric(14, 2), default=0.00, nullable=False)
    line_tax = Column(Numeric(14, 2), default=0.00, nullable=False)
    line_total = Column(Numeric(14, 2), default=0.00, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
