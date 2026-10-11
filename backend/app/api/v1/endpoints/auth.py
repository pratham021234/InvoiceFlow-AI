from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.organization import OrganizationCreate, OrganizationResponse
from app.schemas.token import TokenResponse
from app.services.user_service import create_user, authenticate_user
from app.services.organization_service import (
    create_organization,
    get_user_organizations,
)
from app.services.audit_service import log_security_event

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user account, normalizes email, and creates an initial organization workspace.
    """
    try:
        user = create_user(db, user_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Automatically create initial workspace for the newly registered user
    org_name = user_in.organization_name or f"{user.full_name}'s Workspace"
    initial_org = create_organization(
        db,
        user_id=user.id,
        org_in=OrganizationCreate(name=org_name),
    )

    log_security_event(
        db=db,
        organization_id=initial_org.id,
        action="user_registered",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details={"email": user.email},
    )

    access_token = create_access_token(
        subject=user.id,
        organization_id=initial_org.id,
        role="owner",
    )

    org_resp = OrganizationResponse.model_validate(initial_org)
    org_resp.user_role = initial_org.members[0].role

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        active_organization=org_resp,
    )


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates user using email and password. Returns generic error message on failure.
    """
    user = authenticate_user(db, email=login_data.email, password=login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Retrieve user's organizations
    user_orgs = get_user_organizations(db, user_id=user.id)
    active_org = None
    role_str = "member"

    if user_orgs:
        first_org, first_role = user_orgs[0]
        role_str = first_role.value
        active_org = OrganizationResponse.model_validate(first_org)
        active_org.user_role = first_role
        
        log_security_event(
            db=db,
            organization_id=first_org.id,
            action="user_login",
            entity_type="user",
            entity_id=user.id,
            user_id=user.id,
        )

    access_token = create_access_token(
        subject=user.id,
        organization_id=active_org.id if active_org else None,
        role=role_str,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        active_organization=active_org,
    )


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Logs out the user and invalidates client session state.
    """
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated user's profile.
    """
    return UserResponse.model_validate(current_user)
