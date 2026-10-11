import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "InvoiceFlow AI"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "invoiceflow-super-secret-production-key-change-in-production-2026-xyz"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = "sqlite:///./invoiceflow.db"
    
    # Multi-tenant and security
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return ["*"]

    # Transactional Email configuration
    EMAIL_PROVIDER: str = "mock"  # "mock", "smtp", "postmark", "sendgrid"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAIL_FROM: str = "invoices@invoiceflow.local"
    EMAIL_FROM_NAME: str = "InvoiceFlow AI"

    # AI Configuration
    AI_PROVIDER: str = "mock"  # "mock", "openai", "none"
    OPENAI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o-mini"
    
    # Public URL
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
