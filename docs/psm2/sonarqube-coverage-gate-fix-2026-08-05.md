# SonarQube coverage gate fix (2026-08-05)

## The symptom

Every push to `main` showed a red X on GitHub, and `deploy.yml`'s `terraform-apply` /
`publish-backend-image` / `publish-frontend` jobs kept showing **skipped** or **cancelled** instead
of actually running. In practice this meant the real CI/CD pipeline had never successfully deployed
anything — every live deployment so far (Sprint 4's original verification, Sprint 5's RTO test) was
done by hand-running `terraform apply`, not through the pipeline.

## Two distinct causes, easy to conflate

1. **SonarQube Quality Gate fails → jobs skipped.** `deploy.yml`'s `terraform-apply` job has
   `needs: scan` + `if: needs.scan.result == 'success'`. `security-scan.yml`'s `sast` job has no
   `continue-on-error` on its SonarQube Quality Gate step, so any commit touching real application
   code failed the gate on `new_coverage` (this repo had zero automated tests), which failed `sast`,
   which failed `scan`, which skipped every downstream deploy job. This is the pipeline working
   correctly — no scan pass, no deploy — not a bug.

2. **Scans all pass → jobs get cancelled, not skipped.** When a commit's diff had no coverable
   application code (docs-only, config-only), the SonarQube gate could pass trivially, and
   `terraform-apply` would actually start — but it runs under a GitHub `production` environment with
   a required-reviewer approval rule (deliberate, added in Sprint 4). If nobody clicked "Approve" in
   GitHub's UI before a newer commit superseded it in the `deploy-main` concurrency group, the job
   showed **cancelled**. Also correct behavior — the human approval gate doing its job — just easy to
   mistake for a failure.

This document is about fixing cause #1. Cause #2 needs a human to click Approve when a real deploy is
wanted; there's nothing to fix in the pipeline itself.

## Why "just add some tests" didn't work on the first try

The obvious fix — add a Jest test suite and wire its lcov report into SonarQube — is necessary but
turned out not to be sufficient on its own. Querying SonarCloud's quality gate API directly
(`GET /api/qualitygates/project_status?projectKey=Mhdomer_secure-cloud-pdms&branch=main`) after the
first test-suite commit showed:

```json
"new_coverage": {"status": "ERROR", "comparator": "LT", "errorThreshold": "80", "actualValue": "0.0"},
"periods": [{"index": 1, "mode": "previous_version", "date": "2026-07-27T09:09:36+0000"}]
```

**The real root cause**: `sonar.projectVersion` had never been set in any analysis this project ever
ran (confirmed via `GET /api/project_analyses/search` — every historical analysis shows
`"projectVersion": "not provided"`). SonarCloud's "New Code Definition" was set to **Previous
Version** mode, which — with no version ever changing — stayed anchored to this project's very first
scan on 2026-07-27. Every commit since then, not just each PR's own diff, was being judged against
the 80%-coverage bar. Four or five small unit test files can plausibly cover one commit's diff; they
cannot plausibly cover months of accumulated Sprint 3c/4/5 application code.

## The actual fix

1. **Real test suite** (`src/backend/src/utils/__tests__/*.test.js`, Jest): `invoiceCalc.js` (billing
   math), `session.js` (JWT/cookie logic), `duration.js`, `pagination.js`, `otp.js`. 33 tests, all
   pure functions or trivially mockable, no database required. `npm run test:coverage` generates
   `src/backend/coverage/lcov.info`.
2. **`sonar-project.properties`**: added `sonar.tests`, `sonar.test.inclusions` (so test files aren't
   themselves judged for coverage), and `sonar.javascript.lcov.reportPaths` pointing at the generated
   report.
3. **`security-scan.yml`**: added a step to install backend deps and run `npm run test:coverage`
   before the SonarQube Scan step, so the lcov report exists on disk when the scanner runs.
4. **The version fix**: added `args: -Dsonar.projectVersion=${{ github.run_number }}` to the
   SonarQube Scan step, so every analysis reports a version that differs from the last one — this is
   what actually lets the "Previous Version" baseline advance instead of staying pinned to
   2026-07-27.

## One more wrinkle: a one-analysis lag

The version-bump fix didn't take effect on the very next analysis — that run still showed
`new_coverage: 0.0` against the old 2026-07-27 baseline, even though the analysis correctly recorded
a new `VERSION` event. It took a **second** analysis after the version-bump commit for the baseline
to actually move to "since the previous analysis." In other words: SonarCloud detects the version
change during analysis N, but N's own quality gate is still evaluated against the baseline that was
already in effect before N started; the new baseline only applies starting from analysis N+1. Verified
by pushing one more real commit (a 5th test file, for `otp.js`) — that run's SonarQube SAST job
**passed**, confirmed both in GitHub Actions and via the same `qualitygates/project_status` API call.

## Result

Three real, consecutive CI runs on `main`, in order:

| Run | SonarQube SAST | What changed |
|---|---|---|
| `31025687665` | ❌ failed | Test suite added, but `new_coverage` still `0.0` — baseline still 2026-07-27 |
| `31026067867` | ❌ failed | `sonar.projectVersion` fix pushed — but this is the "lag" run, baseline still hadn't moved |
| `31026380696` | ✅ **passed** | One more commit later — baseline now "since previous analysis," gate passes |

Checkov and Trivy have been passing the whole time; this was always specifically the SonarQube
coverage condition. On run `31026380696`, `Terraform Plan & Apply` correctly proceeded to the
`production` environment's approval gate and waited for a human — cause #2 above, working as
designed. It was manually rejected in this instance since no live deploy was actually needed at that
moment, not because of any pipeline defect.

## What this doesn't fix

- **Overall project coverage is still ~3%.** This only makes the *new-code* gate track real per-PR
  diffs going forward — it does not retroactively test the rest of the codebase. Every future PR that
  touches backend logic still needs to bring its own tests to keep clearing 80% on its own diff.
- **Frontend has no test suite or coverage wired in at all.** Only backend lcov is referenced in
  `sonar-project.properties`.
- **`sonar.projectVersion` needs to keep changing on every analysis to keep working.** Using
  `github.run_number` handles this automatically — nobody needs to remember to bump a version string
  — but if that `args:` line is ever removed from `security-scan.yml`, this exact problem will
  recur.

## Files changed

- `src/backend/package.json`, `src/backend/jest.config.js` — Jest setup
- `src/backend/src/utils/__tests__/invoiceCalc.test.js`, `duration.test.js`, `pagination.test.js`,
  `session.test.js`, `otp.test.js` — the actual tests
- `sonar-project.properties` — lcov report path + test-file recognition
- `.github/workflows/security-scan.yml` — test-with-coverage step + `sonar.projectVersion` fix
- `.gitignore` — added `coverage/`
