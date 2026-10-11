# InvoiceFlow AI — Setup & Local Development Guide

This guide provides instructions for setting up and running **InvoiceFlow AI** locally on Windows (PowerShell) and via Docker Compose.

---

## 1. Prerequisites

Ensure the following tools are installed on your machine:
- **Python**: 3.11 or higher
- **Node.js**: v18 or higher (v24 tested)
- **Docker & Docker Compose**: (Optional for containerized run)

---

## 2. Windows PowerShell Setup (Native Development)

### Step 1: Clone or Navigate to the Project Root
```powershell
cd "d:\InvoiceFlow AI"
```

### Step 2: Backend Virtual Environment & Dependencies
```powershell
# Create Python virtual environment
py -3.11 -m venv backend\.venv

# Activate the virtual environment
.\backend\.venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
.\backend\.venv\Scripts\pip.exe install -r backend\requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `backend\.env`:
```powershell
Copy-Item .env.example backend\.env
```
*(By default, backend will run with SQLite for instant local zero-dependency testing, or configure your PostgreSQL connection string).*

### Step 4: Run Database Migrations
```powershell
cd backend
..\backend\.venv\Scripts\alembic.exe upgrade head
cd ..
```

### Step 5: Run Automated Tests
```powershell
cd backend
..\backend\.venv\Scripts\pytest.exe -v
cd ..
```

### Step 6: Start Backend Development Server
```powershell
cd backend
..\backend\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000
```
The backend API is now running at:
- **API URL**: http://127.0.0.1:8000
- **Interactive OpenAPI Docs**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

---

## 3. Creating Your First User & Organization

You can register your first user account and workspace either:
1. **Via Frontend UI**: Visit `http://localhost:3000/register`, fill in your name, email, password, and workspace name.
2. **Via OpenAPI / curl**:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Alex Carter",
    "email": "alex@agency.com",
    "password": "Password123!",
    "organization_name": "Carter Digital Studio"
  }'
```
This automatically initializes the user and assigns them as the **OWNER** of their initial organization workspace.

---

## 4. Frontend Setup (Next.js)

Open a new PowerShell terminal:

```powershell
cd "d:\InvoiceFlow AI\frontend"

# Install frontend dependencies
npm.cmd install

# Start the Next.js development server
npm.cmd run dev
```

The frontend application is now accessible at:
- **Web App**: http://localhost:3000

---

## 5. Docker Compose Setup (One-Command Launch)

To run the full stack (PostgreSQL 16, FastAPI backend, Next.js frontend) with a single command:

```powershell
# Ensure Docker Desktop is running
docker compose up --build
```

Services started:
- `db`: PostgreSQL 16 on port `5432`
- `backend`: FastAPI on port `8000`
- `frontend`: Next.js on port `3000`

To tear down:
```powershell
docker compose down -v
```

---

## 6. Background Worker & Scheduled Reminders

InvoiceFlow AI includes a dedicated worker for evaluating due dates and dispatching payment reminders.

### Running as a Scheduled Job (Cron / One-off):
```powershell
cd backend
..\backend\.venv\Scripts\python.exe -m app.workers.reminder_worker
```

### Running as a Continuous Background Daemon:
```powershell
cd backend
..\backend\.venv\Scripts\python.exe -m app.workers.reminder_worker --daemon --interval 3600
```

### Configuring Transactional Email:
In your `.env` file, supply your SMTP credentials:
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASSWORD=your-smtp-password
SMTP_TLS=true
EMAIL_FROM=billing@yourdomain.com
EMAIL_FROM_NAME="Your Company Billing"
```
If credentials are not configured, the application safely rejects email requests with clear diagnostic messaging (`EmailConfigurationError`) rather than silently hanging or reporting false deliveries.

---

## 7. Phase 5: Analytics, CSV Exports & AI Receivables Assistant

### Configuring the AI Assistant:
InvoiceFlow AI includes an AI Receivables Assistant. The assistant is **fully optional** and never required for core operations:
```env
# Optional: Set to 'openai' for live LLM execution, or 'mock' for deterministic local rule-based analysis
AI_PROVIDER=mock
OPENAI_API_KEY=sk-your-openai-api-key-here
AI_MODEL=gpt-4o-mini
```
- **Without an API key (`AI_PROVIDER=mock`)**: The assistant generates full executive summaries, tone-based payment reminders (`friendly`, `professional`, `firm`), and answers natural language financial questions using deterministic backend calculation rules.
- **With an API key (`AI_PROVIDER=openai`)**: Synthesizes natural-language narratives and reminders using authenticated, organization-scoped financial figures as prompt context.
- **Safety**: The assistant never runs arbitrary SQL and has no autonomous permission to mutate records or send emails without human review.

### Verifying CSV Exports:
Exports are available at `/analytics`, `/invoices`, `/payments`, `/receivables`, and `/clients`.
All downloaded CSV files include UTF-8 BOM encoding for seamless display in Microsoft Excel and Google Sheets, and feature formula-injection defense (CWE-1236) to prevent untrusted formulas from executing.


