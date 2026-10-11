# InvoiceFlow AI — Code Ownership & Provenance Report

**Audit Date:** 2026-10-11  
**Project:** InvoiceFlow AI  
**Repository Branch:** `main`  
**Auditor Roles:** Commercial Codebase Auditor, Software Architect  

---

## 1. Provenance Statement & Authorship History

This document establishes the origin, intellectual property lineage, and authorship provenance of the **InvoiceFlow AI** codebase for prospective acquirers, marketplace operators (such as TrainPlex), and commercial licensees.

### 1.1 Git History & Commit Lineage
- **Primary Lineage:** The repository reflects a structured, multi-phase engineering progression starting from initial architectural setup through Phases 1–5 and Phase 6 production hardening.
- **Repository Commits:**
  - `62ed4db`: Initial commit establishing project baseline.
  - `b7f3c9c`: Core implementation incorporating Phases 1–5 full-stack SaaS architecture.
  - Current Workspace Branch: `main` with Phase 6 quality gates, ESLint/Turbopack compliance, and release audits.
- **Cleanroom Implementation:** The application was authored specifically as an independent, bespoke SaaS product for automated invoicing, payments, and receivables management. It is not a fork, clone, or direct derivative of existing proprietary commercial invoicing platforms (such as QuickBooks, FreshBooks, or Xero).

---

## 2. Inventory of Original Work & Assets

The following core components represent original software engineering assets authored specifically for InvoiceFlow AI:

1. **Backend Application (`backend/`):**
   - **Financial Precision Engine (`app/services/calculation_service.py`):** Custom decimal arithmetic engine implementing tax, line discounts, fractional quantity calculations, and `ROUND_HALF_UP` quantization.
   - **Payment Reconciliation Service (`app/services/payment_service.py`):** Authoritative state machine for partial payments, balance re-computation, overpayment blocking, and audit-logged reversals.
   - **Multi-Tenant Security Middleware & Dependencies (`app/api/deps.py`):** Custom organization context validation and role-based access control (RBAC).
   - **Automated Reminder & Aging Engine (`app/services/email_service.py`, `app/api/v1/endpoints/reminders.py`):** Deduplication and idempotency algorithms for scheduled payment reminders.
   - **AI Context Builder & Natural Language Assistant (`app/services/ai_assistant_service.py`):** Custom analytical heuristic logic, query parsing, and prompt injection isolation boundaries.
   - **PDF Generation Layout (`app/services/pdf_service.py`):** Custom ReportLab canvas styling, table structures, and multi-currency formatting.

2. **Frontend Application (`frontend/`):**
   - **Next.js 16 App Router Interfaces (`src/app/`):** 20 bespoke pages covering authentication, multi-organization setup, CRM client directories, visual invoice builder, payment history, accounts receivable aging tables, visual financial analytics dashboards, and organization branding settings.
   - **Unified API Client (`src/lib/api.ts`):** Custom 860-line TypeScript API abstraction managing token storage, organization headers, type definitions, and backend communication.
   - **UI Design System:** Custom responsive styling utilizing Tailwind CSS v4, dark-slate visual theme, glassmorphic cards, and inline SVG branding marks.

---

## 3. Third-Party Components & Attributions

InvoiceFlow AI incorporates well-established, permissively licensed open-source libraries as dependencies. All dependencies are maintained via standard package managers (`pip` and `npm`) and are not modified at the source level.

### 3.1 Backend Open-Source Attributions
- **FastAPI:** Copyright (c) Sebastián Ramírez (MIT License).
- **SQLAlchemy:** Copyright (c) Michael Bayer (MIT License).
- **Pydantic:** Copyright (c) Samuel Colvin and contributors (MIT License).
- **ReportLab:** Copyright (c) ReportLab Europe Ltd (BSD-3-Clause License).
- **Uvicorn:** Copyright (c) Encode OSS Ltd (BSD-3-Clause License).
- **Python-Jose:** Copyright (c) Michael Davis (MIT License).

### 3.2 Frontend Open-Source Attributions
- **Next.js & React:** Copyright (c) Vercel, Inc. / Meta Platforms, Inc. (MIT License).
- **Lucide Icons (`lucide-react`):** Copyright (c) Lucide Contributors (ISC License).
- **Tailwind CSS:** Copyright (c) Tailwind Labs, Inc. (MIT License).

No third-party proprietary code snippets, closed-source SDKs, or uncredited libraries are incorporated.

---

## 4. External Services & Operational Terms

The codebase is engineered to run completely autonomously without mandatory external paid subscriptions:
- **Default Operation:** Employs an in-memory/mock email provider and deterministic analytical heuristic engine. Zero monthly API fees required for development or core demonstration.
- **Optional Upstream Services:**
  - **OpenAI API:** If enabled, subject to OpenAI’s Business Terms of Service. All generated text belongs to the operator.
  - **SMTP Relays (SendGrid, Postmark, Mailgun):** If enabled, subject to the chosen provider's commercial terms.

---

## 5. Provenance Review Gaps & Recommendations for Buyers

1. **Custom Domain & Branding:** The default name "InvoiceFlow AI" and placeholder logos are provided for demonstration. Prospective commercial buyers are advised to register their own trademark and replace default branding assets (guidance provided in `BUYER_HANDOFF.md`).
2. **Third-Party Security Audits:** While extensive automated test coverage (63 tests) and static linting are verified, enterprise acquirers intending to handle high-volume financial data should perform their customary pre-acquisition penetration testing and compliance reviews.

---

## 6. Transferability & Commercial Clearance

The InvoiceFlow AI repository is completely unencumbered by restrictive licenses, external investor liens, or third-party proprietary dependencies. The seller/licensor possesses the full legal right to transfer, sell, or license the codebase under commercial marketplace agreements (e.g. TrainPlex).
