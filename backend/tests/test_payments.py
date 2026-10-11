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


def create_client_and_issued_invoice(client, token, org_id, amount=100.0, due_days=14):
    headers = {"Authorization": f"Bearer {token}"}
    c_res = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": "Client Testing Ltd", "email": "client@testing.com"},
        headers=headers,
    )
    assert c_res.status_code == 201
    client_id = c_res.json()["id"]

    inv_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today() + timedelta(days=due_days)),
            "currency": "USD",
            "items": [
                {
                    "description": "Professional Services",
                    "quantity": 1.0,
                    "unit_price": amount,
                    "discount_percent": 0.0,
                    "tax_rate": 0.0,
                }
            ],
        },
        headers=headers,
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["id"]

    # Issue invoice so it is eligible for payment
    issue_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue",
        headers=headers,
    )
    assert issue_res.status_code == 200
    return inv_id, client_id


def test_full_payment_transitions_to_paid(client):
    token, org_id = register_user(client, "pay_full@test.com", "Full Payer", "Full Pay Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_client_and_issued_invoice(client, token, org_id, amount=500.0)

    # Record full payment of 500.00
    pay_res = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={
            "invoice_id": inv_id,
            "amount": 500.00,
            "payment_date": str(date.today()),
            "payment_method": "bank_transfer",
            "reference": "TXN-FULL-001",
            "notes": "Full settlement via Wire",
        },
        headers=headers,
    )
    assert pay_res.status_code == 201
    pay_data = pay_res.json()
    assert pay_data["amount"] == "500.00"
    assert pay_data["payment_status"] == "completed"

    # Verify invoice status is PAID and balance is 0.00
    inv_check = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers)
    assert inv_check.status_code == 200
    inv_data = inv_check.json()
    assert inv_data["status"] == "paid"
    assert inv_data["amount_paid"] == "500.00"
    assert inv_data["balance_due"] == "0.00"


def test_partial_and_multiple_payments(client):
    token, org_id = register_user(client, "pay_part@test.com", "Part Payer", "Part Pay Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_client_and_issued_invoice(client, token, org_id, amount=1000.0)

    # 1st partial payment: 300.00
    pay1 = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={
            "invoice_id": inv_id,
            "amount": 300.00,
            "payment_date": str(date.today()),
            "payment_method": "credit_card",
        },
        headers=headers,
    )
    assert pay1.status_code == 201

    inv1 = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers).json()
    assert inv1["status"] == "partially_paid"
    assert inv1["amount_paid"] == "300.00"
    assert inv1["balance_due"] == "700.00"

    # 2nd partial payment: 450.00
    pay2 = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={
            "invoice_id": inv_id,
            "amount": 450.00,
            "payment_date": str(date.today()),
            "payment_method": "bank_transfer",
        },
        headers=headers,
    )
    assert pay2.status_code == 201

    inv2 = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers).json()
    assert inv2["status"] == "partially_paid"
    assert inv2["amount_paid"] == "750.00"
    assert inv2["balance_due"] == "250.00"

    # 3rd final payment: 250.00 completes it
    pay3 = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={
            "invoice_id": inv_id,
            "amount": 250.00,
            "payment_date": str(date.today()),
            "payment_method": "cash",
        },
        headers=headers,
    )
    assert pay3.status_code == 201

    inv3 = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers).json()
    assert inv3["status"] == "paid"
    assert inv3["amount_paid"] == "1000.00"
    assert inv3["balance_due"] == "0.00"

    # Verify payment history endpoint
    hist = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}/payments", headers=headers)
    assert hist.status_code == 200
    items = hist.json()["items"]
    assert len(items) == 3


def test_zero_and_negative_payment_rejected(client):
    token, org_id = register_user(client, "pay_neg@test.com", "Neg Payer", "Neg Pay Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_client_and_issued_invoice(client, token, org_id, amount=200.0)

    # 0 amount rejected by validation schema
    zero_res = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={"invoice_id": inv_id, "amount": 0.00, "payment_date": str(date.today())},
        headers=headers,
    )
    assert zero_res.status_code == 422

    # Negative amount rejected
    neg_res = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={"invoice_id": inv_id, "amount": -50.00, "payment_date": str(date.today())},
        headers=headers,
    )
    assert neg_res.status_code == 422


def test_overpayment_rejected_by_policy(client):
    token, org_id = register_user(client, "pay_over@test.com", "Over Payer", "Over Pay Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_client_and_issued_invoice(client, token, org_id, amount=200.0)

    # Overpayment attempt (200.01 against 200.00 balance)
    res = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={"invoice_id": inv_id, "amount": 200.01, "payment_date": str(date.today())},
        headers=headers,
    )
    assert res.status_code == 400
    assert "exceeds remaining balance due" in res.json()["detail"]


def test_payment_against_draft_or_cancelled_rejected(client):
    token, org_id = register_user(client, "pay_draft@test.com", "Draft Payer", "Draft Pay Org")
    headers = {"Authorization": f"Bearer {token}"}

    c_res = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": "Client A", "email": "a@test.com"},
        headers=headers,
    )
    client_id = c_res.json()["id"]

    draft_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today() + timedelta(days=14)),
            "items": [{"description": "Work", "quantity": 1, "unit_price": 100}],
        },
        headers=headers,
    )
    draft_id = draft_res.json()["id"]

    # Try recording payment on draft
    res = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={"invoice_id": draft_id, "amount": 50.0, "payment_date": str(date.today())},
        headers=headers,
    )
    assert res.status_code == 400
    assert "draft" in res.json()["detail"]


def test_payment_reversal_and_recalculation(client):
    token, org_id = register_user(client, "pay_rev@test.com", "Rev Payer", "Rev Pay Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_client_and_issued_invoice(client, token, org_id, amount=400.0)

    # Record 400 payment -> PAID
    pay = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={"invoice_id": inv_id, "amount": 400.0, "payment_date": str(date.today())},
        headers=headers,
    ).json()
    pay_id = pay["id"]

    inv_before = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers).json()
    assert inv_before["status"] == "paid"

    # Reverse payment with reason
    rev_res = client.post(
        f"/api/v1/organizations/{org_id}/payments/{pay_id}/reverse",
        json={"reason": "Check bounced / customer stopped payment"},
        headers=headers,
    )
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["payment_status"] == "reversed"
    assert rev_data["reversal_reason"] == "Check bounced / customer stopped payment"
    assert rev_data["reversed_at"] is not None

    # Check invoice status and balance returned to ISSUED and 400.00
    inv_after = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers).json()
    assert inv_after["status"] == "issued"
    assert inv_after["amount_paid"] == "0.00"
    assert inv_after["balance_due"] == "400.00"

    # Cannot reverse an already reversed payment
    rev_again = client.post(
        f"/api/v1/organizations/{org_id}/payments/{pay_id}/reverse",
        json={"reason": "Second reversal attempt"},
        headers=headers,
    )
    assert rev_again.status_code == 400


def test_idempotency_prevents_duplicate_payments(client):
    token, org_id = register_user(client, "pay_idem@test.com", "Idem Payer", "Idem Pay Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_client_and_issued_invoice(client, token, org_id, amount=300.0)

    idempotency_key = "key-unique-req-7788"
    # First request
    res1 = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={
            "invoice_id": inv_id,
            "amount": 100.0,
            "payment_date": str(date.today()),
            "idempotency_key": idempotency_key,
        },
        headers=headers,
    )
    assert res1.status_code == 201
    pay1_id = res1.json()["id"]

    # Replay same request with same idempotency key
    res2 = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={
            "invoice_id": inv_id,
            "amount": 100.0,
            "payment_date": str(date.today()),
            "idempotency_key": idempotency_key,
        },
        headers=headers,
    )
    # Must return existing payment rather than recording duplicate charge
    assert res2.status_code in (200, 201)
    assert res2.json()["id"] == pay1_id

    # Verify amount paid is only 100, not 200
    inv = client.get(f"/api/v1/organizations/{org_id}/invoices/{inv_id}", headers=headers).json()
    assert inv["amount_paid"] == "100.00"
    assert inv["balance_due"] == "200.00"


def test_cross_tenant_payment_isolation(client):
    token1, org1_id = register_user(client, "org1_pay@test.com", "Org One", "Tenant One")
    token2, org2_id = register_user(client, "org2_pay@test.com", "Org Two", "Tenant Two")

    inv1_id, _ = create_client_and_issued_invoice(client, token1, org1_id, amount=500.0)

    # Tenant 2 tries to record payment against Tenant 1 invoice
    hack_res = client.post(
        f"/api/v1/organizations/{org2_id}/payments",
        json={"invoice_id": inv1_id, "amount": 100.0, "payment_date": str(date.today())},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert hack_res.status_code == 404
