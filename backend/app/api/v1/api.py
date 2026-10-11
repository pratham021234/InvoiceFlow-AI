from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    organizations,
    clients,
    invoices,
    payments,
    receivables,
    emails,
    analytics,
    ai,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(clients.router, prefix="/organizations/{organization_id}/clients", tags=["Clients"])
api_router.include_router(invoices.router, prefix="/organizations/{organization_id}/invoices", tags=["Invoices"])
api_router.include_router(payments.router, prefix="/organizations/{organization_id}/payments", tags=["Payments"])
api_router.include_router(receivables.router, prefix="/organizations/{organization_id}/receivables", tags=["Receivables"])
api_router.include_router(emails.router, prefix="/organizations/{organization_id}", tags=["Emails & Reminders"])
api_router.include_router(analytics.router, prefix="/organizations/{organization_id}/analytics", tags=["Analytics & Reports"])
api_router.include_router(ai.router, prefix="/organizations/{organization_id}/ai", tags=["AI Assistant"])




