from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, organizations, clients, invoices

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(clients.router, prefix="/organizations/{organization_id}/clients", tags=["Clients"])
api_router.include_router(invoices.router, prefix="/organizations/{organization_id}/invoices", tags=["Invoices"])


