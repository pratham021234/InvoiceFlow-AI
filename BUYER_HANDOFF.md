# InvoiceFlow AI — Commercial Buyer & Acquirer Handoff Guide

**Release Version:** 1.0.0 (Production Ready)  
**Distribution Channel:** Commercial Licensing / TrainPlex Codebase Marketplace  
**Audience:** Technical Acquirers, Engineering Directors, SaaS Operators, Full-Stack Developers  

---

## 1. What You Receive

Upon acquisition of InvoiceFlow AI, you receive a full-stack, enterprise-grade software-as-a-service (SaaS) application ready for commercial deployment, private-label rebranding, or integration into existing software ecosystems:

1. **Backend Codebase (`backend/`):**
   - High-performance FastAPI application with Pydantic v2 schemas and SQLAlchemy 2.0 ORM.
   - Comprehensive Alembic database migration scripts (all revisions from baseline to head).
   - High-precision decimal financial engine (`ROUND_HALF_UP`) with tax and discount calculation logic.
   - Robust payment reconciliation state machine with idempotency and reversal logging.
   - Dynamic PDF generation engine utilizing ReportLab with multi-currency formatting.
   - Natural language AI assistant with OpenAI integration and deterministic heuristic fallback.
   - Complete Pytest automated test harness with **63 automated unit, integration, and security tests**.

2. **Frontend Codebase (`frontend/`):**
   - Modern Next.js 16 (App Router) with React 19 and TypeScript 5.
   - Tailwind CSS v4 styling with dark-slate theme and responsive layouts.
   - 20 complete application pages (auth, multi-org, CRM, invoice builder, payments, receivables, analytics, settings).
   - Centralized, strongly typed API client layer (`src/lib/api.ts`).
   - Clean production build with 0 ESLint errors and 0 TypeScript compilation errors.

3. **Infrastructure & DevOps (`/`):**
   - Multi-container `docker-compose.yml` for unified PostgreSQL, backend API, and frontend deployment.
   - Complete `.env.example` with zero hardcoded production credentials.
   - Comprehensive technical documentation (`README.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, `SETUP.md`, `SECURITY.md`, `TESTING.md`, `SECURITY_REVIEW.md`, `RELEASE_AUDIT.md`, `RELEASE_TEST_REPORT.md`, `LICENSE_REVIEW.md`, `OWNERSHIP_AND_PROVENANCE.md`).

---

## 2. System Requirements

### Development Environment:
- **Operating System:** Windows 10/11, macOS (Apple Silicon or Intel), or Linux (Ubuntu 22.04+).
- **Python:** Python 3.10, 3.11, or 3.12 (Python 3.11 recommended).
- **Node.js:** Node.js v18.18+, v20 LTS, or v22 LTS (v20 LTS recommended) with `npm` v10+.
- **Database:** PostgreSQL 14+ (production) or SQLite 3.35+ (local development/testing).
- **Memory / CPU:** Minimum 2 GB RAM and 2 vCPUs for local development.

### Production Environment:
- **Container Host:** Docker Engine 24+ and Docker Compose v2.
- **Managed Database:** PostgreSQL 14+ (AWS RDS, Supabase, Neon, or self-hosted).
- **Hosting Targets:** AWS ECS / DigitalOcean App Platform / Render / Railway / Hetzner VPS.
- **Recommended VPS Spec:** 2 vCPU, 4 GB RAM, 20 GB SSD storage.

---

## 3. Installation & Quickstart (Windows PowerShell)

### Step 1: Clone and Configure Environment
```powershell
git clone <your-repository-url> invoiceflow-ai
cd invoiceflow-ai

# Copy environment variables
Copy-Item .env.example .env
```

### Step 2: Set Up Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# Run database migrations
python -m alembic upgrade head

# Run automated tests to verify clean environment
python -m pytest -v
```

### Step 3: Set Up Frontend
```powershell
cd ..\frontend
npm install

# Verify production build and linting
npm run lint
npm run build
```

### Step 4: Run Development Services
- **Backend (Port 8000):**
  ```powershell
  cd ..\backend
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
  ```
- **Frontend (Port 3000):**
  ```powershell
  cd ..\frontend
  npm run dev
  ```
- Access application in browser at: `http://localhost:3000`

---

## 4. Required & Optional External Services

| Service | Provider Options | Purpose | Default Behavior if Unconfigured |
| :--- | :--- | :--- | :--- |
| **Database** | PostgreSQL 14+ (or SQLite) | Core relational storage | Defaults to SQLite file or Docker PostgreSQL. |
| **Transactional Email** | SMTP / SendGrid / Postmark / Mailgun | Sending invoice PDFs & payment reminders | Defaults to `EMAIL_PROVIDER=mock` (logs emails without sending). |
| **AI Assistant** | OpenAI (`gpt-4o-mini`) | AI natural language summaries and draft reminders | Defaults to `AI_PROVIDER=mock` (uses deterministic rule-based heuristics). |

---

## 5. Ongoing Operating Costs Estimate

| Scale / Tier | Infrastructure & Services | Estimated Monthly Cost |
| :--- | :--- | :--- |
| **Staging / Demonstration** | Self-hosted VPS (Hetzner / DigitalOcean) + Mock AI & Email | **$5.00 – $10.00 / mo** |
| **Small Commercial (100–500 users)** | Managed PostgreSQL (Neon/Supabase Free/Pro) + Render / Railway + SendGrid Essentials ($19.95) + OpenAI ($5) | **$35.00 – $60.00 / mo** |
| **Growth SaaS (1,000–5,000 users)** | AWS RDS PostgreSQL (db.t4g.small) + AWS ECS Fargate + Postmark + OpenAI API | **$120.00 – $250.00 / mo** |

---

## 6. Private-Label Rebranding Instructions

To rebrand InvoiceFlow AI to your own corporate brand:

1. **Application Name & Metadata:**
   - Update `PROJECT_NAME` in `.env` and `backend/app/core/config.py`.
   - Update metadata titles and descriptions in `frontend/src/app/layout.tsx`.
2. **Logos & Visual Icons:**
   - Replace favicon in `frontend/src/app/favicon.ico`.
   - Update the SVG logo marks in `frontend/src/app/login/page.tsx`, `frontend/src/app/dashboard/page.tsx`, and sidebar components.
3. **Color Theme & Styling:**
   - Modify color variables in `frontend/src/app/globals.css`.
   - The primary palette is styled with Tailwind CSS slate and indigo shades (`bg-slate-900`, `text-indigo-400`). Replace with your corporate brand tokens.
4. **Email Footers & System Communication:**
   - Update default email signatures and company contact details in `backend/app/services/email_service.py`.

---

## 7. Known Architectural Scope & Features Requiring Custom Setup

1. **Payment Gateways (Stripe / PayPal / Adyen):**
   - The application provides authoritative backend payment recording, partial payments, reconciliation, balance tracking, and reversal tracking.
   - Direct customer-facing credit card checkout (e.g. Stripe Checkout) was intentionally not bundled to give buyers freedom in choosing their merchant aggregator. Webhook stubs and service extension points are provided in `backend/app/services/payment_service.py`.
2. **Live External Credentials:**
   - To send emails to real inboxes, configure your SMTP server host and credentials in `.env`.
   - To query live OpenAI models, set `AI_PROVIDER=openai` and specify your `OPENAI_API_KEY`.
3. **Background Schedulers:**
   - An automated daily reminder runner can be triggered via standard cron, AWS EventBridge, or Celery invoking the batch reminder endpoint `POST /api/v1/reminders/process-scheduled`.

---

## 8. Backup & Maintenance Responsibilities

As the software operator, you are responsible for:
1. **Automated Database Backups:** Implement daily `pg_dump` snapshots and point-in-time recovery (WAL archiving) on your PostgreSQL database.
2. **Secret Key Management:** Ensure `SECRET_KEY` in `.env` is generated with high entropy (e.g., `openssl rand -hex 32`) and rotated periodically.
3. **Dependency Maintenance:** Apply routine security patches using `pip audit` and `npm audit`.

---

## 9. Verification & Acceptance Testing

Before signing off on the acquisition or deployment, execute the following commands in sequence:
1. Backend Tests: `cd backend && python -m pytest -v` (Must output 63 passed).
2. Frontend Lint: `cd frontend && npm run lint` (Must exit 0).
3. Frontend Production Build: `cd frontend && npm run build` (Must output 20 routes compiled, exit 0).
4. Migration Check: `cd backend && python -m alembic upgrade head --sql` (Must exit 0).
