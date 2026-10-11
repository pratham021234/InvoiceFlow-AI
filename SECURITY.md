# InvoiceFlow AI — Security Architecture & Policy

## 1. Security Overview

InvoiceFlow AI is designed with **defense-in-depth**, ensuring data isolation, cryptographic security, and financial integrity across all application layers.

---

## 2. Multi-Tenant Data Isolation (Phase 2 Implementation)

- **Mandatory Tenant Scoping**: All database models representing tenant data feature a non-nullable `organization_id` foreign key.
- **Authorization Enforcement (`get_current_active_org_member`)**: Every organization-scoped endpoint authenticates the caller via JWT and confirms that the user holds an `active` membership in the requested organization.
- **Cross-Tenant Attack Rejection**: Access attempts to another organization's identifiers are rejected with `HTTP 403 Forbidden`. Regression tests in `test_organizations_isolation.py` explicitly verify this boundary.
- **RBAC Enforcement**: Privilege checks (`RoleChecker([MemberRole.OWNER, MemberRole.ADMIN])`) prevent regular members from tampering with organization profiles, tax identifiers, or member roles.
- **Mass Assignment Protection**: Pydantic input schemas whitelist only valid modifiable fields. System attributes (`id`, `owner_id`, `created_at`, `status`) are excluded from mass-assignment.

---

## 3. Authentication & Password Security

- **Password Hashing**: Passwords are encrypted using `bcrypt` via Passlib with automatic salt generation. Plaintext passwords are never logged or persisted.
- **Password Strength**: Minimum 8 characters enforced at registration.
- **Email Normalization**: Emails are normalized to lowercase and whitespace-trimmed (`v.strip().lower()`) during registration and login to prevent casing collisions or account takeover attempts.
- **Generic Security Responses**: Login failures always return `"Invalid email or password."` (HTTP 401) with identical error semantics, avoiding user enumeration.
- **JWT Tokens**: Signed using `HS256` with a minimum 256-bit secret key, containing user subject (`sub`), organization ID (`org_id`), and role (`role`).

---

## 4. Financial Integrity & Zero-Trust Inputs

- **Client Totals Ignored**: The backend never accepts calculated subtotals, taxes, or total amounts from the frontend.
- **Server-Side Arithmetic**: All line items, discounts, taxes, and totals are recomputed strictly using Python's `decimal.Decimal` with `ROUND_HALF_UP`.
- **Atomic Transactions**: Invoice status updates and payment recordings execute within explicit database transactions.
- **Non-Destructive Deletion**: Invoices and payments use `ondelete="RESTRICT"` to prevent accidental or cascade deletion of financial records.

---

## 5. Security Event & Audit Logging

- Security actions (`user_registered`, `user_login`, `organization_created`, `organization_updated`) are recorded via `log_security_event`.
- Sensitive fields (`password`, `token`, `secret`, `hashed_password`) are automatically scrubbed from audit details before persistence.
