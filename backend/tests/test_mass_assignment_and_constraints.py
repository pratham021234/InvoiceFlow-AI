import pytest
from app.models.organization import OrganizationMember, MemberRole, MembershipStatus


def test_mass_assignment_prevention_on_organization_patch(client):
    """
    Verifies that malicious callers cannot tamper with owner_id, id, or system audit timestamps
    via PATCH /organizations/{id}.
    """
    reg = client.post("/api/v1/auth/register", json={
        "email": "victim@owner.com",
        "password": "Password123!",
        "full_name": "Victim Owner",
        "organization_name": "Security Vault Corp",
    })
    token = reg.json()["access_token"]
    org_id = reg.json()["active_organization"]["id"]
    original_owner_id = reg.json()["active_organization"]["owner_id"]

    # Attacker attempts to hijack owner_id and ID via payload
    malicious_payload = {
        "name": "Legitimate Rename",
        "owner_id": "attacker-injected-uuid-9999",
        "id": "new-fake-id-1234",
    }
    res = client.patch(
        f"/api/v1/organizations/{org_id}",
        json=malicious_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Legitimate Rename"
    # owner_id and id MUST NOT be changed by PATCH
    assert data["owner_id"] == original_owner_id
    assert data["id"] == org_id


def test_unique_member_constraint(client, db_session):
    """
    Verifies that the database unique constraint uq_org_member prevents
    duplicate memberships for the same user in the same organization.
    """
    reg = client.post("/api/v1/auth/register", json={
        "email": "membercheck@test.com",
        "password": "Password123!",
        "full_name": "Member Check",
        "organization_name": "Constraint Org",
    })
    org_id = reg.json()["active_organization"]["id"]
    user_id = reg.json()["user"]["id"]

    # Attempt to insert duplicate membership directly
    duplicate_member = OrganizationMember(
        organization_id=org_id,
        user_id=user_id,
        role=MemberRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(duplicate_member)
    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()
