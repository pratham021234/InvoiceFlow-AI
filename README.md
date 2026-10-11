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
- [ ] **Phase 4: Payment Gateway Integration & Payment Ledger**
- [ ] **Phase 5: Email Reminders, Delivery Logs & AI Assistance**
- [ ] **Phase 6: Financial Reports, Cashflow Analytics & CSV Exports**
- [ ] **Phase 7: Production Packaging & Commercial Distribution**

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

All 36 unit, integration, and cross-tenant security regression tests execute cleanly:
```text
tests/test_auth.py (8 passed)
tests/test_clients.py (4 passed)
tests/test_decimal_engine.py (10 passed)
tests/test_health.py (2 passed)
tests/test_invoices_lifecycle.py (5 passed)
tests/test_mass_assignment_and_constraints.py (2 passed)
tests/test_organizations_isolation.py (3 passed)
tests/test_pdf_generation.py (2 passed)
======================= 36 passed in 13.20s =======================
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
