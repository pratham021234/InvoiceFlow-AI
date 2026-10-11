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
