from typing import Optional
from pydantic import BaseModel
from app.schemas.user import UserResponse
from app.schemas.organization import OrganizationResponse


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    active_organization: Optional[OrganizationResponse] = None
