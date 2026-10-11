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

- Security actions (`user_registered`, `user_login`, `organization_created`, `organization_updated`, `payment_recorded`, `payment_reversed`, `invoice_email_sent`, `reminder_sent`) are recorded via `log_security_event`.
- Sensitive fields (`password`, `token`, `secret`, `hashed_password`) are automatically scrubbed from audit details before persistence.

---

## 6. Payment Security & Financial Reversals

- **Idempotency Safeguards**: Payment recording endpoints support an optional unique `idempotency_key` (and enforce deterministic keys on scheduled reminders), preventing network retries from double-charging invoices.
- **Overpayment Invariant**: Payment amounts are validated against remaining balances; any amount exceeding the outstanding balance is rejected with `HTTP 400 Bad Request`.
- **Row Locking (`with_for_update`)**: Concurrent payment requests against the same invoice are serialized using database row-level locking, preventing balance race conditions.
- **Non-Destructive Reversals**: Payments are strictly immutable and cannot be deleted by users. Corrections must utilize the auditable reversal workflow (`POST /payments/{id}/reverse`), requiring a documented audit reason.

---

## 7. Email Integration & Credential Protection

- **Credential Isolation**: SMTP passwords, hostnames, and API secrets are loaded exclusively via environment variables and are never returned in API payloads, frontend bundles, or debug logs.
- **Recipient Verification**: Reminders are strictly dispatched to registered client contact emails; arbitrary relaying to unassociated email addresses is prohibited.
- **Delivery Status Transparency**: Provider message submissions are logged as `accepted_by_provider`. False claims of delivery receipts are prohibited.
- **Controlled Timeouts**: Outbound SMTP network connections enforce strict 10-second socket timeouts to prevent denial-of-service thread exhaustion.

---

## 8. CSV Export Security & Formula Injection Defense (CWE-1236)

- **Spreadsheet Formula Injection Mitigation**: Any untrusted string cell beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically sanitized by prepending a single quote `'` in `csv_export_service.sanitize_csv_value()`. This prevents spreadsheet software (Excel, LibreOffice, Google Sheets) from interpreting cell values as macros, DDE execution vectors, or formulas.
- **Numeric Preservation**: Authoritative numeric fields (`Decimal`, `int`, `float`) are kept clean and unquoted so spreadsheet calculations remain functional.
- **Tenant Isolation on Exports**: All CSV export queries enforce strict `organization_id` filters. An authenticated user belonging to Organization A cannot export Organization B's financial records.
- **Sensitive Field Exclusion**: CSV exports exclude passwords, tokens, API keys, internal system IDs, and database credentials.
- **Encoding & Standards Compliance**: Output CSV streams are encoded with UTF-8 BOM (`\ufeff`) to ensure consistent non-ASCII character display across international spreadsheet clients.

---

## 9. AI Security, Privacy & Financial Correctness

- **Backend Calculations as Source of Truth**: All financial amounts, aging totals, and KPI figures are calculated in Python via `analytics_service` using PostgreSQL data before AI ingestion. LLM models are never used to compute authoritative arithmetic.
- **No Arbitrary SQL Execution**: The AI assistant utilizes predefined, validated intent handlers and constrained service functions. The system never executes arbitrary SQL generated by an LLM against the database.
- **Prompt Injection Defense**: User notes and client data are encapsulated as untrusted string parameters within structured JSON payloads, preventing prompt overrides from hijacking system behavior.
- **Human-in-the-Loop Messaging**: The AI assistant drafts payment reminders but possesses no autonomous authorization to send emails, record payments, or alter invoice statuses. Message transmission requires explicit user review and confirmation.
- **Zero-Credential Transmission**: Model context never includes passwords, database credentials, JWT secrets, or payment tokens.
- **Graceful Fallback Mode**: When an external AI key is absent or unreachable, the application falls back to deterministic rule-based analysis without degrading core application workflows.

