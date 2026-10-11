import pytest


def register_user(client, email, name, org_name):
    res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": name,
        "organization_name": org_name,
    })
    assert res.status_code == 201
    data = res.json()
    return data["access_token"], data["active_organization"]["id"]


def test_client_crud_and_validation(client):
    token, org_id = register_user(client, "crm_owner@test.com", "CRM Owner", "CRM Agency")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create client
    client_payload = {
        "name": "Stark Industries",
        "contact_name": "Pepper Potts",
        "email": "pepper@stark.com",
        "phone": "+1-555-839-2019",
        "billing_address": "10880 Malibu Point, Malibu, CA",
        "country": "United States",
        "tax_id": "US-123456789",
        "currency": "USD",
        "notes": "VIP Enterprise Client",
    }
    res_create = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json=client_payload,
        headers=headers,
    )
    assert res_create.status_code == 201
    created_data = res_create.json()
    client_id = created_data["id"]
    assert created_data["name"] == "Stark Industries"
    assert created_data["contact_name"] == "Pepper Potts"
    assert created_data["is_archived"] is False

    # 2. Get client details
    res_get = client.get(
        f"/api/v1/organizations/{org_id}/clients/{client_id}",
        headers=headers,
    )
    assert res_get.status_code == 200
    detail = res_get.json()
    assert detail["name"] == "Stark Industries"
    assert detail["invoice_count"] == 0
    assert float(detail["total_invoiced"]) == 0.0

    # 3. Update client details
    res_patch = client.patch(
        f"/api/v1/organizations/{org_id}/clients/{client_id}",
        json={"phone": "+1-555-999-0000", "notes": "Updated VIP notes"},
        headers=headers,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["phone"] == "+1-555-999-0000"
    assert res_patch.json()["notes"] == "Updated VIP notes"

    # 4. List clients
    res_list = client.get(
        f"/api/v1/organizations/{org_id}/clients",
        headers=headers,
    )
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1


def test_client_search_and_pagination(client):
    token, org_id = register_user(client, "searcher@test.com", "Search User", "Search Corp")
    headers = {"Authorization": f"Bearer {token}"}

    # Create 3 clients
    client.post(f"/api/v1/organizations/{org_id}/clients", json={"name": "Alpha Corp", "email": "a@alpha.com"}, headers=headers)
    client.post(f"/api/v1/organizations/{org_id}/clients", json={"name": "Beta LLC", "email": "b@beta.com"}, headers=headers)
    client.post(f"/api/v1/organizations/{org_id}/clients", json={"name": "Gamma Partners", "email": "g@gamma.com"}, headers=headers)

    # Search for "Beta"
    res_search = client.get(
        f"/api/v1/organizations/{org_id}/clients?search=beta",
        headers=headers,
    )
    assert res_search.status_code == 200
    results = res_search.json()
    assert len(results) == 1
    assert results[0]["name"] == "Beta LLC"


def test_client_archive_and_restore(client):
    token, org_id = register_user(client, "archive_user@test.com", "Archive User", "Archive Corp")
    headers = {"Authorization": f"Bearer {token}"}

    res_create = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": "Temporary Client"},
        headers=headers,
    )
    client_id = res_create.json()["id"]

    # Archive client
    res_archive = client.post(
        f"/api/v1/organizations/{org_id}/clients/{client_id}/archive",
        headers=headers,
    )
    assert res_archive.status_code == 200
    assert res_archive.json()["is_archived"] is True

    # Active list should NOT include archived client
    res_active = client.get(
        f"/api/v1/organizations/{org_id}/clients?is_archived=false",
        headers=headers,
    )
    assert len(res_active.json()) == 0

    # Archived filter SHOULD include it
    res_archived = client.get(
        f"/api/v1/organizations/{org_id}/clients?is_archived=true",
        headers=headers,
    )
    assert len(res_archived.json()) == 1

    # Restore client
    res_restore = client.post(
        f"/api/v1/organizations/{org_id}/clients/{client_id}/restore",
        headers=headers,
    )
    assert res_restore.status_code == 200
    assert res_restore.json()["is_archived"] is False


def test_client_tenant_isolation(client):
    """Verifies that Org B cannot view or edit Org A's clients."""
    token_a, org_a_id = register_user(client, "alice_crm@test.com", "Alice CRM", "Alice Org")
    token_b, org_b_id = register_user(client, "bob_crm@test.com", "Bob CRM", "Bob Org")

    # Alice creates a client in Org A
    res_alice = client.post(
        f"/api/v1/organizations/{org_a_id}/clients",
        json={"name": "Alice Private Client", "email": "private@alice.com"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    client_a_id = res_alice.json()["id"]

    # Bob attempts to GET Alice's client using Bob's credentials and Org A in path -> rejected 403
    res_unauth1 = client.get(
        f"/api/v1/organizations/{org_a_id}/clients/{client_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_unauth1.status_code == 403

    # Bob attempts to GET Alice's client using Bob's org in path -> rejected 404 (not in Bob's org)
    res_unauth2 = client.get(
        f"/api/v1/organizations/{org_b_id}/clients/{client_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_unauth2.status_code == 404
