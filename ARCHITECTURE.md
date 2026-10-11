# InvoiceFlow AI — System Architecture & Design

## 1. System Overview

**InvoiceFlow AI** is a production-grade, multi-tenant invoice generation, tracking, and payment automation SaaS designed for freelancers, agencies, and small businesses. The system is architected as an API-first platform with a modern Next.js App Router client, backed by FastAPI, SQLAlchemy 2, PostgreSQL, and ReportLab.

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Frontend                     │
│      (App Router, TypeScript, Tailwind CSS, Lucide)     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / JSON REST (Bearer JWT)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
│   ┌────────────────────────────────────────────────┐   │
│   │  Auth & Multi-Tenant Dependency Layer (Tenant) │   │
│   │  • get_current_user                            │   │
│   │  • get_current_active_org_member               │   │
│   │  • RoleChecker([OWNER, ADMIN])                 │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │          Domain Services & Business Logic      │   │
│   │   • user_service (Registration, Auth, Bcrypt)  │   │
│   │   • organization_service (Multi-Tenant Org)    │   │
│   │   • audit_service (Security Audit Logging)     │   │
│   │   • decimal_utils (Financial Exact Arithmetic) │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │          SQLAlchemy 2 Data Access Layer         │   │
│   └──────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│             PostgreSQL 16 Database Engine              │
│  (Strict Tenant Isolation with org_id Foreign Keys)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tenant Isolation Strategy (Phase 2 Architecture)

InvoiceFlow AI enforces **row-level multi-tenant isolation**:
1. **User Identity & Multi-Organization Memberships**:
   - A single `User` account can belong to multiple `Organizations`.
   - Each relationship is recorded in `organization_members` with an explicit `role` (`owner`, `admin`, `member`) and `status` (`active`, `invited`, `suspended`).
   - A unique constraint `uq_org_member` prevents duplicate memberships.
2. **Tenant Resolution & Scoping**:
   - Every organization-scoped endpoint validates that the calling user has an `active` membership in the specified organization via `get_current_active_org_member`.
   - Access attempts to an organization where the user lacks active membership immediately raise `HTTP 403 Forbidden`.
   - Query filters strictly scope records using `WHERE organization_id = :current_org_id`.
3. **Role-Based Access Control (RBAC)**:
   - Organization settings, invoicing prefix configuration, and member rosters can only be modified by members holding `owner` or `admin` roles via `RoleChecker([MemberRole.OWNER, MemberRole.ADMIN])`.
   - Regular `member` accounts are restricted to read-only access.
4. **Defense-in-Depth against Mass Assignment**:
   - Pydantic schemas explicitly separate user inputs from internal fields (`owner_id`, `id`, `created_at`, `status`). Attempts to overwrite read-only keys are ignored or rejected.

---

## 3. Financial Correctness Engine

Financial calculations adhere to banking-grade accounting standards:

### Exact Decimal Precision
- Monetary calculations are never executed using floating-point types (`float`).
- Python's `decimal.Decimal` is used across all calculations.
- Monetary storage uses `Numeric(14, 2)` (supporting amounts up to $999,999,999,999.99).
- Quantization is strictly applied with `ROUND_HALF_UP` to two decimal places (`0.01`).
- Tax and discount percentage rates support up to four decimal places (`0.0001`).

### Authoritative Backend Order of Operations
The frontend calculations are strictly for user preview convenience. Authoritative numbers are computed on the backend using `LineItemCalculation`:
1. `line_subtotal = quantize_money(quantity * unit_price)`
2. `line_discount = quantize_money(line_subtotal * (discount_percent / 100))`
3. `taxable_amount = quantize_money(max(0.00, line_subtotal - line_discount))`
4. `line_tax = quantize_money(taxable_amount * (tax_rate / 100))`
5. `line_total = quantize_money(taxable_amount + line_tax)`
6. `subtotal = quantize_money(sum(line_subtotals))`
7. `discount_amount = quantize_money(sum(line_discounts) + additional_discount)`
8. `tax_amount = quantize_money(sum(line_taxes))`
9. `total_amount = quantize_money(max(0.00, subtotal - discount_amount) + tax_amount)`
10. `balance_due = quantize_money(total_amount - amount_paid)`

### Non-Destructive Financial Retention
- Deletion constraints on financial tables (`invoices`, `payments`, `clients`) use `ondelete="RESTRICT"`.
- Clients referenced by issued or draft invoices can never be hard-deleted from the database; they are archived via soft archiving flags (`is_archived = True`), preserving full historical auditability.
- Issued invoices cannot be directly deleted or altered. Changes to issued financial documents require creating an audit record, cancelling with reason, or duplicating into a new draft.

---

## 4. Invoice Numbering & Concurrent Issuance

Invoice numbers must be sequential and unique within an organization:
- **Format**: `{prefix}-{number}` (e.g., `INV-1001`, `INV-1002`).
- **Configurable**: Configured per organization via `invoice_prefix` and `next_invoice_number`.
- **Database-Backed Row Locking**: Numbers are generated atomically inside an open transaction with database row locking (`with_for_update()`) on the `organizations` table.
- **Uniqueness Constraint**: A composite unique index `uq_org_invoice_number` enforces uniqueness across `(organization_id, invoice_number)`.
- **Drafts vs. Issued**: Draft invoices are designated with a provisional draft prefix (`DRAFT-XXXXXX`). Sequential organization numbers are locked and assigned at official issuance time.

---

## 5. Dynamic Status Calculation Rules

Invoice statuses are computed dynamically via `compute_effective_status()`:
- `cancelled`: If invoice is cancelled.
- `draft`: If invoice has not yet been issued.
- `paid`: If `balance_due <= 0.00` and `total_amount > 0.00`.
- `overdue`: If `due_date < date.today()` and `balance_due > 0.00`.
- `partially_paid`: If `amount_paid > 0.00` and `balance_due > 0.00`.
- `issued` / `sent`: If issued and waiting for payment before due date.

---

## 6. PDF Generation Architecture

Backend invoice PDFs are rendered using **ReportLab 4.2**:
- **Canvas Streaming**: PDFs are generated in-memory using `io.BytesIO` and streamed directly to the HTTP response (`application/pdf`) with `Content-Disposition: attachment; filename="INV-XXXX.pdf"`.
- **Two-Pass NumberedCanvas**: Custom `NumberedCanvas` performs page counting to produce true "Page X of Y" page numbers in the footer.
- **Flowables & Flowable Tables**: Uses ReportLab `Table`, `Paragraph`, and `Spacer` for automatic pagination, robust multi-line description text wrapping, and clean page breaks on invoices with dozens of line items.
- **Organization Branding**: Safely integrates organization details, business contact information, client billing profile, item breakdown, and terms.
- **Security Scoping**: Revalidates user organization membership before generating PDF streams; cross-tenant PDF requests are rejected.

---

## 7. Database Schema Entities

- **`organizations`**: Multi-tenant business workspace (name, slug, owner_id, email, phone, address, country, currency, timezone, tax_id, invoice_prefix, next_invoice_number).
- **`users`**: User credentials, password hash (bcrypt), active status, email verification status.
- **`organization_members`**: Membership link between users and organizations with roles (`owner`, `admin`, `member`) and statuses (`active`, `invited`, `suspended`).
- **`clients`**: Customer profiles, billing addresses, country, contact name, tax identifiers, archiving flags, non-cascading relationships.
- **`invoices`**: Invoices with status (`draft`, `issued`, `sent`, `partially_paid`, `paid`, `overdue`, `cancelled`), financial totals, public share tokens, cancellation reason, issued timestamp.
- **`invoice_items`**: Line items with descriptions, quantities, unit prices, discounts, tax rates, line totals, display order.
- **`payments`**: Payment ledger records tied to invoices with amount, date, method, reference.
- **`reminder_logs`**: Reminder email attempt log with unique idempotency keys.
- **`audit_logs`**: Immutable audit trails recording user, org, entity, action, and sanitized changes.
