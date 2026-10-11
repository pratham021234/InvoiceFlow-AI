from pydantic import BaseModel
from typing import Optional


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    database: str
    email_provider: str
    ai_provider: str
