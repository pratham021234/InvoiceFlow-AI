from datetime import date, timedelta
from decimal import Decimal
import io
import csv
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient


def test_customer_journey_e2e(client: TestClient):
    """
    Comprehensive End-to-End Test for the Complete Customer Journey:
    1. Register user and initial organization workspace
    2. Sign in and verify token authentication
    3. Update organization business profile and invoice settings
    4. Client CRM: Create, edit, and verify client
    5. Create an invoice with multiple line items (discounts & taxes)
    6. Verify financial engine calculations (subtotal, tax, discount, total)
    7. Issue invoice and verify sequential invoice numbering
    8. Generate and download PDF invoice (stream & header check)
    9. Record partial payment and verify balance reconciliation
    10. Record remaining payment and verify transition to 'paid'
    11. Verify accounts receivable aging and summary KPIs
    12. Dispatch email payment reminder under safe mock provider
    13. Retrieve financial analytics overview and export CSV reports
    14. Query AI receivables assistant for summary and query
    15. Verify multi-tenant isolation: Organization B cannot access Organization A's records
    """

    # =========================================================================
    # STEP 1 & 2: Register user and sign in
    # =========================================================================
    user_payload = {
        "email": "journey.owner@acmecorp.example",
        "password": "Password123!",
        "full_name": "Jordan Architect",
        "organization_name": "Acme Engineering Corp",
    }
    reg_resp = client.post("/api/v1/auth/register", json=user_payload)
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
    reg_data = reg_resp.json()
    token_a = reg_data["access_token"]
    org_a = reg_data["active_organization"]
    org_a_id = org_a["id"]
    headers_a = {
        "Authorization": f"Bearer {token_a}",
    }

    # Verify sign-in endpoint
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "journey.owner@acmecorp.example", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["access_token"] is not None

    # =========================================================================
    # STEP 3: Create or update business profile
    # =========================================================================
    org_update_payload = {
        "name": "Acme Engineering Global",
        "currency": "USD",
        "address": "100 Silicon Boulevard, Tech City, CA",
        "tax_id": "US-EIN-987654321",
        "invoice_prefix": "ACME",
        "payment_instructions": "Wire transfer to Acme Bank Routing #021000021",
    }
    update_org_resp = client.patch(
        f"/api/v1/organizations/{org_a_id}",
        json=org_update_payload,
        headers=headers_a,
    )
    assert update_org_resp.status_code == 200
    assert update_org_resp.json()["invoice_prefix"] == "ACME"
    assert update_org_resp.json()["tax_id"] == "US-EIN-987654321"

    # =========================================================================
    # STEP 4: Client CRM: Create, edit, and verify client
    # =========================================================================
    client_payload = {
        "name": "Apex Innovations Ltd",
        "contact_name": "Sarah Connor",
        "email": "sarah@apexcorp.example",
        "phone": "+1-555-019-2834",
        "billing_address": "400 Skyline Way, Denver, CO",
        "country": "United States",
        "tax_id": "TAX-APEX-883",
        "notes": "Premium enterprise account",
    }
    client_resp = client.post(
        f"/api/v1/organizations/{org_a_id}/clients",
        json=client_payload,
        headers=headers_a,
    )
    assert client_resp.status_code == 201
    client_data = client_resp.json()
    client_id = client_data["id"]
    assert client_data["name"] == "Apex Innovations Ltd"

    # Edit client
    client_patch_resp = client.patch(
        f"/api/v1/organizations/{org_a_id}/clients/{client_id}",
        json={"phone": "+1-555-999-0000", "notes": "VIP Enterprise Client"},
        headers=headers_a,
    )
    assert client_patch_resp.status_code == 200
    assert client_patch_resp.json()["phone"] == "+1-555-999-0000"

    # =========================================================================
    # STEP 5 & 6: Create invoice with multiple line items & verify math
    # =========================================================================
    # Line 1: 10 hrs @ $150.00 = $1500.00, discount 10% ($150.00) = $1350.00, tax 5% ($67.50) = $1417.50
    # Line 2: 2 units @ $500.00 = $1000.00, discount 0% ($0.00), tax 10% ($100.00) = $1100.00
    # Expected totals:
    # Subtotal: $2500.00
    # Discount: $150.00
    # Tax: $167.50
    # Total: $2517.50
    # Balance: $2517.50
    invoice_payload = {
        "client_id": client_id,
        "issue_date": str(date.today()),
        "due_date": str(date.today() + timedelta(days=14)),
        "currency": "USD",
        "notes": "Phase 1 technical deliverables",
        "payment_terms": "Net 14",
        "items": [
            {
                "description": "Architectural Design & Review",
                "quantity": 10.0,
                "unit_price": 150.0,
                "discount_percent": 10.0,
                "tax_rate": 5.0,
            },
            {
                "description": "Cloud Infrastructure Provisioning",
                "quantity": 2.0,
                "unit_price": 500.0,
                "discount_percent": 0.0,
                "tax_rate": 10.0,
            },
        ],
    }
    inv_create_resp = client.post(
        f"/api/v1/organizations/{org_a_id}/invoices",
        json=invoice_payload,
        headers=headers_a,
    )
    assert inv_create_resp.status_code == 201, f"Invoice create failed: {inv_create_resp.text}"
    inv_data = inv_create_resp.json()
    inv_id = inv_data["id"]
    assert inv_data["status"] == "draft"

    # Verify calculation accuracy
    assert Decimal(str(inv_data["subtotal"])) == Decimal("2500.00")
    assert Decimal(str(inv_data["discount_amount"])) == Decimal("150.00")
    assert Decimal(str(inv_data["tax_amount"])) == Decimal("167.50")
    assert Decimal(str(inv_data["total_amount"])) == Decimal("2517.50")
    assert Decimal(str(inv_data["balance_due"])) == Decimal("2517.50")

    # =========================================================================
    # STEP 7: Issue invoice and verify sequential numbering
    # =========================================================================
    issue_resp = client.post(
        f"/api/v1/organizations/{org_a_id}/invoices/{inv_id}/issue",
        headers=headers_a,
    )
    assert issue_resp.status_code == 200
    issued_data = issue_resp.json()
    assert issued_data["status"] == "issued"
    assert issued_data["invoice_number"].startswith("ACME-")

    # =========================================================================
    # STEP 8: Generate and download invoice PDF
    # =========================================================================
    pdf_resp = client.get(
        f"/api/v1/organizations/{org_a_id}/invoices/{inv_id}/pdf",
        headers=headers_a,
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF")
    assert len(pdf_resp.content) > 1000

    # =========================================================================
    # STEP 9: Record partial payment and verify balance reconciliation
    # =========================================================================
    partial_payment_payload = {
        "invoice_id": inv_id,
        "amount": 1000.00,
        "payment_date": str(date.today()),
        "payment_method": "bank_transfer",
        "reference": "WIRE-TX-9901",
        "notes": "First milestone payment",
    }
    pay1_resp = client.post(
        f"/api/v1/organizations/{org_a_id}/payments",
        json=partial_payment_payload,
        headers=headers_a,
    )
    assert pay1_resp.status_code == 201
    pay1_data = pay1_resp.json()
    assert Decimal(str(pay1_data["amount"])) == Decimal("1000.00")

    # Verify invoice status transitioned to partially_paid
    inv_check1 = client.get(
        f"/api/v1/organizations/{org_a_id}/invoices/{inv_id}",
        headers=headers_a,
    ).json()
    assert inv_check1["status"] == "partially_paid"
    assert Decimal(str(inv_check1["amount_paid"])) == Decimal("1000.00")
    assert Decimal(str(inv_check1["balance_due"])) == Decimal("1517.50")

    # =========================================================================
    # STEP 10: Record remaining payment and verify transition to paid
    # =========================================================================
    final_payment_payload = {
        "invoice_id": inv_id,
        "amount": 1517.50,
        "payment_date": str(date.today()),
        "payment_method": "credit_card",
        "reference": "CC-AUTH-88219",
        "notes": "Final settlement",
    }
    pay2_resp = client.post(
        f"/api/v1/organizations/{org_a_id}/payments",
        json=final_payment_payload,
        headers=headers_a,
    )
    assert pay2_resp.status_code == 201

    # Verify invoice status transitioned to paid
    inv_check2 = client.get(
        f"/api/v1/organizations/{org_a_id}/invoices/{inv_id}",
        headers=headers_a,
    ).json()
    assert inv_check2["status"] == "paid"
    assert Decimal(str(inv_check2["amount_paid"])) == Decimal("2517.50")
    assert Decimal(str(inv_check2["balance_due"])) == Decimal("0.00")

    # =========================================================================
    # STEP 11: Accounts receivable and aging calculations
    # =========================================================================
    rec_summary = client.get(
        f"/api/v1/organizations/{org_a_id}/receivables",
        headers=headers_a,
    )
    assert rec_summary.status_code == 200
    rec_data = rec_summary.json()
    # Fully paid invoice has 0 balance due
    assert "total_receivables" in rec_data
    assert Decimal(rec_data["total_collected"]) == Decimal("2517.50")

    # =========================================================================
    # STEP 12: Email reminder behavior with safe mock provider
    # =========================================================================
    with patch("app.services.email_service.is_email_configured", return_value=True), \
         patch("app.services.email_service.deliver_smtp_message", return_value=(True, "smtp-msg-test", None)):
        send_res = client.post(
            f"/api/v1/organizations/{org_a_id}/invoices/{inv_id}/send-email",
            json={"message": "Please see your invoice receipt."},
            headers=headers_a,
        )
        assert send_res.status_code == 200
        assert send_res.json()["delivery_status"] == "accepted_by_provider"

        # Batch scheduled runner runs safely with zero side effects
        batch_resp = client.post(
            f"/api/v1/organizations/{org_a_id}/reminders/process",
            headers=headers_a,
        )
        assert batch_resp.status_code == 200
        assert "sent" in batch_resp.json()

    # =========================================================================
    # STEP 13: Analytics summary and CSV report export
    # =========================================================================
    analytics_resp = client.get(
        f"/api/v1/organizations/{org_a_id}/analytics/summary",
        headers=headers_a,
    )
    assert analytics_resp.status_code == 200
    an_data = analytics_resp.json()
    assert "invoiced_amount" in an_data
    assert Decimal(str(an_data["invoiced_amount"])) == Decimal("2517.50")
    assert Decimal(str(an_data["payments_collected"])) == Decimal("2517.50")

    # CSV Export
    csv_resp = client.get(
        f"/api/v1/organizations/{org_a_id}/analytics/export/invoices",
        headers=headers_a,
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Invoice Number" in csv_resp.text
    assert issued_data["invoice_number"] in csv_resp.text

    # =========================================================================
    # STEP 14: AI Assistant summary and query
    # =========================================================================
    ai_summary_resp = client.post(
        f"/api/v1/organizations/{org_a_id}/ai/summary",
        json={},
        headers=headers_a,
    )
    assert ai_summary_resp.status_code == 200
    assert "summary" in ai_summary_resp.json()

    ai_query_resp = client.post(
        f"/api/v1/organizations/{org_a_id}/ai/query",
        json={"query": "How much have I collected this month?"},
        headers=headers_a,
    )
    assert ai_query_resp.status_code == 200
    assert "answer" in ai_query_resp.json()

    # =========================================================================
    # STEP 15: Cross-Tenant Isolation Enforcement
    # Create Organization B, verify B CANNOT access Organization A's records
    # =========================================================================
    user_b_payload = {
        "email": "intruder@competitor.example",
        "password": "Password123!",
        "full_name": "Mallory Attacker",
        "organization_name": "Rival Enterprises",
    }
    reg_b = client.post("/api/v1/auth/register", json=user_b_payload).json()
    token_b = reg_b["access_token"]
    org_b_id = reg_b["active_organization"]["id"]
    headers_b = {
        "Authorization": f"Bearer {token_b}",
    }

    # B cannot view Org A's client via Org B endpoint
    assert client.get(
        f"/api/v1/organizations/{org_b_id}/clients/{client_id}",
        headers=headers_b,
    ).status_code == 404

    # B cannot view Org A's client via Org A's URL with B's token (Forbidden)
    assert client.get(
        f"/api/v1/organizations/{org_a_id}/clients/{client_id}",
        headers=headers_b,
    ).status_code == 403

    # B cannot view Org A's invoice
    assert client.get(
        f"/api/v1/organizations/{org_b_id}/invoices/{inv_id}",
        headers=headers_b,
    ).status_code == 404

    # B cannot download Org A's PDF
    assert client.get(
        f"/api/v1/organizations/{org_b_id}/invoices/{inv_id}/pdf",
        headers=headers_b,
    ).status_code == 404

    # B's analytics should show 0 for invoiced amount
    an_b = client.get(
        f"/api/v1/organizations/{org_b_id}/analytics/summary",
        headers=headers_b,
    ).json()
    assert Decimal(str(an_b["invoiced_amount"])) == Decimal("0.00")
