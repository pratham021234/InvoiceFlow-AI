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


def create_client(client, token, org_id, name="Acme Corp", email="acme@corp.com"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/organizations/{org_id}/clients",
        json={"name": name, "email": email},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


def create_invoice(client, token, org_id, client_id, amount, due_days=14, status="draft"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/organizations/{org_id}/invoices",
        json={
            "client_id": client_id,
            "issue_date": str(date.today()),
            "due_date": str(date.today() + timedelta(days=due_days)),
            "currency": "USD",
            "items": [
                {
                    "description": "Item",
                    "quantity": 1.0,
                    "unit_price": float(amount),
                    "discount_percent": 0.0,
                    "tax_rate": 0.0,
                }
            ],
        },
        headers=headers,
    )
    assert res.status_code == 201
    inv_id = res.json()["id"]

    if status in ("sent", "paid", "partially_paid", "overdue"):
        issue_res = client.post(
            f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue",
            headers=headers,
        )
        assert issue_res.status_code == 200

    if status == "cancelled":
        # Issue first then cancel
        client.post(
            f"/api/v1/organizations/{org_id}/invoices/{inv_id}/issue",
            headers=headers,
        )
        client.post(
            f"/api/v1/organizations/{org_id}/invoices/{inv_id}/cancel",
            json={"reason": "Customer cancellation test"},
            headers=headers,
        )

    return inv_id


def record_payment(client, token, org_id, invoice_id, amount, payment_date=None):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "invoice_id": invoice_id,
        "amount": float(amount),
        "payment_date": str(payment_date or date.today()),
        "payment_method": "bank_transfer",
    }
    res = client.post(
        f"/api/v1/organizations/{org_id}/payments",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_empty_analytics_dataset(client):
    token, org_id = register_user(client, "empty_analytics@test.com", "Empty", "Empty Org")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/organizations/{org_id}/analytics/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert Decimal(str(data["invoiced_amount"])) == Decimal("0.00")
    assert Decimal(str(data["payments_collected"])) == Decimal("0.00")
    assert Decimal(str(data["outstanding_receivables"])) == Decimal("0.00")
    assert Decimal(str(data["overdue_receivables"])) == Decimal("0.00")
    assert Decimal(str(data["collection_rate"])) == Decimal("0.00")
    assert data["average_collection_days"] is None

    res_trends = client.get(f"/api/v1/organizations/{org_id}/analytics/revenue-trends", headers=headers)
    assert res_trends.status_code == 200
    assert isinstance(res_trends.json()["items"], list)

    res_aging = client.get(f"/api/v1/organizations/{org_id}/analytics/aging", headers=headers)
    assert res_aging.status_code == 200
    assert Decimal(str(res_aging.json()["total_overdue"])) == Decimal("0.00")

    res_clients = client.get(f"/api/v1/organizations/{org_id}/analytics/clients", headers=headers)
    assert res_clients.status_code == 200
    assert res_clients.json()["items"] == []


def test_invoiced_and_collected_calculations(client):
    token, org_id = register_user(client, "calc_user@test.com", "Calc", "Calc Org")
    headers = {"Authorization": f"Bearer {token}"}
    client_id = create_client(client, token, org_id)

    # 1. Draft invoice (100.00) -> must be excluded from invoiced amount
    create_invoice(client, token, org_id, client_id, 100.0, due_days=14, status="draft")

    # 2. Cancelled invoice (200.00) -> must be excluded
    create_invoice(client, token, org_id, client_id, 200.0, due_days=14, status="cancelled")

    # 3. Issued invoice (500.00) -> included in invoiced amount
    inv3 = create_invoice(client, token, org_id, client_id, 500.0, due_days=14, status="sent")

    # 4. Record partial payment (200.00) against inv3
    record_payment(client, token, org_id, inv3, 200.0)

    # 5. Query summary
    res = client.get(f"/api/v1/organizations/{org_id}/analytics/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert Decimal(str(data["invoiced_amount"])) == Decimal("500.00")
    assert Decimal(str(data["payments_collected"])) == Decimal("200.00")
    assert Decimal(str(data["outstanding_receivables"])) == Decimal("300.00")
    assert Decimal(str(data["partially_paid_amount"])) == Decimal("300.00")
    # Collection rate: 200 / 500 = 40.0%
    assert Decimal(str(data["collection_rate"])) == Decimal("40.00")


def test_overdue_aging_calculations(client):
    token, org_id = register_user(client, "aging_user@test.com", "Aging", "Aging Org")
    headers = {"Authorization": f"Bearer {token}"}
    client_id = create_client(client, token, org_id)

    # Invoice 1: Due in +10 days -> current (100.00)
    create_invoice(client, token, org_id, client_id, 100.0, due_days=10, status="sent")

    # Invoice 2: Due -5 days ago -> 1_7_days (200.00)
    create_invoice(client, token, org_id, client_id, 200.0, due_days=-5, status="sent")

    # Invoice 3: Due -20 days ago -> 8_30_days (300.00)
    create_invoice(client, token, org_id, client_id, 300.0, due_days=-20, status="sent")

    # Invoice 4: Due -45 days ago -> 31_60_days (400.00)
    create_invoice(client, token, org_id, client_id, 400.0, due_days=-45, status="sent")

    # Invoice 5: Due -80 days ago -> over_60_days (500.00)
    create_invoice(client, token, org_id, client_id, 500.0, due_days=-80, status="sent")

    # Invoice 6: Due -10 days ago, but fully settled (600.00 paid) -> should NOT be overdue!
    inv6 = create_invoice(client, token, org_id, client_id, 600.0, due_days=-10, status="sent")
    record_payment(client, token, org_id, inv6, 600.0)

    res = client.get(f"/api/v1/organizations/{org_id}/analytics/aging", headers=headers)
    assert res.status_code == 200
    data = res.json()

    brackets = {b["bracket"]: Decimal(str(b["total_balance"])) for b in data["brackets"]}
    assert brackets["current"] == Decimal("100.00")
    assert brackets["1_7_days"] == Decimal("200.00")
    assert brackets["8_30_days"] == Decimal("300.00")
    assert brackets["31_60_days"] == Decimal("400.00")
    assert brackets["over_60_days"] == Decimal("500.00")

    # Total overdue excludes current: 200 + 300 + 400 + 500 = 1400.00
    assert Decimal(str(data["total_overdue"])) == Decimal("1400.00")


def test_client_performance_duplicate_join_prevention(client):
    token, org_id = register_user(client, "client_perf@test.com", "Perf", "Perf Org")
    headers = {"Authorization": f"Bearer {token}"}
    client_id = create_client(client, token, org_id, name="Big Tech Ltd")

    # Invoice A: 1000.00 with 2 separate payments (300.00 and 200.00)
    inv_a = create_invoice(client, token, org_id, client_id, 1000.0, due_days=14, status="sent")
    record_payment(client, token, org_id, inv_a, 300.0)
    record_payment(client, token, org_id, inv_a, 200.0)

    # Invoice B: 500.00, unpaid
    create_invoice(client, token, org_id, client_id, 500.0, due_days=14, status="sent")

    res = client.get(f"/api/v1/organizations/{org_id}/analytics/clients", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 1
    cp = data["items"][0]

    # Invoiced should be exactly 1500.00, NOT duplicated by payment rows
    assert Decimal(str(cp["total_invoiced"])) == Decimal("1500.00")
    # Collected should be 500.00 (300 + 200)
    assert Decimal(str(cp["total_collected"])) == Decimal("500.00")
    # Outstanding should be 1000.00 (1500 - 500)
    assert Decimal(str(cp["outstanding_balance"])) == Decimal("1000.00")
    assert cp["invoice_count"] == 2


def test_status_distribution(client):
    token, org_id = register_user(client, "dist_user@test.com", "Dist", "Dist Org")
    headers = {"Authorization": f"Bearer {token}"}
    client_id = create_client(client, token, org_id)

    create_invoice(client, token, org_id, client_id, 100.0, due_days=14, status="draft")
    inv2 = create_invoice(client, token, org_id, client_id, 200.0, due_days=14, status="sent")
    record_payment(client, token, org_id, inv2, 200.0)

    res = client.get(f"/api/v1/organizations/{org_id}/analytics/status-distribution", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    status_map = {d["status"]: d["count"] for d in items}
    assert status_map.get("draft") == 1
    assert status_map.get("paid") == 1


def test_cross_tenant_analytics_isolation(client):
    token1, org1_id = register_user(client, "org1_analytics@test.com", "Org One", "Org One Ltd")
    token2, org2_id = register_user(client, "org2_analytics@test.com", "Org Two", "Org Two Ltd")

    c1 = create_client(client, token1, org1_id)
    create_invoice(client, token1, org1_id, c1, 10000.0, status="sent")

    # Org 2 summary should be 0
    res2 = client.get(
        f"/api/v1/organizations/{org2_id}/analytics/summary",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res2.status_code == 200
    assert Decimal(str(res2.json()["invoiced_amount"])) == Decimal("0.00")

    # Org 2 attempting to query Org 1 analytics gets 403 Forbidden
    res_forbidden = client.get(
        f"/api/v1/organizations/{org1_id}/analytics/summary",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res_forbidden.status_code == 403
