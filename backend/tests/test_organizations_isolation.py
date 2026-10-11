import pytest
from app.models.organization import MemberRole, MembershipStatus, OrganizationMember


def register_user_and_get_token(client, email, name, org_name):
    res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": name,
        "organization_name": org_name,
    })
    assert res.status_code == 201
    data = res.json()
    return data["access_token"], data["active_organization"]["id"]


def test_organization_creation_and_listing(client):
    token, org1_id = register_user_and_get_token(
        client, "multi@org.com", "Multi User", "Org Alpha"
    )

    # Create second organization
    res_create = client.post(
        "/api/v1/organizations",
        json={"name": "Org Beta", "currency": "EUR"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_create.status_code == 201
    org2_data = res_create.json()
    assert org2_data["name"] == "Org Beta"
    assert org2_data["currency"] == "EUR"
    assert org2_data["user_role"] == "owner"

    # List organizations
    res_list = client.get(
        "/api/v1/organizations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_list.status_code == 200
    org_list = res_list.json()
    assert len(org_list) == 2
    org_names = [o["name"] for o in org_list]
    assert "Org Alpha" in org_names
    assert "Org Beta" in org_names


def test_cross_tenant_access_is_rejected(client):
    """
    CRITICAL SECURITY REGRESSION TEST:
    Verifies that User B belonging to Org B cannot access or modify Org A.
    """
    token_a, org_a_id = register_user_and_get_token(
        client, "alice@tenant-a.com", "Alice A", "Tenant A Corp"
    )
    token_b, org_b_id = register_user_and_get_token(
        client, "bob@tenant-b.com", "Bob B", "Tenant B Ltd"
    )

    # 1. Bob attempts to GET Alice's organization details
    res_unauth_get = client.get(
        f"/api/v1/organizations/{org_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_unauth_get.status_code == 403
    assert "Access denied" in res_unauth_get.json()["detail"]

    # 2. Bob attempts to PATCH Alice's organization settings
    res_unauth_patch = client.patch(
        f"/api/v1/organizations/{org_a_id}",
        json={"name": "Hacked Tenant Name"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_unauth_patch.status_code == 403

    # 3. Verify Alice's organization remains unaltered
    res_alice_get = client.get(
        f"/api/v1/organizations/{org_a_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_alice_get.status_code == 200
    assert res_alice_get.json()["name"] == "Tenant A Corp"


def test_role_based_permissions_on_organization_settings(client, db_session):
    """
    Verifies that a MEMBER cannot update organization settings, but an OWNER can.
    """
    token_owner, org_id = register_user_and_get_token(
        client, "owner@company.com", "Owner User", "Company X"
    )
    token_member, _ = register_user_and_get_token(
        client, "member@company.com", "Member User", "Member Personal Org"
    )

    # Retrieve member's user ID
    res_me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_member}"},
    )
    member_user_id = res_me.json()["id"]

    # Add this user as a MEMBER to Company X in the database
    member_record = OrganizationMember(
        organization_id=org_id,
        user_id=member_user_id,
        role=MemberRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(member_record)
    db_session.commit()

    # Member can view details
    res_view = client.get(
        f"/api/v1/organizations/{org_id}",
        headers={"Authorization": f"Bearer {token_member}"},
    )
    assert res_view.status_code == 200
    assert res_view.json()["name"] == "Company X"

    # Member ATTEMPTS to update settings -> should receive 403 Forbidden
    res_patch_forbidden = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Member Renamed Company"},
        headers={"Authorization": f"Bearer {token_member}"},
    )
    assert res_patch_forbidden.status_code == 403
    assert "role" in res_patch_forbidden.json()["detail"].lower()

    # Owner can update settings successfully
    res_patch_success = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Company X Renovated", "country": "Canada"},
        headers={"Authorization": f"Bearer {token_owner}"},
    )
    assert res_patch_success.status_code == 200
    assert res_patch_success.json()["name"] == "Company X Renovated"
    assert res_patch_success.json()["country"] == "Canada"
