# Do not merge this branch

This is `demo/vercel-do-not-merge`. It exists to deploy a hosted demonstration
build of the application to Vercel + Neon. **It must never be merged into
`main`.**

## Why

The AWS stack is deliberately torn down to a zero-cost state, so there is
nothing running to demonstrate or to test against. That blocks UAT, the
Chapter 5 figures, and any live demonstration. This branch solves that without
standing the infrastructure back up.

It carries things that would be wrong on the production path: Vercel routing
and build configuration, a serverless entry point, demo-mode behaviour that
surfaces OTP codes in API responses, disabled file uploads, and a database
reset endpoint.

## What is different from `main`

Three guarded changes, each inert without its environment variable:

| Change | Variable | Without it |
| --- | --- | --- |
| Upload directory is configurable | `UPLOAD_DIR` | Current path — unchanged |
| Public-CA TLS for Neon | `DB_SSL_MODE=standard` | Existing `DB_SSL` branch — unchanged |
| OTP returned in the response | `DEMO_MODE=true` | Already the case when `NODE_ENV != production` — unchanged |

Plus additive files that never execute on AWS: `api/index.js`, `vercel.json`,
`scripts/seed-demo.js`, `scripts/reset-demo.js`, and this file.

## If you need to fix something

A bug that belongs in the real system is fixed on `main`, then this branch is
rebased onto it:

```bash
git checkout main && git pull
git checkout demo/vercel-do-not-merge
git rebase main
```

Never the reverse. Never cherry-pick from here to `main`.

## If this branch does get merged

`.github/workflows/demo-branch-guard.yml` on `main` fails the build when it
detects these files. Revert the merge commit rather than deleting files
individually — the guarded production changes came with them.

Design: `docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md`
