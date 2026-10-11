import re
import uuid
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.organization import Organization, OrganizationMember, MemberRole, MembershipStatus
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text or "org"


def generate_unique_slug(db: Session, base_name: str) -> str:
    base_slug = slugify(base_name)
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first() is not None:
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


def create_organization(db: Session, user_id: str, org_in: OrganizationCreate) -> Organization:
    slug = org_in.slug
    if not slug:
        slug = generate_unique_slug(db, org_in.name)
    else:
        # Check explicit slug uniqueness
        existing = db.query(Organization).filter(Organization.slug == slug).first()
        if existing:
            slug = generate_unique_slug(db, org_in.slug)

    org = Organization(
        name=org_in.name.strip(),
        slug=slug,
        owner_id=user_id,
        email=org_in.email,
        phone=org_in.phone,
        address=org_in.address,
        country=org_in.country,
        currency=org_in.currency.upper(),
        timezone=org_in.timezone,
        tax_id=org_in.tax_id,
        logo_url=org_in.logo_url,
        invoice_prefix=org_in.invoice_prefix.strip().upper(),
        next_invoice_number="1001",
        payment_instructions=org_in.payment_instructions,
    )
    db.add(org)
    db.flush()

    # Automatically add creator as OWNER member with ACTIVE status
    member = OrganizationMember(
        organization_id=org.id,
        user_id=user_id,
        role=MemberRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    db.add(member)
    db.commit()
    db.refresh(org)
    return org


def get_user_organizations(db: Session, user_id: str) -> List[Tuple[Organization, MemberRole]]:
    """Returns list of organizations where the user has active membership, paired with their role."""
    memberships = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == MembershipStatus.ACTIVE,
        )
        .all()
    )
    results = []
    for m in memberships:
        org = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if org:
            results.append((org, m.role))
    return results


def get_membership(db: Session, org_id: str, user_id: str) -> Optional[OrganizationMember]:
    return (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == MembershipStatus.ACTIVE,
        )
        .first()
    )


def get_organization_for_user(db: Session, org_id: str, user_id: str) -> Optional[Tuple[Organization, MemberRole]]:
    member = get_membership(db, org_id, user_id)
    if not member:
        return None
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        return None
    return org, member.role


def update_organization(
    db: Session,
    org_id: str,
    user_id: str,
    org_update: OrganizationUpdate,
) -> Organization:
    member = get_membership(db, org_id, user_id)
    if not member:
        raise PermissionError("You do not have access to this organization.")

    # Only OWNER and ADMIN can update organization settings
    if member.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise PermissionError("Only organization owners and administrators can modify settings.")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise ValueError("Organization not found.")

    update_data = org_update.model_dump(exclude_unset=True)
    if "currency" in update_data and update_data["currency"]:
        update_data["currency"] = update_data["currency"].upper()
    if "invoice_prefix" in update_data and update_data["invoice_prefix"]:
        update_data["invoice_prefix"] = update_data["invoice_prefix"].strip().upper()

    for field, value in update_data.items():
        setattr(org, field, value)

    db.commit()
    db.refresh(org)
    return org
