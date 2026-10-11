# InvoiceFlow AI — Changelog & Release Notes

All notable changes to the InvoiceFlow AI platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-11 (Phase 6: Production Readiness & Commercial Handoff)

### Added
- **Quality Gates & Test Harness:** Completed 63 automated tests covering auth, tenant isolation, RBAC, decimal precision, invoice lifecycle, payment reconciliation, PDF generation, email processing, analytics, CSV injection defense, and AI safety guardrails.
- **Commercial Documentation Suite:**
  - `RELEASE_AUDIT.md`: Empirical feature classification matrix.
  - `SECURITY_REVIEW.md`: Complete application security and vulnerability audit.
  - `RELEASE_TEST_REPORT.md`: Granular test commands and verification logs.
  - `LICENSE_REVIEW.md`: Dependency license audit verifying 100% permissive open-source licenses.
  - `OWNERSHIP_AND_PROVENANCE.md`: Authorship provenance and cleanroom IP verification.
  - `BUYER_HANDOFF.md`: Acquirer guide covering deployment, costs, and rebranding.
  - `TRAINPLEX_SUBMISSION_CHECKLIST.md`: TrainPlex marketplace evaluation checklist.
  - `RELEASE_READINESS.md`: Evidence-based release determination report.
- **Formula Injection Defense (CWE-1236):** Sanitization prefixing for all CSV export text fields (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Offline Migration Validation:** Verified Alembic schema generation from baseline through head revisions.

### Fixed
- **Frontend Compiler Closure Mutation:** Fixed ESLint 9 / React 19 compiler errors in `frontend/src/app/invoices/new/page.tsx` and `frontend/src/app/invoices/[id]/edit/page.tsx` by replacing closure accumulator mutations with iterative `for...of` loops.
- **ESLint 9 Flat Config Support:** Updated `frontend/eslint.config.mjs` to properly extend Next.js core web vitals and TypeScript rules under modern ESLint standards.
- **Repository Hygiene (.gitignore):** Fixed rule matching in `.gitignore` where generic `lib/` pattern unintentionally ignored `frontend/src/lib/api.ts`. Ensured proper tracking of core API client library.

---

## [0.5.0] - 2026-10-10 (Phase 5: Analytics, Reports, CSV Exports & AI Assistant)

### Added
- **Financial Analytics Engine:** Real-time calculation of total invoiced, total collected, outstanding receivables, overdue ratios, and average collection duration.
- **Accounts Receivable Aging:** Visual distribution breakdown into Current, 1–30 days, 31–60 days, 61–90 days, and 90+ days aging buckets.
- **Client Financial Performance:** Per-client revenue metrics and outstanding balance tracking with duplicate join prevention.
- **CSV Data Exports:** Dedicated export endpoints (`/exports/invoices/csv`, `/exports/payments/csv`) with parameterized tenant filters.
- **AI Receivables Assistant:** Natural language financial queries, automated invoice summaries, and tone-customizable collection reminder drafts (polite, firm, urgent).
- **Dual-Mode AI Provider:** Transparent fallback from OpenAI (`gpt-4o-mini`) to deterministic rule-based heuristic assistant when unconfigured.

---

## [0.4.0] - 2026-10-09 (Phase 4: Payments, Receivables & Email Automation)

### Added
- **Payment Processing Module:** Support for recording full, partial, and multiple payments per invoice.
- **Authoritative Balance Reconciliation:** Server-side synchronization of `amount_paid`, `balance_due`, and invoice status transitions (`paid`, `partially_paid`).
- **Payment Reversals:** Non-destructive reversal workflow with audit logging (`reversed_at`, `reversed_by_user_id`, `reversal_reason`).
- **Idempotency Safeguards:** Idempotency key validation preventing duplicate payment transactions under concurrent submission.
- **Transactional Email Infrastructure:** Abstracted email provider supporting mock mode, SMTP, and cloud relays.
- **Email Delivery Logging:** Dedicated `email_logs` table tracking notification types, recipient email, idempotency keys, and error messages.
- **Batch Scheduled Reminders:** Automated reminder runner for overdue receivables with duplicate dispatch prevention.

---

## [0.3.0] - 2026-10-08 (Phase 3: Client CRM, Invoice Lifecycle & PDF Generation)

### Added
- **Client CRM Subsystem:** Organization-scoped customer directory with search, filtering, pagination, archiving, and restoration.
- **Invoice Lifecycle Engine:** Enforced state progression (`draft` -> `issued` -> `paid`/`partially_paid`/`cancelled`).
- **Sequential Invoice Numbering:** Atomic per-organization invoice numbering (`INV-YYYY-XXXX`).
- **PDF Generation Engine:** Server-side dynamic PDF invoice rendering via ReportLab with company logos, line items, tax breakdowns, and payment terms.
- **Public Secure Share Links:** Unique cryptographic public tokens for client-accessible web invoice view and PDF download.

---

## [0.2.0] - 2026-10-07 (Phase 2: Authentication, Multi-Tenancy & Database Persistence)

### Added
- **PostgreSQL & SQLAlchemy 2.0 Persistence:** Complete relational database schema with Alembic migration versioning.
- **Multi-Tenant Architecture:** Organization data partitioning with foreign key constraints and mandatory tenant scoping.
- **Authentication & RBAC:** User registration, bcrypt password hashing, case-insensitive email lookup, JWT issue/validation, and organization roles (Owner, Admin, Member).
- **Security Protections:** Mass-assignment prevention on organization updates, IDOR isolation, and unique membership constraints.

---

## [0.1.0] - 2026-10-06 (Phase 1: Foundation & Financial Calculation Engine)

### Added
- **Monetary Calculation Service:** High-precision decimal arithmetic module with `ROUND_HALF_UP` rounding.
- **Line Item Computations:** Subtotal, line discounts, line taxes, and invoice aggregation.
- **Next.js & FastAPI Scaffolding:** App router structure, Pydantic request/response validation, and Tailwind CSS design tokens.
