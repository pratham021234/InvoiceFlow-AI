from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch
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


def create_issued_invoice(client, token, org_id, amount=200.0, days_offset=14, client_name="Acme"):
    headers = {"Authorization": f"Bearer {token}"}
    c_res = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": client_name, "email": f"{client_name.lower().replace(' ', '')}@test.com"},
        headers=headers,
    )
    assert c_res.status_code == 201
    client_id = c_res.json()["id"]

    inv_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today() - timedelta(days=30)),
            "due_date": str(date.today() + timedelta(days=days_offset)),
            "currency": "USD",
            "items": [
                {
                    "description": "Consulting",
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

    issue_res = client.post(
        f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue",
        headers=headers,
    )
    assert issue_res.status_code == 200
    return inv_id, client_id


def test_receivables_aging_and_summary_endpoint(client):
    token, org_id = register_user(client, "rec_user@test.com", "Rec User", "Receivables Org")
    headers = {"Authorization": f"Bearer {token}"}

    # Invoice 1: Due in future (+10 days) -> current
    inv1_id, _ = create_issued_invoice(client, token, org_id, amount=100.0, days_offset=10, client_name="Client Current")

    # Invoice 2: 5 days overdue (-5 days) -> 1_7_days
    inv2_id, _ = create_issued_invoice(client, token, org_id, amount=250.0, days_offset=-5, client_name="Client Od5")

    # Invoice 3: 20 days overdue (-20 days) -> 8_30_days
    inv3_id, _ = create_issued_invoice(client, token, org_id, amount=400.0, days_offset=-20, client_name="Client Od20")

    # Invoice 4: Settled / fully paid invoice -> should NOT be overdue even if due date is past
    inv4_id, _ = create_issued_invoice(client, token, org_id, amount=300.0, days_offset=-15, client_name="Client Paid")
    client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={"invoice_id": inv4_id, "amount": 300.0, "payment_date": str(date.today())},
        headers=headers,
    )

    # Call Receivables endpoint
    res = client.get(f"/api/v1/organizations/{org_id}/receivables", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert Decimal(data["total_receivables"]) == Decimal("750.00")  # 100 + 250 + 400
    assert Decimal(data["total_overdue"]) == Decimal("650.00")      # 250 + 400
    assert Decimal(data["total_collected"]) == Decimal("300.00")    # 300
    assert data["total_open_invoices"] == 3
    assert data["total_overdue_invoices"] == 2

    # Check brackets
    brackets = {b["bracket"]: b for b in data["brackets"]}
    assert brackets["current"]["invoice_count"] == 1
    assert Decimal(brackets["current"]["total_balance"]) == Decimal("100.00")

    assert brackets["1_7_days"]["invoice_count"] == 1
    assert Decimal(brackets["1_7_days"]["total_balance"]) == Decimal("250.00")

    assert brackets["8_30_days"]["invoice_count"] == 1
    assert Decimal(brackets["8_30_days"]["total_balance"]) == Decimal("400.00")

    # Test filtering by status=overdue
    od_res = client.get(f"/api/v1/organizations/{org_id}/receivables?status=overdue", headers=headers)
    assert od_res.status_code == 200
    assert od_res.json()["total"] == 2

    # Test filtering by aging_bracket=1_7_days
    b_res = client.get(f"/api/v1/organizations/{org_id}/receivables?aging_bracket=1_7_days", headers=headers)
    assert b_res.status_code == 200
    assert b_res.json()["total"] == 1
    assert b_res.json()["invoices"][0]["days_overdue"] == 5


def test_unconfigured_email_fails_gracefully(client):
    token, org_id = register_user(client, "unconf_email@test.com", "No Email", "No Email Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_issued_invoice(client, token, org_id, amount=150.0)

    # Attempt to send invoice email when SMTP host is unset or unconfigured
    with patch("app.services.email_service.is_email_configured", return_value=False):
        res = client.post(
            f"/api/v1/organizations/{org_id}/invoices/{inv_id}/send-email",
            headers=headers,
        )
        assert res.status_code == 503
        assert "not configured" in res.json()["detail"].lower()


def test_send_invoice_and_reminder_with_smtp_double(client):
    token, org_id = register_user(client, "email_test@test.com", "Email Test", "Email Test Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_issued_invoice(client, token, org_id, amount=350.0, days_offset=-3)

    # Mock SMTP delivery success
    with patch("app.services.email_service.is_email_configured", return_value=True), \
         patch("app.services.email_service.deliver_smtp_message", return_value=(True, "smtp-msg-mock-1234", None)):

        # 1. Send Invoice Email
        send_res = client.post(
            f"/api/v1/organizations/{org_id}/invoices/{inv_id}/send-email",
            json={"message": "Please remit payment at your earliest convenience."},
            headers=headers,
        )
        assert send_res.status_code == 200
        send_data = send_res.json()
        assert send_data["delivery_status"] == "accepted_by_provider"
        assert send_data["provider_message_id"] == "smtp-msg-mock-1234"

        # 2. Send Payment Reminder
        rem_res = client.post(
            f"/api/v1/organizations/{org_id}/invoices/{inv_id}/remind",
            json={"message": "Friendly reminder: your invoice is overdue."},
            headers=headers,
        )
        assert rem_res.status_code == 200
        rem_data = rem_res.json()
        assert rem_data["delivery_status"] == "accepted_by_provider"
        assert rem_data["notification_type"] == "payment_reminder"

        # 3. List Email Logs
        logs_res = client.get(f"/api/v1/organizations/{org_id}/email-logs", headers=headers)
        assert logs_res.status_code == 200
        logs = logs_res.json()["items"]
        assert len(logs) == 2
        assert any(l["notification_type"] == "invoice_send" for l in logs)
        assert any(l["notification_type"] == "payment_reminder" for l in logs)


def test_scheduled_reminders_batch_and_duplicate_prevention(client):
    token, org_id = register_user(client, "batch_rem@test.com", "Batch Rem", "Batch Org")
    headers = {"Authorization": f"Bearer {token}"}

    # Invoice overdue by 3 days matches 'overdue_3d' milestone rule
    inv_id, _ = create_issued_invoice(client, token, org_id, amount=500.0, days_offset=-3)

    with patch("app.services.email_service.is_email_configured", return_value=True), \
         patch("app.services.email_service.deliver_smtp_message", return_value=(True, "batch-msg-001", None)):

        # First batch run: should send reminder for overdue_3d rule
        batch1 = client.post(f"/api/v1/organizations/{org_id}/reminders/process", headers=headers)
        assert batch1.status_code == 200
        data1 = batch1.json()
        assert data1["sent"] == 1

        # Second batch run immediately after: idempotency must prevent duplicate reminder
        batch2 = client.post(f"/api/v1/organizations/{org_id}/reminders/process", headers=headers)
        assert batch2.status_code == 200
        data2 = batch2.json()
        assert data2["sent"] == 0
        assert data2["skipped"] >= 1


def test_paid_invoice_excluded_from_reminders(client):
    token, org_id = register_user(client, "paid_no_rem@test.com", "Paid User", "Paid Org")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id, _ = create_issued_invoice(client, token, org_id, amount=200.0, days_offset=-3)

    # Pay the invoice in full
    client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json={"invoice_id": inv_id, "amount": 200.0, "payment_date": str(date.today())},
        headers=headers,
    )

    # Triggering manual reminder on settled invoice must fail with 400
    res = client.post(f"/api/v1/organizations/{org_id}/invoices/{inv_id}/remind", headers=headers)
    assert res.status_code == 400
    assert "fully paid" in res.json()["detail"].lower()


def test_cross_tenant_email_log_isolation(client):
    token1, org1_id = register_user(client, "org1_email@test.com", "Org One", "Tenant 1")
    token2, org2_id = register_user(client, "org2_email@test.com", "Org Two", "Tenant 2")

    # Org 2 attempts to view Org 1 email logs
    res = client.get(
        f"/api/v1/organizations/{org1_id}/email-logs",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res.status_code == 403
