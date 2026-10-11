from datetime import date, timedelta
from decimal import Decimal
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


def create_test_client(client, token, org_id, name="Acme Corp"):
    res = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": name, "email": "billing@acme.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_invoice_creation_calculations_and_draft_state(client):
    token, org_id = register_user(client, "inv_creator@test.com", "Inv Creator", "Invoice Test Org")
    client_id = create_test_client(client, token, org_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Invoice with 2 line items:
    # Item 1: 3.5 hrs @ $150.00 = 525.00, 10% disc = 52.50 -> 472.50 taxable, 8.25% tax = 38.98 -> 511.48
    # Item 2: 1 setup fee @ $200.00 = 200.00, 0% disc, 10% tax = 20.00 -> 220.00
    # Expected totals:
    # Subtotal: 725.00, Discounts: 52.50, Taxes: 58.98, Total: 731.48
    payload = {
        "client_id": client_id,
        "issue_date": str(date.today()),
        "due_date": str(date.today() + timedelta(days=14)),
        "currency": "USD",
        "notes": "Net 14 payment terms apply.",
        "payment_terms": "Due in 14 days",
        "items": [
            {
                "description": "Senior Consulting Hours",
                "quantity": 3.5,
                "unit_price": 150.00,
                "discount_percent": 10.0,
                "tax_rate": 8.25,
            },
            {
                "description": "Initial Setup Fee",
                "quantity": 1.0,
                "unit_price": 200.00,
                "discount_percent": 0.0,
                "tax_rate": 10.0,
            },
        ],
    }

    res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()

    assert data["status"] == "draft"
    assert data["invoice_number"].startswith("DRAFT-")
    assert Decimal(str(data["subtotal"])) == Decimal("725.00")
    assert Decimal(str(data["discount_amount"])) == Decimal("52.50")
    assert Decimal(str(data["tax_amount"])) == Decimal("58.98")
    assert Decimal(str(data["total_amount"])) == Decimal("731.48")
    assert Decimal(str(data["balance_due"])) == Decimal("731.48")
    assert Decimal(str(data["amount_paid"])) == Decimal("0.00")
    assert len(data["items"]) == 2


def test_invoice_issuance_assigns_sequential_number(client):
    token, org_id = register_user(client, "issuer@test.com", "Issuer", "Sequence Org")
    client_id = create_test_client(client, token, org_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Create 2 draft invoices
    def make_draft():
        return client.post(
            f"/api/v1/organizations/{org_id}/invoices",
            json={
                "client_id": client_id,
                "issue_date": str(date.today()),
                "due_date": str(date.today() + timedelta(days=30)),
                "currency": "USD",
                "items": [{"description": "Service item", "quantity": 1, "unit_price": 100}],
            },
            headers=headers,
        ).json()["id"]

    inv1_id = make_draft()
    inv2_id = make_draft()

    # Issue Invoice 1
    res_issue1 = client.post(
        f"/api/v1/organizations/{org_id}/invoices/{inv1_id}/issue",
        headers=headers,
    )
    assert res_issue1.status_code == 200
    data1 = res_issue1.json()
    assert data1["status"] == "issued"
    assert data1["invoice_number"] == "INV-1001"
    assert data1["issued_at"] is not None

    # Issue Invoice 2
    res_issue2 = client.post(
        f"/api/v1/organizations/{org_id}/invoices/{inv2_id}/issue",
        headers=headers,
    )
    assert res_issue2.status_code == 200
    data2 = res_issue2.json()
    assert data2["status"] == "issued"
    assert data2["invoice_number"] == "INV-1002"

    # Verify that attempting to edit an issued invoice is rejected!
    res_edit_rejected = client.patch(
        f"/api/v1/organizations/{org_id}/invoices/{inv1_id}",
        json={"notes": "Sneaky modification after issuance"},
        headers=headers,
    )
    assert res_edit_rejected.status_code == 400
    assert "Cannot modify" in res_edit_rejected.json()["detail"]


def test_invoice_cancellation_and_duplication(client):
    token, org_id = register_user(client, "cancel_user@test.com", "Canceler", "Cancel Org")
    client_id = create_test_client(client, token, org_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Create & Issue invoice
    res_draft = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today() + timedelta(days=15)),
            "currency": "USD",
            "items": [{"description": "Website Design", "quantity": 1, "unit_price": 1200}],
        },
        headers=headers,
    )
    inv_id = res_draft.json()["id"]
    client.post(f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue", headers=headers)

    # Cancel invoice
    res_cancel = client.post(
        f"/api/v1/organizations/{org_id}/invoices/{inv_id}/cancel",
        json={"reason": "Client altered project scope."},
        headers=headers,
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "cancelled"
    assert res_cancel.json()["cancellation_reason"] == "Client altered project scope."

    # Duplicate invoice
    res_dup = client.post(
        f"/api/v1/organizations/{org_id}/invoices/{inv_id}/duplicate",
        headers=headers,
    )
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["status"] == "draft"
    assert dup_data["id"] != inv_id
    assert len(dup_data["items"]) == 1
    assert dup_data["items"][0]["description"] == "Website Design"


def test_delete_draft_permitted_delete_issued_forbidden(client):
    token, org_id = register_user(client, "deleter@test.com", "Deleter", "Delete Org")
    client_id = create_test_client(client, token, org_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Draft can be deleted
    draft_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today()),
            "items": [{"description": "To be discarded", "quantity": 1, "unit_price": 50}],
        },
        headers=headers,
    )
    draft_id = draft_res.json()["id"]
    res_del_draft = client.delete(f"/api/v1/organizations/{org_id}/invoices/{draft_id}", headers=headers)
    assert res_del_draft.status_code == 204

    # Issued invoice CANNOT be deleted
    inv2_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today()),
            "items": [{"description": "Permanent record", "quantity": 1, "unit_price": 100}],
        },
        headers=headers,
    )
    inv2_id = inv2_res.json()["id"]
    client.post(f"/api/v1/organizations/{org_id}/invoices/{inv2_id}/issue", headers=headers)

    res_del_issued = client.delete(f"/api/v1/organizations/{org_id}/invoices/{inv2_id}", headers=headers)
    assert res_del_issued.status_code == 400
    assert "Only draft invoices can be deleted" in res_del_issued.json()["detail"]


def test_cross_tenant_invoice_access_and_client_ownership_validation(client):
    """
    CRITICAL SECURITY TESTS:
    1. Attaching a client belonging to Org B to an invoice in Org A must be REJECTED.
    2. User in Org B cannot read or edit Org A's invoices.
    """
    token_a, org_a = register_user(client, "alice_inv@test.com", "Alice", "Alice Org")
    token_b, org_b = register_user(client, "bob_inv@test.com", "Bob", "Bob Org")

    client_a = create_test_client(client, token_a, org_a, "Alice Client")
    client_b = create_test_client(client, token_b, org_b, "Bob Client")

    # 1. Alice attempts to create an invoice in Org A referencing Bob's client_b -> rejected 400
    res_invalid_client = client.post(
        f"/api/v1/organizations/{org_a}/invoices",
        json={
            "client_id": client_b,  # Client belonging to Bob's org!
            "issue_date": str(date.today()),
            "due_date": str(date.today()),
            "items": [{"description": "Unauthorized cross-client invoice", "quantity": 1, "unit_price": 50}],
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_invalid_client.status_code == 400
    assert "Selected client does not exist or does not belong to this organization" in res_invalid_client.json()["detail"]

    # 2. Alice creates a valid invoice in Org A
    res_alice_inv = client.post(
        f"/api/v1/organizations/{org_a}/invoices",
        json={
            "client_id": client_a,
            "issue_date": str(date.today()),
            "due_date": str(date.today()),
            "items": [{"description": "Alice Item", "quantity": 1, "unit_price": 50}],
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    inv_a_id = res_alice_inv.json()["id"]

    # 3. Bob attempts to GET Alice's invoice -> rejected
    res_unauth_get = client.get(
        f"/api/v1/organizations/{org_a}/invoices/{inv_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_unauth_get.status_code == 403

    # 4. Bob attempts to PATCH Alice's invoice using Bob's org in path -> 404 (not in Bob's org)
    res_unauth_patch = client.patch(
        f"/api/v1/organizations/{org_b}/invoices/{inv_a_id}",
        json={"notes": "Hacked"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_unauth_patch.status_code == 404
