# InvoiceFlow AI — Phase 7 Action Plan & Verification Roadmap

**Execution Phase:** Phase 7 — Final Verification, Release Blockers & TrainPlex Submission Preparation  
**Auditor / Engineer:** Senior Software Architect, Security Engineer, QA Lead, Commercial Codebase Auditor  
**Date:** 2026-10-11  

---

## 1. Issue Prioritization Matrix

### 1.1 Critical Blockers (Release & Evaluation Gate)
*Issues that would prevent a prospective buyer, auditor, or automated analyzer from building, launching, or testing the application.*

1. **Frontend / Backend Build Failures:**
   - *Status:* **Resolved in Phase 6.** Next.js 16 compiler closure errors resolved in invoice builders. Production build (`next build`) compiles 20 routes cleanly.
   - *Phase 7 Action:* Re-verify production build and ensure zero regressions.
2. **Database Migration Consistency:**
   - *Status:* **Verified in Phase 6.** Alembic heads `2da831fc599b` tested offline.
   - *Phase 7 Action:* Run automated migration execution against clean SQLite and PostgreSQL schema files to verify zero foreign key or table sequencing errors.
3. **Core API Client Tracking (.gitignore Regression):**
   - *Status:* **Resolved in Phase 6.** `.gitignore` was unignored for `frontend/src/lib/api.ts` and committed.
   - *Phase 7 Action:* Verify clean repository clone / check-out includes `frontend/src/lib/api.ts`.
4. **Secret Leakage in Git History:**
   - *Status:* **Verified clean.** Scanned git commit log; zero production API keys or tokens committed.
   - *Phase 7 Action:* Validate that `.env.example` remains populated only with non-sensitive placeholders.

---

### 1.2 High-Priority Issues (Financial & Security Integrity)
*Issues affecting commercial value, data isolation, or legal compliance.*

1. **End-to-End Customer Journey Execution:**
   - *Issue:* Verification needed that all 13 steps of the primary customer journey (Register -> Profile -> Client CRM -> Multi-item Invoice -> PDF -> Partial/Full Payments -> Aging -> Reminders -> Analytics -> CSV Export -> AI Queries -> Re-auth -> Cross-tenant Isolation) execute successfully in an integrated scenario.
   - *Phase 7 Action:* Implement and execute a dedicated end-to-end customer journey regression suite (`tests/test_customer_journey_e2e.py`) verifying all 13 steps sequentially with exact assertion tracking.
2. **Docker Compose Build & Environment Parity:**
   - *Issue:* Verify `docker-compose.yml`, `backend/Dockerfile`, and `frontend/Dockerfile` have matching environment variable contracts and build arguments (e.g. `NEXT_PUBLIC_API_URL`).
   - *Phase 7 Action:* Inspect and refine `frontend/Dockerfile` to accept `ARG NEXT_PUBLIC_API_URL` during build.
3. **Multi-Tenant Boundary Strictness:**
   - *Issue:* Absolute requirement that tenant B cannot read, update, download PDFs, or export records belonging to tenant A.
   - *Phase 7 Action:* Validate tenant isolation assertions across all endpoints during customer journey testing.

---

### 1.3 Medium-Priority Issues (Developer Experience & Documentation)
*Issues that impact smooth onboarding and technical evaluation on TrainPlex.*

1. **Clean Installation Documentation on Windows PowerShell:**
   - *Issue:* Commands in `SETUP.md` must be 100% executable without syntax errors (e.g., using `;` or separate lines instead of bash `&&`).
   - *Phase 7 Action:* Audit `SETUP.md` and `BUYER_HANDOFF.md` for PowerShell compatibility.
2. **Safe Default Configuration for Offline Demonstration:**
   - *Issue:* By default, `EMAIL_PROVIDER` and `AI_PROVIDER` must default to `mock` so an evaluator can run the software immediately with $0 external spend.
   - *Phase 7 Action:* Confirm `.env.example` and `config.py` default to `mock`.

---

### 1.4 Optional Improvements (Future Enhancements Post-Sale)
1. **Direct Stripe / PayPal Webhook Ingestion:**
   - Deferred by architecture design (manual payment recording is authoritative). Webhook stubs documented for future buyer integration.
2. **Redis-backed Token Revocation Blocklist:**
   - Stateless JWT tokens expire naturally; Redis blacklist can be added by buyer for instantaneous revocation.

---

## 2. Exact Verification Plan

| Action Item | Verification Method | Expected Outcome |
| :--- | :--- | :--- |
| **Backend Test Suite** | Run `pytest -v` | 63 existing tests pass without failure. |
| **End-to-End Customer Journey** | Execute `test_customer_journey_e2e.py` | 13/13 customer journey steps succeed. |
| **Frontend Static Analysis** | Run `npm run lint` | 0 errors. |
| **Frontend Production Build** | Run `npm run build` | 20 routes generated, exit code 0. |
| **Alembic Migrations** | Run `alembic upgrade head --sql` | Valid DDL generated with 0 errors. |
| **Secret Scan** | Git history pattern check | No real credentials present. |
| **Commercial Listing Draft** | Author `TRAINPLEX_LISTING_DRAFT.md` | Accurate, non-inflated commercial description. |
| **Milestone Decision** | Update `RELEASE_READINESS.md` | Formal release readiness signoff. |
