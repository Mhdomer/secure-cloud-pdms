# Source Code — PSM 2 (Implementation)

This directory contains the application source code, implemented in PSM 2 (June – November 2026).

| Directory | Stack | Purpose |
|---|---|---|
| `backend/` | Node.js / Express | REST API, JWT auth, PostgreSQL queries |
| `frontend/` | React (Vite) | SPA served via S3 + CloudFront |

## Architecture Quick Reference

```
Internet
  └── ALB (HTTPS, port 443) — Public Subnet
        └── EC2: Node.js/Express API — Private App Subnet
              └── RDS PostgreSQL (Multi-AZ) — Private DB Subnet
```

React frontend is deployed to S3 + CloudFront (outside VPC).

See [docs/report/chapter-4-requirement-design.md](../docs/report/chapter-4-requirement-design.md) for the full architecture and design spec.
