# Committed credential — local Postgres superuser password (2026-09-15)

## Finding

`docs/psm2/session-prompts/backend-schema-gaps.md` line 20 carried a live
connection string with the local Postgres **superuser** password inline:

```
Connection: host=localhost port=5432 dbname=pdms user=postgres password=<redacted>
```

It was committed in `3d00815` ("implement patient self-registration, schema gap
fixes, and doctor availability/directory APIs") and pushed to the public
GitHub repository. It has been in public history since.

This violates the project's own non-negotiable gate in `CLAUDE.md`:

> **Never commit:** Hardcoded credentials or API keys

which is a pointed thing to get wrong on a security-focused FYP.

## Severity, honestly assessed

**Low in practice, high in principle.**

- The host is `localhost`. The credential authenticates nothing reachable
  from the internet — there is no exposed Postgres port on any deployed
  host, and RDS uses entirely separate credentials held in SSM.
- Anyone who could use it would already need code execution on the
  development machine, at which point `src/backend/.env` is readable anyway.
- But it is the **superuser** role, not the least-privilege `pdms_app` role.
  A superuser bypasses every RLS policy in this system unconditionally —
  which is precisely the control the rest of this project is built on.

So: not an incident, but not nothing either. The right framing for the report
is that the gate existed, was written down, and was still crossed — which is
the ordinary way credential leaks happen in real organisations.

## This was already known and deferred

`docs/psm2/security-audit-fixes-2026-07-24.md` row 1-B flagged the same value
on 2026-07-24 and consciously left it:

> This is the Postgres *superuser* password (bypasses all RLS), not the
> least-privilege app role rotated above. Higher blast radius if changed
> incorrectly (could lock out local DB admin access); left for the user to
> rotate deliberately.

That judgement still holds. Rotating a machine-wide Postgres superuser
password can break tools outside this repository, so it is not something to
automate behind the user's back.

## What was done on 2026-09-15

1. **Redacted going forward.** The literal is gone from both tracked files:
   - `docs/psm2/session-prompts/backend-schema-gaps.md` now points at
     `MIGRATION_DB_PASSWORD` in `src/backend/.env` instead of inlining it.
   - `docs/psm2/security-audit-fixes-2026-07-24.md` row 1-B keeps the
     narrative but no longer prints the value.
2. **History deliberately NOT rewritten.** A `filter-repo`/BFG pass would
   purge it, but it rewrites shared history and invalidates existing clones —
   disproportionate for a localhost-only credential. Recorded as an accepted
   risk rather than done silently.
3. **Rotation: still outstanding.** See below.

## Rotation — the remaining step (manual)

Not performed automatically: the tooling guardrails around writing credentials
blocked it mid-run, and it leaves `.env` and the server disagreeing if it
half-completes. It is a two-minute manual job.

**Blast radius — check these before rotating.** Anything on this machine
authenticating as `postgres` with the old password will stop working:
pgAdmin / DBeaver saved connections, any other local project sharing this
Postgres instance, and `MIGRATION_DB_PASSWORD` in `src/backend/.env`.

**Easiest route — pgAdmin:** right-click the `postgres` login role →
Properties → Definition → set a new password → Save. Then update
`MIGRATION_DB_PASSWORD` in `src/backend/.env` to match.

**Or from Node** (`psql` is not on PATH in this dev environment). Run from
`src/backend`, which is where `.env` and `node_modules` live:

```js
// rotate.js — run once, then delete.
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');

// base64url: no quotes or backslashes, so it is safe to inline and to store.
const NEW = crypto.randomBytes(24).toString('base64url');

(async () => {
  const cfg = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.MIGRATION_DB_USER,
    ssl: false,
  };

  const admin = new Client({ ...cfg, password: process.env.MIGRATION_DB_PASSWORD });
  await admin.connect();

  // NOTE: ALTER ROLE does not accept bind parameters — the password must be a
  // literal. That is safe here only because NEW is generated base64url and
  // cannot contain a quote. Never interpolate a user-supplied string here.
  await admin.query(`ALTER ROLE ${process.env.MIGRATION_DB_USER} WITH PASSWORD '${NEW}'`);

  // Prove a fresh connection works BEFORE touching .env, so a failure never
  // leaves the file and the server out of sync.
  const check = new Client({ ...cfg, password: NEW });
  await check.connect();
  await check.end();
  await admin.end();

  const env = fs.readFileSync('.env', 'utf8');
  fs.writeFileSync('.env', env.replace(/^MIGRATION_DB_PASSWORD=.*$/m, 'MIGRATION_DB_PASSWORD=' + NEW));
  console.log('rotated; new value is in .env');
})();
```

**Verify afterwards:**

```bash
cd src/backend && npm test      # 192 tests; the live RLS suite needs the DB
```

If the rotation half-fails and `.env` no longer matches the server, set the
password back from pgAdmin — nothing else in this repo depends on the old
value.

## Report framing

Worth writing up in the thesis as a genuine finding-and-response rather than
hiding: a documented control was violated in the project's own repository, it
was caught by a later audit of that repository, the exposure was assessed
(localhost-only, superuser scope), the value was redacted, and the residual
risk of leaving it in history was accepted with a stated reason. That is a
more honest security narrative than a project that claims it never happened.
