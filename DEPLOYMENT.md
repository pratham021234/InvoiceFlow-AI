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


