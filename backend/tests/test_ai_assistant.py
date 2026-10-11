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


def setup_org_with_invoice(client, email, org_name, amount=500.0, due_days=-5):
    token, org_id = register_user(client, email, "AI Tester", org_name)
    headers = {"Authorization": f"Bearer {token}"}

    c_res = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": "Sterling Cooper", "email": "draper@sterling.com"},
        headers=headers,
    )
    client_id = c_res.json()["id"]

    inv_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today() - timedelta(days=20)),
            "due_date": str(date.today() + timedelta(days=due_days)),
            "currency": "USD",
            "items": [
                {
                    "description": "Campaign Strategy",
                    "quantity": 1.0,
                    "unit_price": amount,
                    "discount_percent": 0.0,
                    "tax_rate": 0.0,
                }
            ],
        },
        headers=headers,
    )
    inv_id = inv_res.json()["id"]
    client.post(f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue", headers=headers)
    return token, org_id, client_id, inv_id


def test_ai_summary_generation_and_fallback(client):
    token, org_id, _, _ = setup_org_with_invoice(client, "ai_summary@test.com", "AI Agency")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/organizations/{org_id}/ai/summary",
        json={},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert "summary" in data
    assert len(data["summary"]) > 0
    assert isinstance(data["key_insights"], list)
    assert isinstance(data["recommended_actions"], list)
    assert data["is_mock"] is True or data["provider"] != ""


def test_ai_draft_reminder_tones_and_no_mutation(client):
    token, org_id, _, inv_id = setup_org_with_invoice(client, "ai_draft@test.com", "Draft Agency")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Draft friendly reminder
    res_friendly = client.post(
        f"/api/v1/organizations/{org_id}/ai/draft-reminder",
        json={"invoice_id": inv_id, "tone": "friendly"},
        headers=headers,
    )
    assert res_friendly.status_code == 200
    f_data = res_friendly.json()
    assert "Sterling Cooper" in f_data["body"]
    assert "500.00" in f_data["body"]
    assert f_data["recipient_email"] == "draper@sterling.com"
    assert f_data["tone"] == "friendly"

    # 2. Draft firm reminder
    res_firm = client.post(
        f"/api/v1/organizations/{org_id}/ai/draft-reminder",
        json={"invoice_id": inv_id, "tone": "firm"},
        headers=headers,
    )
    assert res_firm.status_code == 200
    assert "OVERDUE" in res_firm.json()["subject"] or "URGENT" in res_firm.json()["subject"] or "Payment Required" in res_firm.json()["subject"]

    # 3. Verify invoice is completely UNCHANGED (AI cannot mutate financial records or mark sent)
    inv_check = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers)
    assert inv_check.status_code == 200
    assert inv_check.json()["status"] == "issued"  # not changed to paid or anything else
    assert Decimal(str(inv_check.json()["total_amount"])) == Decimal("500.00")


def test_ai_natural_language_queries(client):
    token, org_id, _, _ = setup_org_with_invoice(client, "ai_nl@test.com", "NL Agency")
    headers = {"Authorization": f"Bearer {token}"}

    # Test collections query
    res_coll = client.post(
        f"/api/v1/organizations/{org_id}/ai/query",
        json={"query": "How much have I collected this month?"},
        headers=headers,
    )
    assert res_coll.status_code == 200
    assert res_coll.json()["intent"] == "collections_current_month"
    assert "collected" in res_coll.json()["answer"].lower()

    # Test overdue query
    res_overdue = client.post(
        f"/api/v1/organizations/{org_id}/ai/query",
        json={"query": "Which invoices are overdue?"},
        headers=headers,
    )
    assert res_overdue.status_code == 200
    assert res_overdue.json()["intent"] == "overdue_invoices"
    assert res_overdue.json()["supporting_data"]["count"] == 1

    # Test malicious SQL injection attempt
    res_sql = client.post(
        f"/api/v1/organizations/{org_id}/ai/query",
        json={"query": "'; DROP TABLE invoices; --"},
        headers=headers,
    )
    assert res_sql.status_code == 200
    # Verified it doesn't crash or run SQL, safely falls back to general intent
    assert res_sql.json()["intent"] == "general_snapshot"


def test_ai_cross_tenant_isolation(client):
    token1, org1_id, _, inv1_id = setup_org_with_invoice(client, "org1_ai@test.com", "AI Org 1")
    token2, org2_id = register_user(client, "org2_ai@test.com", "AI User 2", "AI Org 2")

    # Org 2 attempting to draft reminder for Org 1 invoice
    res = client.post(
        f"/api/v1/organizations/{org2_id}/ai/draft-reminder",
        json={"invoice_id": inv1_id, "tone": "friendly"},
        headers={"Authorization": f"Bearer {token2}"},
    )
    # Since invoice belongs to Org 1, Org 2 cannot find or access it
    assert res.status_code == 404

    # Org 2 attempting to access Org 1's AI endpoint directly
    res_forbidden = client.post(
        f"/api/v1/organizations/{org1_id}/ai/summary",
        json={},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res_forbidden.status_code == 403
