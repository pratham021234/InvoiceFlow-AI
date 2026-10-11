import csv
import io
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


def test_csv_formula_injection_sanitization(client):
    """
    Test defense against CSV/Formula Injection (CWE-1236).
    Any cell beginning with =, +, -, @, \\t, \\r must be prepended with a single quote '
    while legitimate numeric amounts should remain clean numbers.
    """
    token, org_id = register_user(client, "formula_inj@test.com", "Security Lead", "Sec Org")
    headers = {"Authorization": f"Bearer {token}"}

    # Create client with formula injection payloads in text fields
    dangerous_client = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={
            "name": "=1+1",
            "contact_name": "@evil_exec",
            "email": "valid_email@exploit.com",
            "billing_address": "+123 Secret Street",
            "notes": "-cmd|' /C calc'!A0",
        },
        headers=headers,
    )
    assert dangerous_client.status_code == 201

    res = client.get(f"/api/v1/organizations/{org_id}/analytics/export/clients", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]

    # Decode bytes (handle utf-8-sig)
    content = res.content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    # Check headers
    assert rows[0] == [
        "Client Name",
        "Contact Person",
        "Email",
        "Phone",
        "Billing Address",
        "Country",
        "Tax ID",
        "Total Invoiced",
        "Outstanding Balance",
        "Archived Status",
        "Created At",
    ]

    # Find the data row
    data_row = rows[1]
    name_val = data_row[0]
    contact_val = data_row[1]

    # Must be neutralized with leading single quote
    assert name_val.startswith("'="), f"Expected '=1+1' to be sanitized to ''=1+1', got {name_val}"
    assert contact_val.startswith("'@"), f"Expected '@evil_exec' to be sanitized, got {contact_val}"


def test_csv_export_invoices_and_payments(client):
    token, org_id = register_user(client, "export_flow@test.com", "Export User", "Export Org")
    headers = {"Authorization": f"Bearer {token}"}

    # Create client
    c_res = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": "Acme Widgets", "email": "acme@widgets.com"},
        headers=headers,
    )
    assert c_res.status_code == 201
    client_id = c_res.json()["id"]

    # Create & issue invoice
    inv_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today() + timedelta(days=14)),
            "currency": "USD",
            "items": [
                {
                    "description": "Widget Consultation",
                    "quantity": 2.0,
                    "unit_price": 150.0,
                    "discount_percent": 0.0,
                    "tax_rate": 0.0,
                }
            ],
        },
        headers=headers,
    )
    inv_id = inv_res.json()["id"]
    client.post(f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue", headers=headers)

    # Record payment
    pay_res = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={
            "invoice_id": inv_id,
            "amount": 100.0,
            "payment_date": str(date.today()),
            "payment_method": "credit_card",
        },
        headers=headers,
    )
    assert pay_res.status_code == 201

    # 1. Export Invoices
    res_inv = client.get(f"/api/v1/organizations/{org_id}/analytics/export/invoices", headers=headers)
    assert res_inv.status_code == 200
    content_inv = res_inv.content.decode("utf-8-sig")
    rows_inv = list(csv.reader(io.StringIO(content_inv)))
    assert len(rows_inv) >= 2
    # Verify invoice total is formatted properly as a number string
    assert "300.00" in rows_inv[1]
    assert "Acme Widgets" in rows_inv[1]

    # 2. Export Payments
    res_pay = client.get(f"/api/v1/organizations/{org_id}/analytics/export/payments", headers=headers)
    assert res_pay.status_code == 200
    content_pay = res_pay.content.decode("utf-8-sig")
    rows_pay = list(csv.reader(io.StringIO(content_pay)))
    assert len(rows_pay) >= 2
    assert "100.00" in rows_pay[1]

    # 3. Export Receivables
    res_rec = client.get(f"/api/v1/organizations/{org_id}/analytics/export/receivables", headers=headers)
    assert res_rec.status_code == 200
    content_rec = res_rec.content.decode("utf-8-sig")
    rows_rec = list(csv.reader(io.StringIO(content_rec)))
    assert len(rows_rec) >= 2
    assert "200.00" in rows_rec[1]  # Remaining balance is 200.00

    # 4. Export Monthly Summary
    res_mon = client.get(f"/api/v1/organizations/{org_id}/analytics/export/monthly-summary", headers=headers)
    assert res_mon.status_code == 200
    content_mon = res_mon.content.decode("utf-8-sig")
    rows_mon = list(csv.reader(io.StringIO(content_mon)))
    assert len(rows_mon) >= 2


def test_csv_export_cross_tenant_isolation(client):
    token1, org1_id = register_user(client, "org1_csv@test.com", "Export User 1", "Org 1")
    token2, org2_id = register_user(client, "org2_csv@test.com", "Export User 2", "Org 2")

    # Org 2 attempts to export Org 1's invoices
    res = client.get(
        f"/api/v1/organizations/{org1_id}/analytics/export/invoices",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res.status_code == 403
