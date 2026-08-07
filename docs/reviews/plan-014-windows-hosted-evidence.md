# plan-014-windows-hosted-evidence Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-014-windows-hosted-evidence.md`
- reviewed tree: `codex/plan-014-windows-hosted-evidence` before commit
- baseline: main `641db6c4833015345394a5ab0d151fc57dd9446c`
- reviewer roles: independent PowerShell/cleanup, visual-contract, run-evidence/privacy/lifecycle
- reviewed_at: 2026-08-07 KST

## QA Evidence

- hosted first attempt: run `31138692455`, job `92743753702`, exact baseline commit, `windows-2025`, conclusion failure
- hosted boundary: dependency install success; cross-layer QA and cleanup failure; core Windows/installer/E2E skipped; summary success; upload skipped; artifacts 0
- reproduction: official PowerShell 7.6.4 parsed `15_000` as invalid at module import; `15000` yields 6/6 repository PowerShell files with parse errors 0
- frontend: focused visual contracts 2 files/5 tests and full Vitest 83 files/366 tests, lint and typecheck PASS
- `npm run qa`: Prisma registry/hash/diff, Rust default 319/319, Vite production build, Tauri check and all harness controls PASS
- Rust: all-features 335/335, fmt, all-features Clippy `-D warnings`, Windows MSVC tests/all-features no-link projection PASS
- dependencies: `npm audit --audit-level=high` vulnerability 0
- actual macOS app: full native UI/function E2E overall exit 0, including restart, import/export/round-trip/rollback and backup/restore/exit scenarios
- final gates: recursive PowerShell mutation control, diff check, 300-line, privacy and artifact scans PASS

## Findings

| severity | finding | resolution |
|---|---|---|
| P1 | lifecycle checklist claimed independent review/completed mirror too early | reverted to unchecked; checked only with completed-plan move and mirror creation |
| P2 | unqualified PASS/artifact wording could imply hosted acceptance | split local remediation PASS from hosted FAIL/NOT RUN/artifact 0 and made artifact contract conditional on successful non-PR rerun |

Code reviewers reported no P0–P3 findings. Both documentation findings passed cross re-review with no unresolved or new P0–P3 findings.

## Requirements Trace

- authoritative failure: exact run/job/commit and public step/annotation boundary recorded without upgrading skipped work to PASS
- remediation: Windows newline-independent visual contracts and valid PowerShell wait literal implemented
- prevention: local mutation and hosted recursive native PowerShell parser added
- local readiness: full cross-layer QA, Windows source projection and actual native macOS UI/function E2E passed
- lifecycle: a new main commit is required before hosted rerun, so exact-commit acceptance is explicitly handed to Plan-015

## Privacy Review

- No real customer row, contact, memo, full runner path, raw log, credential, database, backup or export artifact was copied into source or evidence.
- Public annotations and bounded run metadata were used; anonymous raw-log `403` was kept as an access boundary rather than bypassed.
- Cleanup exact-child, no-reparse, registry and shared WebView2 contracts were not widened.
- Failed run produced no uploaded artifact; unsigned and offline clean-VM limits remain explicit.

## Residual Risk

- Production NSIS build/install/launch/uninstall, installed Windows E2E, NTFS tests, cleanup and exact artifact evidence remain unaccepted until Plan-015 passes on the new commit.
- `GetFolderPath()` can return empty when a special folder is absent. This was unreachable in the first failed cleanup, remains fail-closed and is an explicit Plan-015 observation point.
- Authenticode, SmartScreen reputation and WebView2-missing network-disabled clean VM acceptance remain outside the approved environment.

## Follow-Ups

- Plan-015 must bind the automatically triggered main run to the new exact commit, require every core step and cleanup to succeed, and reconcile the one exact three-file production artifact.
- Any new hosted failure must be recorded as failure/NOT RUN and fixed through a new complete QA/review lifecycle before another exact-commit rerun.
