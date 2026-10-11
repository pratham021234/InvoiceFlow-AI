from sqlalchemy import Column, String, Text, ForeignKey, Index, DateTime
from app.core.database import Base
from app.models.base import generate_uuid, utc_now


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    entity_type = Column(String(50), nullable=False)  # invoice, payment, client, organization
    entity_id = Column(String(36), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # create, update, issue, cancel, payment, delete
    changes_json = Column(Text, nullable=True)  # JSON serialized diff
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    __table_args__ = (
        Index("ix_audit_org_entity", "organization_id", "entity_type", "entity_id"),
    )
