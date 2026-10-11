# InvoiceFlow AI — Production Deployment Guide

## 1. Overview

InvoiceFlow AI is designed for containerized deployment using Docker Compose, Docker Swarm, or Kubernetes. It can also be deployed to cloud platforms such as AWS ECS/App Runner, DigitalOcean App Platform, Render, or Railway.

---

## 2. Production Checklist

Before deploying to production, ensure the following configuration items are updated:

- [ ] Set `SECRET_KEY` to a cryptographically strong 64-character random string.
- [ ] Set `DATABASE_URL` to your production managed PostgreSQL database with SSL enabled (`sslmode=require`).
- [ ] Configure `ALLOWED_ORIGINS` to only allow your production domain (e.g. `https://app.invoiceflow.com`).
- [ ] Set `FRONTEND_URL` to your production domain.
- [ ] Configure real transactional email credentials (`EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`).
- [ ] (Optional) Set `OPENAI_API_KEY` if enabling AI reminder drafts and overdue summaries.

---

## 3. Database Migration Strategy

Before starting the backend containers in production, run Alembic migrations:

```bash
alembic upgrade head
```

In Docker environments, this can be executed via an init-container or entrypoint script.

---

## 4. Backup & Disaster Recovery Strategy

1. **Daily Automated PostgreSQL Dumps**:
   ```bash
   pg_dump -U invoiceflow -d invoiceflow_db -F c -b -v -f /backups/invoiceflow_$(date +%Y%m%d_%H%M%S).dump
   ```
2. **Point-In-Time Recovery (PITR)**:
   For managed databases (AWS RDS, DigitalOcean Managed PostgreSQL), enable 7 to 30 days of automated WAL archiving and daily snapshot retention.
3. **Backup Testing**:
   Periodically restore backup dumps to a staging database to verify backup integrity.

---

## 5. Reverse Proxy & SSL Configuration

A reverse proxy (Nginx, Traefik, Caddy, or Cloudflare) should terminate TLS/HTTPS and route traffic:
- `https://yourdomain.com/*` -> Next.js Frontend (`:3000`)
- `https://yourdomain.com/api/*` -> FastAPI Backend (`:8000`)
- `https://yourdomain.com/docs` -> FastAPI OpenAPI Docs (`:8000`)

---

## 6. Background Reminder Worker Deployment

Deploy the reminder worker as a dedicated background service or cron job:

### Option A: Systemd Daemon / Docker Worker Container
```ini
[Unit]
Description=InvoiceFlow AI Scheduled Reminder Worker
After=network.target

[Service]
Type=simple
User=invoiceflow
WorkingDirectory=/opt/invoiceflow/backend
ExecStart=/opt/invoiceflow/backend/.venv/bin/python -m app.workers.reminder_worker --daemon --interval 3600
Restart=always
RestartSec=10
EnvironmentFile=/opt/invoiceflow/.env

[Install]
WantedBy=multi-user.target
```

### Option B: Linux Cron Job (Daily Run)
```cron
# Run daily at 08:00 UTC
0 8 * * * cd /opt/invoiceflow/backend && /opt/invoiceflow/backend/.venv/bin/python -m app.workers.reminder_worker >> /var/log/invoiceflow_reminders.log 2>&1
```
Idempotency keys ensure that multiple workers or cron retries will never send duplicate emails for the same invoice rule milestone.

---

## 7. Analytics, CSV Exports & AI Deployment Considerations

### Database Query Optimization:
- Organization-scoped indexes (`ix_invoices_organization_id`, `ix_payments_organization_id`, `ix_clients_organization_id`) ensure fast analytics summaries and reports.
- Composite date filtering uses indexed date fields (`issue_date`, `due_date`, `payment_date`).
- Independent client aggregation queries avoid Cartesian cross-joins and memory spikes during reporting.

### CSV Export Streaming & Memory Limits:
- CSV export endpoints stream UTF-8 formatted CSV data directly to the client response, avoiding memory bottlenecks on large datasets.
- Client applications can consume exports using streaming buffers or standard browser downloads with `Content-Disposition: attachment`.

### AI Provider Deployment:
- Deploy with `AI_PROVIDER=openai` and `OPENAI_API_KEY` set in the environment variables, or leave as `AI_PROVIDER=mock` for air-gapped or zero-cost deployments.
- Outbound requests to `api.openai.com` require standard HTTPS outbound egress on port 443.
- Rate limits and transient network timeouts to the AI provider are handled gracefully with automatic fallback to deterministic summaries.

---

## 8. Database Backup & Restoration Procedure

### 8.1 Automated Backup Creation (PostgreSQL)
Run scheduled backups using `pg_dump`:
```bash
pg_dump -h db.example.com -U invoiceflow -d invoiceflow_db -F c -b -v -f /backups/invoiceflow_$(date +%Y%m%d_%H%M%S).dump
```

### 8.2 Database Restoration
To restore a snapshot into a clean database:
```bash
# 1. Terminate existing connections (if restoring to active staging db)
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'invoiceflow_db' AND pid <> pg_backend_pid();"

# 2. Restore using pg_restore
pg_restore -U invoiceflow -d invoiceflow_db -v -c --if-exists /backups/invoiceflow_snapshot.dump

# 3. Verify schema state against Alembic
cd /opt/invoiceflow/backend
alembic current
```

---

## 9. Rollback Guidance

In the event of an unsuccessful deployment:

1. **Application Container Rollback:**
   - Revert your container image tag or git commit to the previous stable release hash.
   - Restart the containers: `docker compose up -d` or redeploy your previous ECS/Kubernetes revision.
2. **Database Migration Downgrade (If Necessary):**
   - If a new migration failed or caused regressions, step down one migration revision:
     ```bash
     alembic downgrade -1
     ```
   - Always verify data integrity before executing downgrades in production.

---

## 10. Health Checks & Troubleshooting

### Health Check Probes:
- **Backend Liveness & Readiness:**
  `GET https://yourdomain.com/health`
  Returns `200 OK` with JSON:
  ```json
  {
    "status": "healthy",
    "version": "1.0.0",
    "database": "connected",
    "timestamp": "2026-10-11T21:40:00Z"
  }
  ```
- **Frontend Liveness:**
  `GET https://yourdomain.com/` returns `200 OK`.

### Troubleshooting Common Deployment Failures:
1. **CORS / Network Error in Browser:**
   - Symptom: API requests fail with CORS errors in browser console.
   - Cause: `ALLOWED_ORIGINS` in `.env` does not match the frontend domain.
   - Solution: Add the exact frontend origin (including protocol and port, e.g. `https://app.yourdomain.com`) to `ALLOWED_ORIGINS` in `.env` and restart the backend.
2. **Database Connection Refused:**
   - Symptom: Backend logs `OperationalError: connection to server at "localhost", port 5432 failed`.
   - Solution: In Docker Compose, the database hostname is `db`, not `localhost`. Set `DATABASE_URL=postgresql://invoiceflow:invoiceflow_secret@db:5432/invoiceflow_db`.
3. **Missing Environment Variables:**
   - Symptom: Application crashes on startup with `ValidationError`.
   - Solution: Ensure mandatory environment variables (`SECRET_KEY`, `DATABASE_URL`) are present. Refer to `.env.example`.



