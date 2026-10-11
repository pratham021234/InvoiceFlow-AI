import pytest


def test_user_registration_success(client):
    payload = {
        "email": "Owner@AgencyFlow.io",
        "password": "SecurePassword123!",
        "full_name": "Jane Doe",
        "organization_name": "Jane Creative Agency",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    # Verify email normalization
    assert data["user"]["email"] == "owner@agencyflow.io"
    assert data["user"]["full_name"] == "Jane Doe"
    # Verify initial organization creation
    assert data["active_organization"] is not None
    assert data["active_organization"]["name"] == "Jane Creative Agency"
    assert data["active_organization"]["user_role"] == "owner"


def test_duplicate_email_registration_rejected(client):
    payload = {
        "email": "duplicate@test.com",
        "password": "SecurePassword123!",
        "full_name": "First User",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt to register with uppercase variant of the same email
    payload_dup = {
        "email": "DUPLICATE@TEST.COM",
        "password": "AnotherPassword456!",
        "full_name": "Second User",
    }
    res2 = client.post("/api/v1/auth/register", json=payload_dup)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_password_strength_validation(client):
    payload = {
        "email": "shortpw@test.com",
        "password": "short",  # Less than 8 chars
        "full_name": "Short Pw",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


def test_login_success_and_email_case_insensitivity(client):
    reg_payload = {
        "email": "founder@startup.com",
        "password": "StrongPassword999!",
        "full_name": "Alex Smith",
    }
    res_reg = client.post("/api/v1/auth/register", json=reg_payload)
    assert res_reg.status_code == 201

    # Login with mixed case email
    login_payload = {
        "email": "FOUNDER@STARTUP.COM",
        "password": "StrongPassword999!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "founder@startup.com"


def test_login_invalid_password_returns_generic_error(client):
    reg_payload = {
        "email": "user@security.com",
        "password": "CorrectPassword123!",
        "full_name": "Security User",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    response = client.post("/api/v1/auth/login", json={
        "email": "user@security.com",
        "password": "WrongPassword999!",
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_login_nonexistent_email_returns_generic_error(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "nobody@doesnotexist.com",
        "password": "AnyPassword123!",
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_protected_endpoint_me(client):
    # Without token
    res_unauth = client.get("/api/v1/auth/me")
    assert res_unauth.status_code == 401

    # With valid token
    reg = client.post("/api/v1/auth/register", json={
        "email": "tokenuser@test.com",
        "password": "TokenPassword123!",
        "full_name": "Token User",
    })
    token = reg.json()["access_token"]

    res_auth = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_auth.status_code == 200
    assert res_auth.json()["email"] == "tokenuser@test.com"


def test_logout_endpoint(client):
    reg = client.post("/api/v1/auth/register", json={
        "email": "logoutuser@test.com",
        "password": "LogoutPassword123!",
        "full_name": "Logout User",
    })
    token = reg.json()["access_token"]

    response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully."
