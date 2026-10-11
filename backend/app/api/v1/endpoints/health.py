from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    """Comprehensive service and database health check."""
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return HealthResponse(
        status="ok" if db_status == "ok" else "degraded",
        app_name=settings.PROJECT_NAME,
        version="1.0.0",
        database=db_status,
        email_provider=settings.EMAIL_PROVIDER,
        ai_provider=settings.AI_PROVIDER,
    )
