# TrainPlex Marketplace Product Listing Draft — InvoiceFlow AI

---

## 1. Product Overview

- **Product Name:** InvoiceFlow AI
- **One-Line Value Proposition:** A modern, banking-grade full-stack invoice and payment automation SaaS featuring high-precision financial calculations, multi-tenant RBAC, automated receivables aging, and an integrated AI assistant.
- **Listing Category:** Full-Stack Web Application / B2B SaaS Codebase
- **Target Buyer:** Software Acquirers, Digital Agencies, SaaS Operators, Independent Developers seeking a production-ready billing foundation.

---

## 2. Target End Customers

- **Freelancers & Independent Contractors:** Solopreneurs requiring rapid client billing, instantaneous PDF invoice generation, and automated follow-ups.
- **Agencies & Professional Consultancies:** Service firms managing multiple enterprise clients, milestone payments, and partial payment reconciliation.
- **Small & Medium Businesses (SMBs):** Companies requiring multi-tenant organization workspaces, granular role-based access control (Owner, Admin, Member), and structured CSV financial reporting.

---

## 3. Verified Features (Empirically Tested)

Every feature listed below is verified by automated regression test suites (64 backend tests) and clean production builds:

1. **Authentication & Multi-Tenant Organization Isolation:**
   - Case-insensitive email registration, bcrypt password hashing, stateless JWT Bearer authorization.
   - Strict organization data isolation (`WHERE organization_id = :org_id`) on all database operations.
   - Granular RBAC permissions distinguishing Owner, Admin, and Member roles.
2. **Client CRM Subsystem:**
   - Full CRUD customer directory, contact details, tax identification numbers, and country codes.
   - Archiving and restoration workflow with foreign key protection on issued transactions.
3. **Invoice Lifecycle & Decimal Precision:**
   - Multi-line item invoice builder with item-level discounts, tax rates, and fractional quantities.
   - Banking-grade `Decimal` arithmetic engine utilizing `ROUND_HALF_UP` rounding (zero floating-point drift).
   - Strict state machine: `Draft` -> `Issued` -> `Partially Paid` -> `Paid` -> `Cancelled`.
   - Collision-safe sequential invoice numbering per organization (e.g. `INV-2026-0001`).
4. **Dynamic PDF Generation:**
   - Server-side PDF invoice rendering via ReportLab streaming binary `%PDF` with organization branding, itemized tables, and tax summaries.
5. **Payment Reconciliation & Reversals:**
   - Authoritative payment ledger supporting partial payments and multiple installments.
   - Automatic balance due calculation and overpayment prevention.
   - Audit-logged payment reversals with mandatory justification notes.
   - Idempotency key protection preventing duplicate payment submissions.
6. **Accounts Receivable Aging & Automated Reminders:**
   - Categorized aging breakdown (Current, 1–7 days, 8–30 days, 31–60 days, 60+ days overdue).
   - Email dispatch logs tracking provider delivery status.
   - Automated batch reminder processor with duplicate dispatch de-duplication.
7. **Financial Analytics & Secure CSV Exports:**
   - Centralized metrics: Invoiced Volume, Payments Collected, Outstanding Balances, Collection Rate %.
   - Streaming CSV export endpoints for invoices and payments with formula injection mitigation (CWE-1236).
8. **AI Receivables Assistant:**
   - Natural language query interface for instant financial inquiries.
   - Tone-customizable payment reminder drafting (`friendly`, `professional`, `firm`).
   - Read-only execution sandboxing with zero autonomous financial mutation permissions.
   - Transparent fallback from OpenAI (`gpt-4o-mini`) to deterministic rule-based heuristics for zero-cost operation.

---

## 4. Technology Stack

- **Backend:** Python 3.11, FastAPI 0.115, Pydantic v2, SQLAlchemy 2.0 ORM, Alembic 1.14.
- **Frontend:** Next.js 16.4 (App Router), React 19.3, TypeScript 5, Tailwind CSS 4, Lucide Icons.
- **Database:** PostgreSQL 14+ (production) / SQLite (development/testing).
- **PDF Engine:** ReportLab 4.2.
- **Testing:** Pytest 8.3, Pytest-Asyncio, Pytest-Cov (64 tests passing, 100%).
- **DevOps:** Docker, Docker Compose (multi-container with automatic migrations on startup).

---

## 5. Setup & Deployment Requirements

- **System Requirements:** Python 3.10+, Node.js 18.18+ (Node 20 LTS recommended), Docker Engine 24+ (optional).
- **Local Startup:**
  - Backend: `pip install -r requirements.txt && alembic upgrade head && uvicorn app.main:app --port 8000`
  - Frontend: `npm install && npm run dev` (Port 3000)
- **Production Startup:** `docker compose up --build`
- **Zero-Cost Out of the Box:** Runs 100% offline using SQLite and mock email/AI providers without requiring paid external API subscriptions.

---

## 6. Known Scope & Architectural Boundaries

1. **Payment Processing:** Authoritative server-side payment recording (checks, wires, manual cards). Direct third-party credit card tokenization (e.g. Stripe Checkout) is intentionally decoupled so buyers can configure their preferred payment gateway.
2. **Live External Accounts (Optional):**
   - Live email delivery to external inboxes requires user-configured SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`).
   - Live OpenAI completions require an `OPENAI_API_KEY`. (Operates via deterministic heuristics when omitted).

---

## 7. Included Assets & Documentation

- **Full Source Code:** Complete frontend (`frontend/`) and backend (`backend/`) source trees without minification or obfuscation.
- **Database Migrations:** Complete Alembic migration history (3 versions from initial schema to Phase 4 head).
- **Test Harness:** Complete Pytest test suite with 64 automated tests and Next.js 16 build configuration.
- **Documentation Package:**
  - `README.md` (Product introduction & overview)
  - `ARCHITECTURE.md` (System design & multi-tenant security architecture)
  - `SETUP.md` (Step-by-step Windows PowerShell & Linux setup guide)
  - `DEPLOYMENT.md` (Docker Compose, backup/restore, rollback, and health check guide)
  - `SECURITY_REVIEW.md` (Application security audit & vulnerability matrix)
  - `RELEASE_AUDIT.md` (Feature verification matrix with test references)
  - `RELEASE_TEST_REPORT.md` (Command logs & quality gate results)
  - `LICENSE_REVIEW.md` (100% permissive open-source license clearance)
  - `OWNERSHIP_AND_PROVENANCE.md` (Cleanroom authorship and origin certificate)
  - `BUYER_HANDOFF.md` (Commercial acquirer handoff, costs, and rebranding guide)
  - `CHANGELOG.md` (Version history across Phases 1–6)
  - `RELEASE_READINESS.md` (Official release determination)

---

## 8. Suggested Buyer Handoff Process

1. **Technical Code Review:** Buyer verifies the codebase by running `pytest -v` (64 tests) and `npm run build` (20 routes).
2. **Offline Git Archive Transfer:** Provide an immutable Git archive bundle or repository transfer.
3. **Configuration & Rebranding:** Buyer customizes branding assets, configures production `.env`, and deploys via Docker Compose or managed hosting.
