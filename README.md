# InvoiceFlow AI

**InvoiceFlow AI** is a commercially reusable, full-stack invoice and payment automation SaaS designed for freelancers, agencies, consultants, and small businesses.

Built with **Next.js App Router (TypeScript + Tailwind CSS)** and **Python FastAPI (SQLAlchemy 2 + PostgreSQL + Alembic)**, InvoiceFlow AI provides banking-grade financial correctness, strict multi-tenant data isolation, downloadable PDF generation, customizable email reminders, and AI-powered payment follow-ups.

---

## 🌟 Modules & Current Progress

- [x] **Phase 1: Project Foundation & Financial Correctness Engine**
  - Architecture specifications, Docker Compose, Alembic migration framework.
  - High-precision `Decimal` financial arithmetic engine with `ROUND_HALF_UP` 2-decimal rounding.
  - Zero-trust server-side calculation and overpayment prevention.
- [x] **Phase 2: Authentication, Database & Multi-Tenant Security**
  - Robust user registration, login, logout, and `/api/v1/auth/me` endpoints.
  - Email normalization and bcrypt password hashing.
  - Multi-tenant organization creation, listing, details, and settings management.
  - Strict tenant isolation dependencies (`get_current_active_org_member`) with automated regression tests.
  - Role-based access control (`owner`, `admin`, `member`) on organization settings.
  - Complete Next.js frontend pages: `/login`, `/register`, `/dashboard`, `/organizations/new`, `/settings/organization`.
- [x] **Phase 3: Client CRM, Invoice Lifecycle & Authoritative PDF Engine**
  - Complete database-backed Client CRM with contact details, ISO countries, tax IDs, archiving, and balance tracking.
  - Strict non-cascading `RESTRICT` deletion policies preventing hard deletion of clients referencing issued invoices.
  - Transactional, collision-safe invoice numbering per organization (`org.invoice_prefix` + sequence with database locking).
  - Authoritative backend financial calculation service supporting fractional quantities, discounts, tax rates, and rounding boundaries.
  - Dynamic invoice status calculation distinguishing Draft, Issued, Partially Paid, Paid, Overdue, and Cancelled.
  - Backend ReportLab PDF invoice generation engine with dynamic page numbering (`NumberedCanvas`), organization logo integration, and security checks.
  - 8 responsive Next.js frontend pages (`/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit`, `/invoices`, `/invoices/new`, `/invoices/[id]`, `/invoices/[id]/edit`).
  - 36 comprehensive automated backend pytest tests covering edge calculations, lifecycle restrictions, tenant isolation, and PDF generation.
- [x] **Phase 4: Payments, Receivables & Email Automation**
  - Authoritative payment ledger with partial payments, multiple installments, and strict overpayment prevention.
  - GAAP-compliant immutable payment reversals with auditable reasons and atomic balance recalculation.
  - Accounts Receivable module with standard aging buckets (Current, 1–7d, 8–30d, 31–60d, 60+d).
  - Transactional email delivery via standard SMTP with STARTTLS and PDF invoice attachments.
  - Email delivery logs tracking provider submission (`accepted_by_provider`) vs confirmed delivery.
  - Scheduled payment reminder daemon (`app.workers.reminder_worker`) with milestone rules and idempotency de-duplication.
  - Fully dynamic financial dashboard with live receivables, collected revenue, overdue balances, and recent transaction history.
  - 50 passing automated tests covering payment edge cases, reversals, tenant isolation, and scheduler idempotency.
- [x] **Phase 5: Analytics, Reports, CSV Exports and AI Receivables Assistant**
  - Centralized financial analytics service (`analytics_service.py`) computing Invoiced Amount, Cash Collected, Outstanding Receivables, Overdue Receivables, Partially Paid Amount, Collection Rate %, Average Days to Settle, and Month-over-Month changes.
  - Revenue trends and collection time series comparing invoiced volume against completed cash receipts over monthly periods.
  - Overdue aging breakdown analytics across standard GAAP brackets (Current, 1–7d, 8–30d, 31–60d, 60+d) based strictly on outstanding balance.
  - Client performance leaderboard report with duplicate-join prevention across multi-payment records.
  - Secure streaming CSV exports for Invoices, Payments, Clients, Receivables, Overdue Invoices, and Monthly Financials with formula injection mitigation (CWE-1236) and UTF-8 BOM encoding.
  - AI Receivables Assistant (`ai_assistant_service.py`) supporting executive narrative financial summaries, tone-based payment reminder drafting (`friendly`, `professional`, `firm`), and constrained read-only natural language queries with deterministic intent validation.
  - Zero-external key dependency with seamless rule-based fallback and strict human-in-the-loop review.
  - Dedicated Next.js Analytics dashboard (`/analytics`) with interactive metric cards, trend visualizer, aging bars, client leaderboard, export dropdowns, and AI drawer.
  - 63 comprehensive automated backend pytest tests passing (100%).
- [ ] **Phase 6: Production Packaging & Commercial Marketplace Distribution**

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Lucide Icons |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| **Database** | PostgreSQL 16 (production/docker), SQLite (local zero-config test/dev) |
| **PDF Engine** | ReportLab 4.2 |
| **Security** | Passlib (Bcrypt), Python-JOSE (JWT HS256) |
| **Testing** | Pytest 8.3, Pytest-Asyncio, Pytest-Cov |
| **DevOps** | Docker, Docker Compose |

---

## 🚀 Quick Start

### 1. Using Docker Compose (Recommended)
```bash
docker compose up --build
```
- App: `http://localhost:3000`
- API Docs: `http://localhost:8000/docs`

### 2. Native Local Development (Windows PowerShell)

#### Backend:
```powershell
cd backend
..\backend\.venv\Scripts\Activate.ps1
..\backend\.venv\Scripts\pip.exe install -r requirements.txt
..\backend\.venv\Scripts\alembic.exe upgrade head
..\backend\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

#### Frontend:
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

---

## 🧪 Automated Tests

Run backend tests using pytest:

```powershell
cd backend
..\backend\.venv\Scripts\pytest.exe -v
```

All 63 unit, integration, financial calculation, and multi-tenant security regression tests execute cleanly:
```text
tests/test_auth.py (8 passed)
tests/test_clients.py (4 passed)
tests/test_decimal_engine.py (10 passed)
tests/test_health.py (2 passed)
tests/test_invoices_lifecycle.py (5 passed)
tests/test_mass_assignment_and_constraints.py (2 passed)
tests/test_organizations_isolation.py (3 passed)
tests/test_payments.py (8 passed)
tests/test_pdf_generation.py (2 passed)
tests/test_receivables_and_email.py (6 passed)
tests/test_analytics.py (6 passed)
tests/test_csv_export.py (3 passed)
tests/test_ai_assistant.py (4 passed)
======================= 63 passed in 26.98s =======================
```

---

## 📖 Project Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, tenant isolation, and financial rules.
- [SETUP.md](SETUP.md) — Detailed setup instructions for Windows PowerShell and Docker.
- [SECURITY.md](SECURITY.md) — Security policies, token handling, and multi-tenant guarantees.
- [TESTING.md](TESTING.md) — Testing strategy, test suites, and coverage reports.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment, migrations, and disaster recovery.

---

## 📄 License & Commercial Distribution

This codebase is prepared as a clean, modular SaaS foundation suitable for commercial deployment, white-labeling, or distribution on software marketplaces.
