# Frontend — React SPA

**Status: PSM 2 — Not yet implemented**

## Planned Stack
- Framework: React 18 (Vite)
- Routing: React Router v6
- HTTP: Axios (credentials: include for httpOnly cookie)
- Deployment: Amazon S3 + CloudFront

## Role-Based Views

| Role | Dashboard | Key Restrictions |
|---|---|---|
| Doctor | Doctor Dashboard | See only assigned patients; no admin functions |
| Admin | Admin Dashboard | Logistics only; no clinical data visible |
| Patient | Patient Portal | Read-only; no edit/delete controls |

All accounts are created by Admin only — no self-registration.

See [docs/attachments/](../../docs/attachments/) for wireframes (E.1–E.4) and the architecture diagram.
