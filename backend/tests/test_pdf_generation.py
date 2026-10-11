from datetime import date, timedelta
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


def test_invoice_pdf_generation_endpoint(client):
    token, org_id = register_user(client, "pdf_test@test.com", "PDF Tester", "PDF Studio")
    headers = {"Authorization": f"Bearer {token}"}

    # Create client
    res_client = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={
            "name": "Global Media Corp",
            "contact_name": "Marcus Kane",
            "email": "marcus@globalmedia.com",
            "billing_address": "450 Lexington Ave, New York, NY",
        },
        headers=headers,
    )
    client_id = res_client.json()["id"]

    # Create & Issue invoice
    res_inv = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today() + timedelta(days=30)),
            "currency": "USD",
            "notes": "Thank you for your business. Please wire funds promptly.",
            "payment_terms": "Net 30",
            "items": [
                {
                    "description": "Full-Stack Development (Sprint 1)",
                    "quantity": 40.0,
                    "unit_price": 125.0,
                    "discount_percent": 5.0,
                    "tax_rate": 8.0,
                },
                {
                    "description": "Cloud Hosting & DevOps Setup",
                    "quantity": 1.0,
                    "unit_price": 450.0,
                    "discount_percent": 0.0,
                    "tax_rate": 8.0,
                },
            ],
        },
        headers=headers,
    )
    inv_id = res_inv.json()["id"]

    # Issue invoice to get official number
    client.post(f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue", headers=headers)

    # Download PDF
    res_pdf = client.get(
        f"/api/v1/organizations/{org_id}/invoices/{inv_id}/pdf",
        headers=headers,
    )
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in res_pdf.headers["content-disposition"]
    assert "INV-1001" in res_pdf.headers["content-disposition"]

    pdf_bytes = res_pdf.content
    assert len(pdf_bytes) > 1000
    # PDF magic bytes
    assert pdf_bytes.startswith(b"%PDF-")


def test_cross_tenant_pdf_access_rejection(client):
    token_a, org_a = register_user(client, "alice_pdf@test.com", "Alice PDF", "Org A")
    token_b, org_b = register_user(client, "bob_pdf@test.com", "Bob PDF", "Org B")

    # Alice creates a client & invoice
    res_client = client.post(
        f"/api/v1/organizations/{org_a}/clients",
        json={"name": "Alice Client"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    client_a_id = res_client.json()["id"]

    res_inv = client.post(
        f"/api/v1/organizations/{org_a}/invoices",
        json={
            "client_id": client_a_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today()),
            "items": [{"description": "Private Design", "quantity": 1, "unit_price": 500}],
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    inv_a_id = res_inv.json()["id"]

    # Bob attempts to download Alice's invoice PDF -> rejected 403
    res_unauth_pdf = client.get(
        f"/api/v1/organizations/{org_a}/invoices/{inv_a_id}/pdf",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_unauth_pdf.status_code == 403
