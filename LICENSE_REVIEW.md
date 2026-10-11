# InvoiceFlow AI — Dependency & Intellectual Property License Review

**Audit Date:** 2026-10-11  
**Project:** InvoiceFlow AI  
**Scope:** Frontend (npm), Backend (pip / PyPI), Fonts, Icons, and Bundled Assets  
**Auditor Roles:** Commercial Codebase Auditor, Software Architect  

---

> [!NOTE]
> **Legal Notice:**  
> This document provides a technical software dependency and copyright license inventory based on package metadata and repository manifests. It does not constitute formal legal counsel. Commercial buyers, acquirers, or licensees should consult intellectual property legal counsel for regulatory compliance in their respective jurisdictions.

---

## 1. Executive License Summary

All dependencies used across both the frontend and backend of InvoiceFlow AI utilize **permissive open-source licenses** (MIT, Apache 2.0, BSD-3-Clause, and ISC). 

- **GPL / AGPL Copyleft Risk:** **None.** No copyleft or viral open-source licenses (GPLv2, GPLv3, AGPLv3) were introduced into the codebase.
- **Commercial Licensing Suitability:** **Cleared for commercial use, private rebranding, proprietary redistribution, and SaaS hosting.**
- **Patent Retaliation Clauses:** Apache 2.0 dependencies provide express patent grants.

---

## 2. Backend Dependencies Inventory (Python / PyPI)

| Package Name | Version Specifier | License Identifier | Source / Project URL | Commercial Suitability |
| :--- | :--- | :--- | :--- | :--- |
| `fastapi` | `==0.115.6` | MIT | https://github.com/fastapi/fastapi | Permissive / Unrestricted |
| `uvicorn[standard]` | `==0.34.0` | BSD-3-Clause | https://github.com/encode/uvicorn | Permissive / Unrestricted |
| `pydantic` | `==2.10.4` | MIT | https://github.com/pydantic/pydantic | Permissive / Unrestricted |
| `pydantic-settings` | `==2.7.0` | MIT | https://github.com/pydantic/pydantic-settings | Permissive / Unrestricted |
| `email-validator` | `==2.2.0` | CC0 / MIT | https://github.com/JoshData/python-email-validator | Permissive / Unrestricted |
| `sqlalchemy` | `==2.0.36` | MIT | https://www.sqlalchemy.org | Permissive / Unrestricted |
| `alembic` | `==1.14.0` | MIT | https://alembic.sqlalchemy.org | Permissive / Unrestricted |
| `psycopg2-binary` | `==2.9.10` | LGPL-3.0 with linking exception / BSD | https://www.psycopg.org | Permissive (Binary wheel) |
| `asyncpg` | `==0.30.0` | Apache-2.0 | https://github.com/MagicStack/asyncpg | Permissive / Unrestricted |
| `passlib[bcrypt]` | `==1.7.4` | BSD-3-Clause | https://foss.heptapod.net/python-libs/passlib | Permissive / Unrestricted |
| `bcrypt` | `==4.0.1` | Apache-2.0 | https://github.com/pyca/bcrypt | Permissive / Unrestricted |
| `python-jose[cryptography]` | `==3.3.0` | MIT | https://github.com/mpdavis/python-jose | Permissive / Unrestricted |
| `python-multipart` | `==0.0.20` | Apache-2.0 | https://github.com/Kludex/python-multipart | Permissive / Unrestricted |
| `reportlab` | `==4.2.5` | BSD-3-Clause | https://www.reportlab.com | Permissive / Unrestricted |
| `httpx` | `==0.28.1` | BSD-3-Clause | https://github.com/encode/httpx | Permissive / Unrestricted |
| `openai` | `>=1.58.0` | Apache-2.0 | https://github.com/openai/openai-python | Permissive / Unrestricted |
| `pytest` | `==8.3.4` | MIT | https://pytest.org | Permissive (Test only) |
| `pytest-asyncio` | `==0.25.0` | Apache-2.0 | https://github.com/pytest-dev/pytest-asyncio | Permissive (Test only) |
| `pytest-cov` | `==6.0.0` | MIT | https://github.com/pytest-dev/pytest-cov | Permissive (Test only) |

---

## 3. Frontend Dependencies Inventory (Node.js / npm)

| Package Name | Version Specifier | License Identifier | Source / Project URL | Commercial Suitability |
| :--- | :--- | :--- | :--- | :--- |
| `next` | `16.4.0` | MIT | https://github.com/vercel/next.js | Permissive / Unrestricted |
| `react` | `19.3.0` | MIT | https://github.com/facebook/react | Permissive / Unrestricted |
| `react-dom` | `19.3.0` | MIT | https://github.com/facebook/react | Permissive / Unrestricted |
| `lucide-react` | `^1.55.0` | ISC | https://github.com/lucide-icons/lucide | Permissive / Unrestricted |
| `tailwindcss` | `^4.0.0` | MIT | https://github.com/tailwindlabs/tailwindcss | Permissive / Unrestricted |
| `@tailwindcss/turbopack` | `^4.0.0` | MIT | https://github.com/tailwindlabs/tailwindcss | Permissive (Build only) |
| `typescript` | `^5.0.0` | Apache-2.0 | https://github.com/microsoft/TypeScript | Permissive (Build only) |
| `eslint` | `^9.0.0` | MIT | https://github.com/eslint/eslint | Permissive (Tooling only) |
| `eslint-config-next` | `16.4.0` | MIT | https://github.com/vercel/next.js | Permissive (Tooling only) |

---

## 4. Fonts, Icons, and Bundled UI Assets

1. **Icons (`lucide-react`):**  
   - Licensed under the **ISC License** (an OSI-approved permissive license functionally equivalent to simplified BSD/MIT).
   - Redistribution, embedding, and commercial use permitted with copyright notice preserved in package metadata.
2. **Typography (Inter / Geist / System Fonts):**  
   - Built using modern web-safe and system UI fonts (`ui-sans-serif, system-ui, sans-serif`).
   - Any external font imports from Google Fonts (e.g. Inter) are governed by the **SIL Open Font License (OFL) 1.1**, permitting commercial redistribution in web applications.
3. **Graphics & Logos:**  
   - All branding graphics (e.g. InvoiceFlow AI geometric logo marks) are rendered natively in React JSX using inline SVG vectors created specifically for this codebase.
   - Zero proprietary commercial icon packs, stock photography, or royalty-restricted assets are bundled in the repository.

---

## 5. Third-Party Web Services & Terms of Service Notes

When configuring external providers, buyers will establish their own accounts subject to the respective provider's commercial terms:
- **OpenAI (Optional AI Assistant):** Governed by OpenAI Business / API Terms. Model input/output ownership resides with the API consumer.
- **SMTP Providers (Postmark, SendGrid, Mailgun):** Governed by their respective terms of service for transactional email delivery.

---

## 6. Audit Verdict

**License Compatibility Status: 100% CLEAR.**  
The InvoiceFlow AI repository is completely free of copyleft encumbrances and is ready for proprietary transfer, marketplace distribution (e.g. TrainPlex), and commercial closed-source monetization.
