from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_active_org_member, RoleChecker
from app.models.user import User
from app.models.organization import MemberRole, OrganizationMember
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationDetailResponse,
    OrganizationMemberResponse,
)
from app.services.organization_service import (
    create_organization,
    get_user_organizations,
    get_organization_for_user,
    update_organization,
)
from app.services.audit_service import log_security_event

router = APIRouter()


@router.get("", response_model=List[OrganizationResponse])
def list_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all organizations where the authenticated user has an active membership.
    """
    org_pairs = get_user_organizations(db, user_id=current_user.id)
    responses = []
    for org, role in org_pairs:
        resp = OrganizationResponse.model_validate(org)
        resp.user_role = role
        responses.append(resp)
    return responses


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_new_organization(
    org_in: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new organization. The calling user automatically becomes the OWNER.
    """
    org = create_organization(db, user_id=current_user.id, org_in=org_in)

    log_security_event(
        db=db,
        organization_id=org.id,
        action="organization_created",
        entity_type="organization",
        entity_id=org.id,
        user_id=current_user.id,
        details={"name": org.name, "currency": org.currency},
    )

    resp = OrganizationResponse.model_validate(org)
    resp.user_role = MemberRole.OWNER
    return resp


@router.get("/{organization_id}", response_model=OrganizationDetailResponse)
def get_organization_details(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(get_current_active_org_member),
    db: Session = Depends(get_db),
):
    """
    Returns organization details and member roster.
    Requires active membership in the organization.
    """
    pair = get_organization_for_user(db, org_id=organization_id, user_id=current_user.id)
    if not pair:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found.",
        )
    org, role = pair

    resp = OrganizationDetailResponse.model_validate(org)
    resp.user_role = role
    resp.members = [
        OrganizationMemberResponse(
            id=m.id,
            organization_id=m.organization_id,
            user_id=m.user_id,
            role=m.role,
            status=m.status,
            user_email=m.user.email if m.user else None,
            user_name=m.user.full_name if m.user else None,
            created_at=m.created_at,
        )
        for m in org.members
    ]
    return resp


@router.patch("/{organization_id}", response_model=OrganizationResponse)
def update_organization_settings(
    organization_id: str,
    org_update: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    membership: OrganizationMember = Depends(
        RoleChecker([MemberRole.OWNER, MemberRole.ADMIN])
    ),
    db: Session = Depends(get_db),
):
    """
    Updates organization profile and settings.
    Requires OWNER or ADMIN role in the target organization.
    """
    try:
        updated_org = update_organization(
            db=db,
            org_id=organization_id,
            user_id=current_user.id,
            org_update=org_update,
        )
    except PermissionError as pe:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(pe),
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve),
        )

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="organization_updated",
        entity_type="organization",
        entity_id=organization_id,
        user_id=current_user.id,
        details=org_update.model_dump(exclude_unset=True),
    )

    resp = OrganizationResponse.model_validate(updated_org)
    resp.user_role = membership.role
    return resp
