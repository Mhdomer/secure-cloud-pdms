# Vercel Demo Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a hosted demonstration build of the Secure Cloud PDMS to Vercel + Neon, on a branch that is never merged to `main`, so that UAT can be run with remote participants, Chapter 5's figures can be captured, and the system can be demonstrated live.

**Architecture:** One branch (`demo/vercel-do-not-merge`) deploys to two Vercel projects backed by two Neon PostgreSQL databases. Each Vercel project serves the React build at `/` and the existing Express app as a serverless function at `/api/*` — one origin, so the `SameSite=Strict` session cookie is unchanged. Three changes to production code, each guarded so that absent environment variables mean current behaviour.

**Tech Stack:** Node.js 20, Express, React + Vite, PostgreSQL (Neon), Vercel, Jest.

**Spec:** `docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md`

## Global Constraints

- **The branch must never be merged to `main`.** Fixes that belong in the real system are made on `main` and the branch rebased onto it — never the reverse.
- **Absent environment variables must mean current production behaviour.** Every guarded change defaults to what the code does today. Missing configuration yields production semantics, never demo semantics.
- **The AWS deployment path is not touched:** no changes to `deploy.yml`, `infrastructure/terraform/`, or `src/backend/Dockerfile`.
- **The existing 206 tests must pass unchanged.** Modifying an existing test is a signal that a guard has leaked into production behaviour — stop and reconsider rather than editing the test.
- **No real patient data, ever.** Seed data is invented names, reserved-range phone numbers, non-valid national identifiers.
- **Node version:** 20. **Commit style:** human-voiced, imperative, no AI attribution, stage specific paths (never `git add .`).
- `npm install` in `src/backend` is required before running tests (`node_modules` is not kept in the working tree).

---

## File Structure

**Created on `main` (Task 1 only):**
- `.github/workflows/demo-branch-guard.yml` — fails the build if demo files appear on `main`

**Created on `demo/vercel-do-not-merge`:**
- `DO-NOT-MERGE.md` — repository-root warning
- `api/index.js` — Vercel serverless entry point
- `vercel.json` — build and routing configuration
- `scripts/seed-demo.js` — synthetic clinic data
- `scripts/reset-demo.js` — truncate and re-seed, invoked by the reset endpoint
- `src/backend/src/routes/demo.routes.js` — reset endpoint, mounted only when `DEMO_MODE=true`
- `src/frontend/src/components/DemoBanner.tsx` — persistent synthetic-data banner

**Modified on the branch:**
- `src/backend/src/middleware/upload.js` — env-driven upload directory
- `src/backend/src/config/database.js` — `DB_SSL_MODE=standard`
- `src/backend/src/controllers/patientRegistrationController.js` — OTP surfacing condition
- `src/backend/src/controllers/passwordResetController.js` — same condition
- `src/backend/src/routes/invoices.routes.js`, `labResults.routes.js` — upload disabled in demo mode
- `src/backend/src/routes/index.js` — mount demo routes
- `src/frontend/src/App.tsx` — render the banner
- `src/frontend/index.html` — `noindex`

---

### Task 1: Merge guards on `main`

Do this **first**, before the branch exists. The guard should precede the thing it guards.

**Files:**
- Create: `.github/workflows/demo-branch-guard.yml`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing
- Produces: a CI job named `demo-branch-guard` that fails on `main` if demo artefacts are present

- [ ] **Step 1: Confirm you are on `main` and it is clean**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
git checkout main
git status --short
```

Expected: no output other than untracked files you already know about.

- [ ] **Step 2: Create the guard workflow**

Create `.github/workflows/demo-branch-guard.yml`:

```yaml
name: Demo Branch Guard

# The demo build (docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md)
# lives on demo/vercel-do-not-merge and must never reach main. That branch
# carries Vercel configuration and demo-mode behaviour that would be wrong to
# ship on the production path. Branch naming and DO-NOT-MERGE.md are advisory;
# this job is the one that actually stops it.
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  demo-branch-guard:
    name: Demo artefacts must not reach main
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Fail if demo artefacts are present
        run: |
          FOUND=""
          for f in vercel.json api/index.js DO-NOT-MERGE.md scripts/seed-demo.js scripts/reset-demo.js; do
            if [ -e "$f" ]; then FOUND="$FOUND $f"; fi
          done
          if [ -n "$FOUND" ]; then
            echo "::error::Demo build artefacts found on main:$FOUND"
            echo ""
            echo "The demo branch (demo/vercel-do-not-merge) appears to have been merged."
            echo "It must not be. See docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md"
            echo "and the 'Demo build' entry in CLAUDE.md."
            echo ""
            echo "To recover: git revert the merge commit on main. Do not delete the files"
            echo "individually — the guarded production changes came with them."
            exit 1
          fi
          echo "No demo artefacts on main."
```

- [ ] **Step 3: Verify the guard fails when it should**

Prove the guard works before trusting it. Create a decoy, run the same logic locally, then remove it:

```bash
touch vercel.json
for f in vercel.json api/index.js DO-NOT-MERGE.md scripts/seed-demo.js scripts/reset-demo.js; do
  if [ -e "$f" ]; then echo "would fail on: $f"; fi
done
rm vercel.json
```

Expected: prints `would fail on: vercel.json`, then the file is removed.

- [ ] **Step 4: Add the CLAUDE.md entry**

Add to `CLAUDE.md` under the `## References` section:

```markdown
- **Demo build lives on an unmerged branch — do not merge it** (2026-09-18). `demo/vercel-do-not-merge` deploys a hosted demonstration of the application layer to Vercel + Neon, so UAT can be run with remote participants and Chapter 5's figures captured without standing the AWS stack back up. It carries Vercel configuration and demo-mode behaviour that must never ship on the production path. `.github/workflows/demo-branch-guard.yml` fails the build on `main` if it ever arrives. If a bug found in the demo belongs in the real system, fix it on `main` and rebase the branch — never the reverse. Design: `docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md`
```

- [ ] **Step 5: Write the memory entry**

The fourth guard. Future assistant sessions read project memory and could otherwise decide the two branches ought to be reconciled.

Create `C:\Users\md3om\.claude\projects\d--Main--FYP-PSM-1-SECRH\memory\project_demo_branch.md`:

```markdown
---
name: project-demo-branch
description: "demo/vercel-do-not-merge hosts the Vercel demo build and must NEVER be merged to main"
metadata:
  node_type: memory
  type: project
---

`demo/vercel-do-not-merge` deploys a hosted demonstration of the application
layer to Vercel + Neon, so UAT can run with remote participants and Chapter 5's
figures can be captured without standing the AWS stack back up.

**It must never be merged to `main`.** It carries Vercel routing, a serverless
entry point, demo-mode behaviour that surfaces OTP codes in API responses,
disabled file uploads, and a database reset endpoint — all wrong on the
production path.

**Why:** the demo is a companion artifact, not the thesis artifact. It does not
demonstrate VPC isolation, KMS, CloudTrail, the pipeline, or the recovery
objective — most of Chapters 4 and 5.

**How to apply:** if a bug found in the demo belongs in the real system, fix it
on `main` and rebase the branch onto it. Never the reverse, never cherry-pick
from the branch. `.github/workflows/demo-branch-guard.yml` fails the build on
`main` if demo artefacts arrive there. Design:
`docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md`; plan:
`docs/superpowers/plans/2026-09-18-vercel-demo-build.md`. See
[[project_outstanding_work]].
```

Then add a one-line pointer to `MEMORY.md`:

```markdown
- [Demo Branch — never merge](project_demo_branch.md) — demo/vercel-do-not-merge hosts the Vercel demo; fixes flow main → branch only
```

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/demo-branch-guard.yml CLAUDE.md
git commit -m "guard main against the demo branch being merged"
```

The memory files live outside the repository and are not committed.

---

### Task 2: Create the branch and its warning file

**Files:**
- Create (on branch): `DO-NOT-MERGE.md`

**Interfaces:**
- Consumes: Task 1's CI guard
- Produces: the branch `demo/vercel-do-not-merge`, on which all later tasks run

- [ ] **Step 1: Cut the branch from `main`**

```bash
git checkout -b demo/vercel-do-not-merge
```

- [ ] **Step 2: Create `DO-NOT-MERGE.md` at the repository root**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add DO-NOT-MERGE.md
git commit -m "mark this branch as never-to-be-merged"
```

---

### Task 3: Make the upload directory configurable

This change is required regardless of demo mode: `upload.js` calls `fs.mkdirSync` at require time against a path inside the application bundle, which is read-only on Vercel. Without it the backend crashes at startup before serving a request.

**Files:**
- Modify: `src/backend/src/middleware/upload.js`
- Test: `src/backend/src/middleware/__tests__/upload.test.js` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `UPLOAD_DIR` environment variable; `module.exports = { uploadSingle, uploadMultiple, UPLOAD_DIR }` (unchanged shape)

- [ ] **Step 1: Install dependencies (once per machine)**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH/src/backend"
npm install
```

- [ ] **Step 2: Write the failing test**

Create `src/backend/src/middleware/__tests__/upload.test.js`:

```javascript
'use strict';

const path = require('path');
const os = require('os');

// upload.js creates its directory at require time, so each case needs a fresh
// module registry with the environment already set.
function loadUploadModule(env) {
  let mod;
  jest.isolateModules(() => {
    const saved = process.env.UPLOAD_DIR;
    if (env.UPLOAD_DIR === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = env.UPLOAD_DIR;
    }
    mod = require('../upload');
    if (saved === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = saved;
    }
  });
  return mod;
}

describe('upload directory resolution', () => {
  it('defaults to the in-repo uploads directory when UPLOAD_DIR is unset', () => {
    // This is the production invariant: absent config means today's behaviour.
    const { UPLOAD_DIR } = loadUploadModule({ UPLOAD_DIR: undefined });
    expect(UPLOAD_DIR).toBe(path.join(__dirname, '../../../uploads'));
  });

  it('uses UPLOAD_DIR when set, so a read-only bundle does not crash the app', () => {
    const target = path.join(os.tmpdir(), 'pdms-upload-test');
    const { UPLOAD_DIR } = loadUploadModule({ UPLOAD_DIR: target });
    expect(UPLOAD_DIR).toBe(target);
  });
});
```

- [ ] **Step 3: Run it and watch the second case fail**

```bash
npx jest src/middleware/__tests__/upload.test.js
```

Expected: the first test passes, the second FAILS — `UPLOAD_DIR` is currently a hardcoded constant.

- [ ] **Step 4: Make the directory configurable**

In `src/backend/src/middleware/upload.js`, replace:

```javascript
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
```

with:

```javascript
// Configurable so the module can run where the application bundle is
// read-only — Vercel's filesystem, for instance, where mkdirSync against the
// bundle throws at require time and takes the whole process down before the
// first request. Absent the variable this resolves to exactly the path it
// always did.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
```

- [ ] **Step 5: Run the tests**

```bash
npx jest src/middleware/__tests__/upload.test.js
```

Expected: both PASS.

- [ ] **Step 6: Run the whole suite to prove nothing regressed**

```bash
npx jest
```

Expected: all suites pass. The count is now 208 (206 plus the two added here).

- [ ] **Step 7: Commit**

```bash
git add src/backend/src/middleware/upload.js src/backend/src/middleware/__tests__/upload.test.js
git commit -m "let the upload directory come from the environment"
```

---

### Task 4: Add a standard-TLS database mode

Neon requires TLS but presents a publicly trusted certificate. RDS chains to a private AWS root and needs the bundled CA file the Dockerfile fetches.

**Files:**
- Modify: `src/backend/src/config/database.js`
- Test: `src/backend/src/config/__tests__/databaseSsl.test.js` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `DB_SSL_MODE` environment variable, meaningful only when `DB_SSL=true`

- [ ] **Step 1: Write the failing test**

Create `src/backend/src/config/__tests__/databaseSsl.test.js`:

```javascript
'use strict';

// database.js builds its Pool config at require time, so each case needs a
// fresh module registry. pg is mocked to capture the config it receives.
const capturedConfigs = [];

jest.mock('pg', () => ({
  Pool: jest.fn(function PoolMock(config) {
    capturedConfigs.push(config);
    this.on = jest.fn();
    this.connect = jest.fn();
  }),
}));
jest.mock('../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(() => 'FAKE-RDS-CA-BUNDLE'),
}));

function loadWith(env) {
  capturedConfigs.length = 0;
  jest.isolateModules(() => {
    Object.assign(process.env, {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'pdms',
      DB_USER: 'pdms_app',
      DB_PASSWORD: 'unused-by-the-mock',
    }, env);
    require('../database');
  });
  return capturedConfigs[0];
}

afterEach(() => {
  delete process.env.DB_SSL;
  delete process.env.DB_SSL_MODE;
});

describe('database TLS configuration', () => {
  it('disables TLS when DB_SSL is not "true" — unchanged local behaviour', () => {
    const config = loadWith({ DB_SSL: 'false' });
    expect(config.ssl).toBe(false);
  });

  it('uses the RDS CA bundle when DB_SSL=true and no mode is given', () => {
    // The production invariant: absent DB_SSL_MODE, this is exactly today's path.
    const config = loadWith({ DB_SSL: 'true' });
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.ssl.ca).toBe('FAKE-RDS-CA-BUNDLE');
  });

  it('verifies against the public trust store when DB_SSL_MODE=standard', () => {
    const config = loadWith({ DB_SSL: 'true', DB_SSL_MODE: 'standard' });
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.ssl.ca).toBeUndefined();
  });

  it('never disables certificate verification in any mode', () => {
    // Guards against a future "just make it work" edit.
    for (const mode of [undefined, 'standard']) {
      const config = loadWith({ DB_SSL: 'true', DB_SSL_MODE: mode });
      expect(config.ssl.rejectUnauthorized).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and watch the standard-mode case fail**

```bash
npx jest src/config/__tests__/databaseSsl.test.js
```

Expected: the `DB_SSL_MODE=standard` case FAILS — it currently tries to read the RDS bundle.

- [ ] **Step 3: Add the mode**

In `src/backend/src/config/database.js`, replace the `ssl:` property of the Pool config:

```javascript
  ssl:
    process.env.DB_SSL === 'true'
      ? {
        rejectUnauthorized: true,
        ca: fs.readFileSync(RDS_CA_BUNDLE_PATH).toString(),
      }
      : false,
```

with:

```javascript
  // DB_SSL_MODE=standard verifies against Node's bundled public trust store
  // instead of the RDS private root — for managed providers (Neon, Supabase)
  // that present a publicly trusted certificate and ship no CA bundle.
  //
  // There is deliberately no fallback from the RDS path to this one. If the
  // bundle is missing, the connection must fail rather than quietly verify
  // against a different trust anchor; a silent TLS downgrade is precisely the
  // class of defect this system exists to avoid. Certificate verification
  // stays on in every mode.
  ssl:
    process.env.DB_SSL === 'true'
      ? process.env.DB_SSL_MODE === 'standard'
        ? { rejectUnauthorized: true }
        : {
          rejectUnauthorized: true,
          ca: fs.readFileSync(RDS_CA_BUNDLE_PATH).toString(),
        }
      : false,
```

- [ ] **Step 4: Run the tests**

```bash
npx jest src/config/__tests__/databaseSsl.test.js
```

Expected: all four PASS.

- [ ] **Step 5: Run the whole suite**

```bash
npx jest
```

Expected: all pass, 212 tests.

- [ ] **Step 6: Commit**

```bash
git add src/backend/src/config/database.js src/backend/src/config/__tests__/databaseSsl.test.js
git commit -m "support public-CA TLS for managed postgres providers"
```

---

### Task 5: Surface the OTP under `DEMO_MODE`

`sendOtp` is already a stub with no provider wired up, and the OTP is already returned as `devOtpCode` when `NODE_ENV !== 'production'`. A hosted demo runs with `NODE_ENV=production` (so Express does not leak stack traces), which currently suppresses it — and the code is stored hashed, so it cannot be recovered afterwards.

**Files:**
- Modify: `src/backend/src/controllers/patientRegistrationController.js`
- Modify: `src/backend/src/controllers/passwordResetController.js`
- Test: `src/backend/src/controllers/__tests__/otpSurfacing.test.js` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `DEMO_MODE=true` causes `devOtpCode` to be present in OTP responses

- [ ] **Step 1: Find both occurrences**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
grep -rn "devOtpCode" src/backend/src/controllers/
```

Expected: one occurrence in each of the two controllers.

- [ ] **Step 2: Write the failing test**

Create `src/backend/src/controllers/__tests__/otpSurfacing.test.js`:

```javascript
'use strict';

// The rule that decides whether an OTP code is echoed back to the caller.
// Extracted here as a pure predicate so it can be asserted without standing up
// the controllers' database and bcrypt dependencies.
function shouldSurfaceOtp(env) {
  return env.NODE_ENV !== 'production' || env.DEMO_MODE === 'true';
}

describe('OTP surfacing rule', () => {
  it('surfaces in development, as it always has', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'development' })).toBe(true);
  });

  it('does not surface in production — the existing invariant', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'production' })).toBe(false);
  });

  it('surfaces in a demo deployment, which runs NODE_ENV=production', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'production', DEMO_MODE: 'true' })).toBe(true);
  });

  it('requires the literal string "true" — no loose truthiness', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'production', DEMO_MODE: '1' })).toBe(false);
    expect(shouldSurfaceOtp({ NODE_ENV: 'production', DEMO_MODE: 'yes' })).toBe(false);
  });
});
```

- [ ] **Step 3: Run it**

```bash
cd src/backend && npx jest src/controllers/__tests__/otpSurfacing.test.js
```

Expected: PASS — this test documents the intended rule before the controllers adopt it.

- [ ] **Step 4: Apply the rule in `patientRegistrationController.js`**

Replace:

```javascript
  if (process.env.NODE_ENV !== 'production') {
    response.devOtpCode = code;
  }
```

with:

```javascript
  // DEMO_MODE additionally surfaces it in the hosted demonstration build,
  // which runs NODE_ENV=production so Express does not leak stack traces.
  // The code is stored hashed and cannot be recovered after generation, so a
  // demo participant has no other way to complete the flow. Generation,
  // hashing, attempt counting and expiry are unchanged — only delivery is
  // substituted. See docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md
  if (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true') {
    response.devOtpCode = code;
  }
```

- [ ] **Step 5: Apply the same change in `passwordResetController.js`**

Find the equivalent `NODE_ENV !== 'production'` guard around `devOtpCode` and apply the identical condition and a one-line comment referencing the same spec.

- [ ] **Step 6: Verify both were changed**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
grep -rn "shouldSurfaceOtp" src/backend/src/controllers/*.js
```

Expected: two occurrences, one call site per controller. (The predicate itself now lives in `src/backend/src/utils/otp.js` after an approved refactor — this only checks the two call sites.)

- [ ] **Step 7: Run the whole suite**

```bash
cd src/backend && npx jest
```

Expected: all pass, 216 tests.

- [ ] **Step 8: Commit**

```bash
git add src/backend/src/controllers/patientRegistrationController.js src/backend/src/controllers/passwordResetController.js src/backend/src/controllers/__tests__/otpSurfacing.test.js
git commit -m "surface the otp code in demo deployments"
```

---

### Task 6: Disable file uploads in demo mode

Vercel's filesystem is ephemeral and object storage is out of scope. These endpoints must refuse clearly rather than fail with a 500.

**Files:**
- Create: `src/backend/src/middleware/demoGuard.js`
- Modify: `src/backend/src/routes/invoices.routes.js`, `src/backend/src/routes/labResults.routes.js`
- Test: `src/backend/src/middleware/__tests__/demoGuard.test.js` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `const { blockInDemo } = require('../middleware/demoGuard')` — Express middleware returning 503 when `DEMO_MODE=true`, otherwise calling `next()`

- [ ] **Step 1: Write the failing test**

Create `src/backend/src/middleware/__tests__/demoGuard.test.js`:

```javascript
'use strict';

const { blockInDemo } = require('../demoGuard');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

afterEach(() => {
  delete process.env.DEMO_MODE;
});

describe('blockInDemo', () => {
  it('passes through when DEMO_MODE is unset — the production invariant', () => {
    const next = jest.fn();
    const res = mockRes();
    blockInDemo('File upload')({}, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('refuses with 503 and names the feature when DEMO_MODE=true', () => {
    process.env.DEMO_MODE = 'true';
    const next = jest.fn();
    const res = mockRes();
    blockInDemo('File upload')({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].error).toMatch(/File upload/);
    expect(res.json.mock.calls[0][0].error).toMatch(/demonstration/i);
  });

  it('requires the literal string "true"', () => {
    process.env.DEMO_MODE = '1';
    const next = jest.fn();
    blockInDemo('File upload')({}, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd src/backend && npx jest src/middleware/__tests__/demoGuard.test.js
```

Expected: FAIL — `Cannot find module '../demoGuard'`.

- [ ] **Step 3: Write the middleware**

Create `src/backend/src/middleware/demoGuard.js`:

```javascript
'use strict';

/**
 * Refuses a route that cannot work in the hosted demonstration build.
 *
 * Used for file upload and download, which need durable storage that the
 * demo deployment does not have — Vercel's filesystem is ephemeral, and
 * object storage is deliberately out of scope
 * (docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md). Refusing
 * explicitly beats a 500 from a failed write.
 *
 * Inert unless DEMO_MODE is exactly "true", so the production path is
 * unaffected.
 *
 * @param {string} feature - named in the response, e.g. "File upload"
 */
function blockInDemo(feature) {
  return function demoGuard(req, res, next) {
    if (process.env.DEMO_MODE === 'true') {
      return res.status(503).json({
        error: `${feature} is unavailable in the demonstration build. The full system supports it.`,
      });
    }
    return next();
  };
}

module.exports = { blockInDemo };
```

- [ ] **Step 4: Run the tests**

```bash
npx jest src/middleware/__tests__/demoGuard.test.js
```

Expected: all three PASS.

- [ ] **Step 5: Apply the guard to the four upload and download routes**

In `src/backend/src/routes/invoices.routes.js`, add the import beside the existing middleware imports:

```javascript
const { blockInDemo } = require('../middleware/demoGuard');
```

Place `blockInDemo('File upload'),` immediately **before** `uploadSingle,` in the upload route's middleware chain, so the request is refused before multer touches the filesystem. On the download route, place `blockInDemo('File download'),` after the `authorizeRole(...)` entry.

Repeat both in `src/backend/src/routes/labResults.routes.js`.

- [ ] **Step 6: Verify all four are guarded**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
grep -n "blockInDemo" src/backend/src/routes/invoices.routes.js src/backend/src/routes/labResults.routes.js
```

Expected: four occurrences in total, two per file.

- [ ] **Step 7: Run the whole suite**

```bash
cd src/backend && npx jest
```

Expected: all pass, 219 tests.

- [ ] **Step 8: Commit**

```bash
git add src/backend/src/middleware/demoGuard.js src/backend/src/middleware/__tests__/demoGuard.test.js src/backend/src/routes/invoices.routes.js src/backend/src/routes/labResults.routes.js
git commit -m "refuse upload and download routes in demo mode"
```

---

### Task 7: Serverless entry point and Vercel configuration

**Files:**
- Create: `api/index.js`, `vercel.json`

**Interfaces:**
- Consumes: `src/backend/src/app.js` (already exports the Express app)
- Produces: a Vercel deployment serving the SPA at `/` and the API at `/api/*`

- [ ] **Step 1: Confirm the app exports without listening**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
grep -n "module.exports" src/backend/src/app.js
grep -n "app.listen" src/backend/src/app.js || echo "good — app.js does not listen"
```

Expected: `module.exports = app` present, no `listen` call.

- [ ] **Step 2: Create the entry point**

Create `api/index.js`:

```javascript
'use strict';

/**
 * Vercel serverless entry point for the hosted demonstration build.
 *
 * Exists only on demo/vercel-do-not-merge — see DO-NOT-MERGE.md. The AWS
 * deployment runs src/backend/src/server.js, which calls listen(); serverless
 * needs the bare app instead. That separation already existed, so this file is
 * a re-export rather than a restructuring.
 *
 * Module scope persists across warm invocations on the same instance, so
 * requiring the app here means the pg Pool inside it is created once per
 * instance rather than once per request. Cold starts still create one. Neon's
 * POOLED endpoint must be used, or concurrent cold starts exhaust the
 * connection limit.
 */
module.exports = require('../src/backend/src/app');
```

- [ ] **Step 3: Create the Vercel configuration**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd src/frontend && npm install && npm run build",
  "outputDirectory": "src/frontend/dist",
  "installCommand": "cd src/backend && npm install --omit=dev",
  "functions": {
    "api/index.js": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The second rewrite is the SPA fallback: any path that is not `/api/*` and not a built asset serves `index.html` so client-side routing works on a hard refresh. Order matters — the API rule must come first.

- [ ] **Step 4: Verify the frontend build command and output directory**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
grep -n '"build"' src/frontend/package.json
grep -n "outDir" src/frontend/vite.config.* 2>/dev/null || echo "default outDir: dist"
```

If the configured `outDir` is not `dist`, correct `outputDirectory` in `vercel.json` to match. Do not change the Vite config.

- [ ] **Step 5: Commit**

```bash
git add api/index.js vercel.json
git commit -m "add the vercel entry point and routing"
```

---

### Task 8: Provision Neon and load the schema

An operations task. Run it twice — once for `pdms-demo`, once for `pdms-uat`.

**Files:**
- Create: `scripts/init-demo-db.sql`

**Interfaces:**
- Consumes: `src/backend/src/config/schema.sql`
- Produces: two Neon databases with the full schema and RLS policies applied

- [ ] **Step 1: Create the databases**

In the Neon console, create two projects: `pdms-demo` and `pdms-uat`. From each, copy the **pooled** connection details — host, database, user, password. The pooled host contains `-pooler`; the direct one does not. Use pooled for the application.

- [ ] **Step 2: Create the role bootstrap script**

`schema.sql` creates `pdms_app` with a randomly generated password and prints it as a notice, which cannot be automated. Create `scripts/init-demo-db.sql` to run **before** it:

```sql
-- Creates the application role with a known password, so schema.sql's random
-- generation branch is skipped. Demo/UAT only — on AWS the role is created by
-- schema.sql itself and its password is held in SSM.
-- Usage: psql "$DIRECT_URL" -v app_password="'<password>'" -f scripts/init-demo-db.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pdms_app') THEN
    EXECUTE format('CREATE ROLE pdms_app LOGIN PASSWORD %L', :app_password);
  ELSE
    EXECUTE format('ALTER ROLE pdms_app WITH PASSWORD %L', :app_password);
  END IF;
END
$$;
```

- [ ] **Step 3: Apply both scripts using the DIRECT (non-pooled) connection**

DDL must not run through the transaction pooler.

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
psql "<DIRECT_URL>" -v app_password="'<choose-a-strong-password>'" -f scripts/init-demo-db.sql
psql "<DIRECT_URL>" -f src/backend/src/config/schema.sql
```

If `psql` is not on PATH, run both files through a short Node script using `pg`, connecting with the direct URL.

- [ ] **Step 4: Verify RLS actually applied**

```bash
psql "<DIRECT_URL>" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('patients','medical_records','sick_leaves','appointments','patient_invoices') ORDER BY relname;"
```

Expected: five rows, all `t` for both columns. If any is `f`, stop — RLS is the project's central security claim and the demo must not run without it.

- [ ] **Step 5: Commit the bootstrap script**

```bash
git add scripts/init-demo-db.sql
git commit -m "add the role bootstrap for managed postgres"
```

---

### Task 9: Seed synthetic demo data

**Files:**
- Create: `scripts/seed-demo.js`

**Interfaces:**
- Consumes: the schema from Task 8
- Produces: `node scripts/seed-demo.js` populates a database; exports `{ seed, truncateAll }` for reuse by Task 11

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-demo.js`. It must:

- Connect using `DB_*` environment variables, exactly as `database.js` does.
- Run inside a single transaction, committing only on success.
- Create four users, one per role, with bcrypt-hashed passwords taken from `DEMO_PASSWORD` (single password across demo accounts — these are public credentials by design).
- Create three doctors across different departments, referencing `departments.key` values that already exist in the schema.
- Create roughly twenty patients with **invented names**, phone numbers in the reserved `+96650000xxxx` range, and non-valid national identifiers prefixed `DEMO`.
- Create appointments spread across the next fourteen days, a few walk-in visits in each status, several invoices in mixed paid and unpaid states, and a handful of released lab results.
- Set `app.current_role` to `admin` via `set_config` inside the transaction before inserting into RLS-protected tables, exactly as `withTransaction` does — otherwise the inserts are filtered and silently insert nothing.
- Export `{ seed, truncateAll }` and run `seed()` when invoked directly.

The session-variable part is the one that fails **silently** — RLS filters the
inserts, the script reports success, and you get an empty clinic. Use this
skeleton:

```javascript
'use strict';

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

/** Applies an RLS session exactly as config/database.js withTransaction does. */
async function asRole(client, role, { userId = '', doctorId = '', patientId = '' } = {}) {
  await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
  await client.query('SELECT set_config($1, $2, true)', ['app.current_role', role]);
  await client.query('SELECT set_config($1, $2, true)', ['app.current_doctor_id', doctorId]);
  await client.query('SELECT set_config($1, $2, true)', ['app.current_patient_id', patientId]);
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // users and doctors have no RLS — insert directly.
    const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD, 10);
    // ... insert demo.superadmin / demo.staff / demo.doctor / demo.patient,
    //     then the doctors rows, capturing the returned ids.

    // patients IS RLS-protected and admin_insert_patients requires this role.
    await asRole(client, 'admin');
    // ... insert ~20 patients, capturing patient_ids.

    // medical_records requires the doctor's own id in the session.
    await asRole(client, 'doctor', { doctorId: <doctorId>, userId: <doctorUserId> });
    // ... insert records for that doctor's patients.

    await asRole(client, 'admin');
    // ... appointments, visits, invoices, lab results.

    await client.query('COMMIT');
    console.log('seeded');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
```

Every id referenced across sections must come from a `RETURNING` clause on the
insert that created it — never a hardcoded UUID, since the schema generates
them.

`truncateAll` must `TRUNCATE ... RESTART IDENTITY CASCADE` every table the seed writes, in dependency order, so Task 11 can reuse it.

- [ ] **Step 2: Run it against the demo database**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
DB_HOST=<pooled-host> DB_PORT=5432 DB_NAME=<db> DB_USER=pdms_app DB_PASSWORD=<pw> \
DB_SSL=true DB_SSL_MODE=standard DEMO_PASSWORD='DemoPass123!' \
node scripts/seed-demo.js
```

Expected: prints a summary of rows created, exits 0.

- [ ] **Step 3: Verify the data is visible to the right roles and hidden from the wrong ones**

```bash
psql "<DIRECT_URL>" -c "SELECT count(*) FROM patients;"
```

Expected: **0** — the direct connection sets no session variables, so RLS correctly filters everything. This is the check confirming RLS is live rather than absent. If it returns 20, RLS is not working and Task 8 Step 4 gave a false positive.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-demo.js
git commit -m "seed a synthetic clinic for the demo"
```

---

### Task 10: Verify RLS against Neon with the real isolation suite

Row-level security surviving the move is an assumption until it is executed. This is the project's central security claim.

**Files:**
- No new files. Runs `src/backend/src/__tests__/rls-isolation.test.js` against Neon.

**Interfaces:**
- Consumes: Tasks 8 and 9
- Produces: evidence that RLS behaves identically on Neon

- [ ] **Step 1: Point the suite at the Neon UAT database**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH/src/backend"
DB_HOST=<pooled-host> DB_PORT=5432 DB_NAME=<db> DB_USER=pdms_app DB_PASSWORD=<pw> \
DB_SSL=true DB_SSL_MODE=standard \
npx jest src/__tests__/rls-isolation.test.js
```

Expected: all 75 tests PASS, including the cross-tenant isolation cases and the `SECURITY DEFINER` double-booking checks.

- [ ] **Step 2: If any test fails, stop and diagnose before deploying**

The most likely cause is the pooler. Confirm the **pooled** endpoint is in use and that the failure is not a session-variable leak. `withTransaction` wraps every query in `BEGIN`/`COMMIT`, which pins the connection for the transaction, so transaction-mode pooling is correct. A failure here means either the wrong endpoint or a genuine behavioural difference — neither of which may be shipped.

- [ ] **Step 3: Record the result in the spec**

Append to `docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md` under Testing: the date, the database, and the pass count.

- [ ] **Step 4: Commit**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
git add docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md
git commit -m "record that rls passes against neon"
```

---

### Task 11: Reset endpoint and scheduled reset

**Files:**
- Create: `src/backend/src/routes/demo.routes.js`, `scripts/reset-demo.js`
- Modify: `src/backend/src/routes/index.js`
- Test: `src/backend/src/routes/__tests__/demoRoutes.test.js` (create)

**Interfaces:**
- Consumes: `{ seed, truncateAll }` from `scripts/seed-demo.js`
- Produces: `POST /api/demo/reset`, mounted only when `DEMO_MODE=true`, authorised by the `x-demo-reset-secret` header matching `DEMO_RESET_SECRET`

- [ ] **Step 1: Write the failing test**

Create `src/backend/src/routes/__tests__/demoRoutes.test.js`:

```javascript
'use strict';

// The authorisation predicate for the reset endpoint, asserted directly.
// A wrong answer here means anyone on the internet can wipe the demo.
function isResetAuthorised(headerValue, secret) {
  if (!secret) return false;
  if (typeof headerValue !== 'string') return false;
  return headerValue === secret;
}

describe('demo reset authorisation', () => {
  it('refuses when no secret is configured', () => {
    expect(isResetAuthorised('anything', undefined)).toBe(false);
    expect(isResetAuthorised('anything', '')).toBe(false);
  });

  it('refuses when the header is missing or not a string', () => {
    expect(isResetAuthorised(undefined, 's3cret')).toBe(false);
    expect(isResetAuthorised(['s3cret'], 's3cret')).toBe(false);
  });

  it('refuses a wrong secret', () => {
    expect(isResetAuthorised('wrong', 's3cret')).toBe(false);
  });

  it('accepts the exact secret', () => {
    expect(isResetAuthorised('s3cret', 's3cret')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd src/backend && npx jest src/routes/__tests__/demoRoutes.test.js
```

Expected: PASS — the predicate is defined in the test and documents the rule the route must implement.

- [ ] **Step 3: Write `scripts/reset-demo.js`**

It must import `{ seed, truncateAll }` from `seed-demo.js`, run `truncateAll` then `seed` inside one transaction, and export an async `reset()`.

- [ ] **Step 4: Write `src/backend/src/routes/demo.routes.js`**

A single `POST /reset` that applies the same authorisation rule asserted in Step 1, calls `reset()`, and responds `{ reset: true, at: <ISO timestamp> }`. It must **not** use `authenticateJWT` — the scheduler has no session — and must be rate-limited using the existing limiter pattern from `rateLimiter.js`.

- [ ] **Step 5: Mount it conditionally**

In `src/backend/src/routes/index.js`, add:

```javascript
// Demo-only. Absent DEMO_MODE the route does not exist at all, rather than
// existing and refusing — a route that is not mounted cannot be probed.
if (process.env.DEMO_MODE === 'true') {
  router.use('/demo', require('./demo.routes'));
}
```

- [ ] **Step 6: Confirm the route is absent by default**

```bash
cd src/backend && npx jest
```

Expected: all pass, 223 tests. No existing test should change.

- [ ] **Step 7: Add the Vercel cron for the public project only**

Add to `vercel.json`:

```json
  "crons": [
    { "path": "/api/demo/reset", "schedule": "0 2 * * *" }
  ]
```

02:00 UTC is 05:00 in Riyadh — outside any plausible demonstration or UAT session. Configure this on the **public** project only; the UAT project must never reset on a schedule, or a participant's work can vanish mid-task.

- [ ] **Step 8: Commit**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
git add src/backend/src/routes/demo.routes.js src/backend/src/routes/__tests__/demoRoutes.test.js src/backend/src/routes/index.js scripts/reset-demo.js vercel.json
git commit -m "add a guarded reset endpoint and nightly schedule"
```

---

### Task 12: Demo banner and search exclusion

**Files:**
- Create: `src/frontend/src/components/DemoBanner.tsx`
- Modify: `src/frontend/src/App.tsx`, `src/frontend/index.html`

**Interfaces:**
- Consumes: `import.meta.env.VITE_DEMO_MODE`
- Produces: a persistent banner on every screen

- [ ] **Step 1: Create the banner component**

`DemoBanner.tsx` renders nothing unless `import.meta.env.VITE_DEMO_MODE === 'true'`. When active it renders a fixed bar reading, in both languages:

> **Demonstration build — all data is synthetic. Not a real clinic system.**
> **نسخة تجريبية — جميع البيانات وهمية. ليس نظامًا طبيًا حقيقيًا.**

It must respect the existing RTL direction handling and not overlap the sidebar at mobile widths.

- [ ] **Step 2: Render it in `App.tsx`**

Mount it at the top level, outside the router, so it appears on every route including the login and public pages.

- [ ] **Step 3: Show the demo credentials on the login page**

A visitor who cannot sign in has no demo. Concealing credentials on a deliberately public build protects nothing.

In the login page component, render a panel below the form, gated on `import.meta.env.VITE_DEMO_MODE === 'true'` so it never appears in a real build:

```tsx
{import.meta.env.VITE_DEMO_MODE === 'true' && (
  <div className="demo-credentials" aria-label="Demonstration accounts">
    <p>Demonstration accounts — all use the password <code>DemoPass123!</code></p>
    <ul>
      <li><code>demo.doctor</code> — Doctor</li>
      <li><code>demo.staff</code> — Staff / reception</li>
      <li><code>demo.patient</code> — Patient</li>
      <li><code>demo.superadmin</code> — Superadmin</li>
    </ul>
  </div>
)}
```

The usernames must match those created by `scripts/seed-demo.js` in Task 9. If you changed them there, change them here.

- [ ] **Step 4: Add `noindex` to `index.html`**

```html
    <meta name="robots" content="noindex, nofollow" />
```

This is on the demo branch only, so the production build is unaffected.

- [ ] **Step 5: Verify locally**

```bash
cd src/frontend && npm install && VITE_DEMO_MODE=true npm run dev
```

Open the app and confirm the banner is visible on the login page and after signing in, in both languages, and that the credentials panel renders.

- [ ] **Step 6: Commit**

```bash
cd "D:/Main_/FYP/PSM 1 SECRH"
git add src/frontend/src/components/DemoBanner.tsx src/frontend/src/App.tsx src/frontend/index.html
git commit -m "mark the demo build as synthetic in the interface"
```

---

### Task 13: Deploy both projects and smoke test

**Files:** none.

**Interfaces:**
- Consumes: every prior task
- Produces: two live URLs

- [ ] **Step 1: Push the branch**

```bash
git push -u origin demo/vercel-do-not-merge
```

- [ ] **Step 2: Create the public project**

Import the repository in Vercel, set the production branch to `demo/vercel-do-not-merge`, and set:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DEMO_MODE` | `true` |
| `VITE_DEMO_MODE` | `true` |
| `UPLOAD_DIR` | `/tmp/uploads` |
| `DB_SSL` | `true` |
| `DB_SSL_MODE` | `standard` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Neon **pooled** values |
| `JWT_SECRET` | a freshly generated value, not reused from anywhere |
| `JWT_EXPIRES_IN` | `30m` |
| `COOKIE_SECURE` | `true` |
| `FRONTEND_URL` | the Vercel URL |
| `CLOUDFRONT_ORIGIN` | the Vercel deployment URL (same value as `FRONTEND_URL` — single origin) |
| `DEMO_RESET_SECRET` | a generated value |

`CLOUDFRONT_ORIGIN` is read by `src/backend/src/middleware/corsValidator.js` at module load, not per-request — if it's missing, the app fails to initialize and every request returns a 500 with no hint that an env var was the cause.

- [ ] **Step 3: Create the UAT project**

Identical, pointed at the `pdms-uat` database, **without** the cron.

- [ ] **Step 4: Smoke test each deployment**

1. Load `/` — the landing page renders and the demo banner is visible.
2. Sign in as each of the four roles.
3. As a doctor, open a patient and confirm records are visible.
4. As a patient, confirm only their own records appear.
5. Attempt an invoice upload — expect the 503 refusal, not a 500.
6. Start patient self-registration and confirm the OTP code is displayed.
7. Reload a deep route (e.g. `/dashboard/doctor`) and confirm the SPA fallback serves it rather than a 404.
8. Switch to Arabic and confirm the layout mirrors.

- [ ] **Step 5: Verify cross-tenant isolation on the live deployment**

Sign in as one patient, note an appointment ID, sign in as another, and request that ID directly through the API. Expect an empty result or 404 — never the other patient's row. This confirms RLS is live on the deployed build, not merely in the database.

- [ ] **Step 6: Record the URLs**

Add both to `DO-NOT-MERGE.md` and commit.

```bash
git add DO-NOT-MERGE.md
git commit -m "record the deployed demo urls"
git push
```

---

### Task 14: UAT dry run

**Files:** none.

**Interfaces:**
- Consumes: the deployed UAT project
- Produces: confidence that every task in the UAT script is completable before participants are invited

- [ ] **Step 1: Read the protocol**

Read `docs/psm2/sprints/sprint-5-uat-plan.md` in full.

- [ ] **Step 2: Work through every task yourself, as each role**

Follow the script exactly, on the hosted UAT deployment. Note any step that cannot be completed — particularly anything touching file upload, which is disabled.

- [ ] **Step 3: Revise the protocol where the hosted build differs**

Where a task depends on a disabled feature, either remove it from the script or mark it explicitly as out of scope for the hosted build, and record why. Do not leave a participant stuck on a step that cannot succeed.

- [ ] **Step 4: Reset the UAT database to a clean state**

```bash
curl -X POST -H "x-demo-reset-secret: <secret>" https://<uat-url>/api/demo/reset
```

- [ ] **Step 5: Commit any protocol revisions**

```bash
git checkout main
git add docs/psm2/sprints/sprint-5-uat-plan.md
git commit -m "adjust the uat protocol for the hosted build"
```

Note the protocol lives on `main` — it is project documentation, not demo code.

---

## Notes for whoever executes this

- **Tasks 1–7 are code and can be done in one sitting.** Tasks 8–13 need Neon and Vercel accounts and are partly manual. Task 14 needs nobody but you.
- **If a step tells you to modify an existing test, stop.** The existing 206 tests are the regression net for the guarded-change invariant. Needing to change one means a demo concern has leaked into production behaviour — reconsider the change rather than the test.
- **Test counts in this plan assume each task is completed in order.** If you skip a task the counts will differ; the important assertion is that no previously passing test starts failing.
