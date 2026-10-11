import json
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

logger = logging.getLogger("invoiceflow.security")


def log_security_event(
    db: Session,
    organization_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """
    Persists an immutable audit log entry for security and data change tracking.
    Never pass passwords, tokens, or raw credentials in details!
    """
    sanitized_details = {}
    if details:
        # Strip any accidental sensitive keys
        forbidden_keys = {"password", "token", "secret", "hashed_password", "access_token"}
        sanitized_details = {k: v for k, v in details.items() if k.lower() not in forbidden_keys}

    changes_json = json.dumps(sanitized_details) if sanitized_details else None

    entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changes_json=changes_json,
    )
    db.add(entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record audit log: {e}")

    logger.info(f"Audit event: user={user_id} org={organization_id} action={action} entity={entity_type}:{entity_id}")
    return entry
