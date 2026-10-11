# InvoiceFlow AI — Automated Testing Documentation

## 1. Testing Strategy

InvoiceFlow AI employs an automated test suite verifying correctness, tenant isolation, and financial integrity:

1. **Authentication & Identity Tests (`test_auth.py`)**:
   - Successful user registration with automated workspace provisioning.
   - Duplicate email registration rejection.
   - Email normalization across cases (`owner@test.com` vs `OWNER@TEST.COM`).
   - Password strength validation (>= 8 characters).
   - Valid and invalid login attempts with generic error responses.
   - Protected endpoint behavior (`/api/v1/auth/me` with and without Bearer token).
   - Logout endpoint execution.

2. **Client CRM Tests (`test_clients.py`)**:
   - Client CRUD operations, input validations, country codes, and tax IDs.
   - Client search by name, contact, or email and paginated retrieval.
   - Client archiving and restoration workflows preserving historical data.
   - Cross-tenant client isolation: Users cannot view or modify clients of other workspaces.

3. **Invoice Lifecycle & Numbering Tests (`test_invoices_lifecycle.py`)**:
   - Draft creation with multi-item calculations and provisional draft numbering.
   - Safe sequential invoice numbering assignment upon official issuance (`INV-1001`).
   - Immutability enforcement: Attempting to modify issued invoices is rejected.
   - Invoice cancellation with auditable reason tracking.
   - Duplicating an existing invoice into a fresh draft.
   - Deletion rules: Only drafts may be deleted; deleting issued invoices is forbidden.
   - Cross-tenant invoice access prevention and client ownership validation.

4. **Financial Arithmetic Engine Tests (`test_decimal_engine.py`)**:
   - `ROUND_HALF_UP` 2-decimal precision and boundary rounding (`0.005` -> `0.01`).
   - Fractional quantities (e.g., 3.75 hours @ 85.50/hr).
   - Line-item discounts and configurable tax rate combinations.
   - Aggregation of invoice totals (subtotal, discounts, taxes, grand totals).
   - Multi-million large permitted financial amounts.
   - Zero-value consultations / invoices.
   - Input validation: Rejection of negative quantities, unit prices, discounts, or tax rates.
   - Payment validation and balance tracking (partial payments and overpayment rejection).

5. **PDF Generation Tests (`test_pdf_generation.py`)**:
   - PDF generation endpoint returns `application/pdf` with valid `Content-Disposition`.
   - Generated PDF content inspection: Validates `%PDF-` header, correct bytes, and page numbers.
   - Multi-tenant PDF access rejection: User B cannot download User A's invoice PDF.

6. **Tenant Isolation & Security Tests (`test_organizations_isolation.py`)**:
   - Organization creation and listing scoped to active memberships.
   - Cross-tenant access rejection: Verifies User B in Org B cannot read or modify Org A.
   - Role-based permissions (RBAC): Only `owner` and `admin` roles can update settings.

7. **Security Constraints & Mass Assignment (`test_mass_assignment_and_constraints.py`)**:
   - Prevention of mass assignment on read-only attributes (`owner_id`, `id`).
   - Unique membership database constraint `uq_org_member`.

8. **API Health Tests (`test_health.py`)**:
   - Health check and database connectivity verification.

---

## 2. Test Environment Setup

Tests run in an isolated in-memory SQLite database (`sqlite:///:memory:`) using SQLAlchemy's `StaticPool`. This ensures:
- **Zero test pollution**: Every test executes inside a clean transactional rollback.
- **Speed**: All 36 tests complete in under 14 seconds.
- **Zero external dependencies**: Tests run without requiring a live external database server.

---

## 3. Running the Test Suite

From the project root:

```powershell
cd backend
..\backend\.venv\Scripts\pytest.exe -v
```

### Running with Code Coverage:
```powershell
cd backend
..\backend\.venv\Scripts\pytest.exe --cov=app --cov-report=term-missing
```

---

## 4. Test Suite Structure

```
backend/tests/
├── conftest.py                              # Isolated test database fixtures & TestClient override
├── test_auth.py                             # Registration, login, password validation & auth tests (8 tests)
├── test_clients.py                          # Client CRM CRUD, search, archive & tenant isolation (4 tests)
├── test_decimal_engine.py                   # Exact decimal arithmetic, rounding, & validation (10 tests)
├── test_health.py                           # API health and root endpoint checks (2 tests)
├── test_invoices_lifecycle.py               # Invoice builder, sequential numbering, cancellation (5 tests)
├── test_mass_assignment_and_constraints.py # Mass assignment defense and unique constraints (2 tests)
├── test_organizations_isolation.py         # Multi-tenant isolation, cross-tenant rejection & RBAC (3 tests)
└── test_pdf_generation.py                  # ReportLab PDF generation & cross-tenant PDF security (2 tests)
```
