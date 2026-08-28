# plan-035-theme-bootstrap-ci-fix Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-035-theme-bootstrap-ci-fix.md`
- reviewed tree: `codex/plan-035-theme-bootstrap-ci-fix` before commit
- baseline: main `9ed42e9abc381058618bfc2b37b0cf70d323f618`
- failure evidence: GitHub Actions run 33145307390 at baseline SHA
- reviewers: independent code/parser, product/evidence and privacy/trust boundaries
- reviewed_at: 2026-08-28 KST

## QA Evidence

- final `npm run qa`: PASS — Vitest 90 files/389 tests, Rust 321 tests, lint, typecheck, Prisma validation·registry·diff, production Vite build, Tauri check and repository harness.
- final focused theme contract: 4/4 PASS; independent reviewer run 244ms, local final run 462ms with 112ms test execution.
- production and e2e Vite builds: PASS with unchanged runtime asset hashes and final HTML contract plugin.
- `npm run verify`: exit 0 — release `BODAM E2E` native IPC·SQLite·file flow passed Customer, policy, coverage, benchmark, family, consultation, Dashboard, Schedule/Calendar, XLSX/CSV import/export/round-trip/rollback and backup/restore/exit orchestration.
- actual release app: isolated OS-temp synthetic DB only; light, dark and system save/apply, current OS-dark system resolution, reload persistence and six top-level routes passed without a new error alert.
- `cargo fmt --check`, `git diff --check`, review prerequisites, Windows npm trust preflight, 300-line, sensitive-artifact and capability gates: PASS.
- hosted Windows modified branch before commit: NOT RUN because no remote ref existed; baseline failure is not reused as fixed evidence.

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P2 | the regression test ran a second full Vite build inside Vitest and exceeded the Windows 5-second default timeout | move final HTML validation to a build-only post-transform Vite plugin and keep unit assertions deterministic |
| resolved P2 | regex/token parsers accepted comments, fake attributes, raw script text and inert `template`·`textarea`·`srcdoc` contexts | parse with a loading/evaluation-disabled semantic DOM and inspect direct `<head>` children plus document-wide bootstrap uniqueness |
| resolved P2 | generated-asset filtering could ignore an earlier local or CDN stylesheet/module | separate `/assets/*.js|css` existence from the earliest actual module/stylesheet order check and add negative regressions |
| resolved P3 | detached happy-dom `window.close()` was a no-op | make parser, assertion and Vite hook async and await `window.happyDOM.close()` in `finally` |
| resolved P2/P3 | hosted and system-theme evidence scopes were initially ambiguous | record modified Windows as NOT RUN until push and distinguish actual current OS-dark/reload from automated OS-light/runtime coverage |
| none | no remaining P0–P3 code, product, privacy or trust finding | independent final reviewers approved the result |

## Failure and Crash Analysis

- Run 33145307390 passed 388 other Vitest tests; only nested `vite.build({ write: false })` took 5,985ms and timed out at 5,000ms, so installer and installed-app stages were skipped.
- The attached macOS report is `BODAM E2E` (`app.bodam.desktop.e2e`) aborting when launched without its required isolated `BODAM_E2E_DB_PATH`. Rust setup fails closed before the event loop and Tao cannot unwind the callback.
- The same test bundle launches and exits normally with a validated direct child of the OS temp directory. Production builds use their app-data path and do not compile this E2E fallback, so the report is not evidence of production DB corruption, OOM, WebKit or GPU failure.

## Product and Privacy Review

- Runtime app code, database schema, Tauri capability, package graph and Windows workflow/trust hashes are unchanged.
- No Google Calendar/OAuth implementation, remote endpoint, token storage or new business field was added.
- No real customer row, attachment, credential or private database path was copied into source, fixtures, documentation or screenshots.
- Actual-app and automatic E2E used separate synthetic temp databases; exact test directories were removed after target validation.

## Residual Risk

- The modified branch's hosted Windows NSIS and installed-app suite must be dispatched after the first push; a failure reopens QA and this review.
- The E2E-only missing/invalid DB-path launch exits through a macOS panic/abort instead of a friendly diagnostic. This is fail-closed and does not affect production, but remains a P3 test-harness UX follow-up.
- Manual macOS light↔dark system-setting mutation was not run; automated cold-start/runtime tests cover both values and the actual app covered current OS-dark plus reload.
- Vite retains the existing 533.56 kB main-chunk warning, with no observed functional failure.

## Follow-Ups

- Dispatch and record the exact modified-branch Windows run after commit/push, then verify the exact main-merge SHA run.
- Consider a Node preflight that rejects missing/noncanonical E2E DB paths before launching the native bundle, if test-runner diagnostics become a maintenance problem.
