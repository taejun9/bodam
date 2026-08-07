# plan-021-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-021-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-021-windows-hosted-acceptance` before commit
- baseline: main `823dc392c74dbcb53963c0943e7977c924db85ce`
- reviewers: independent evidence, Windows lifecycle/privacy, adversarial harness
- reviewed_at: 2026-08-07 KST

## QA Evidence

- authoritative hosted run `31153074187`, job `92786630714`, exact baseline SHA, main push attempt 1, `windows-2025`, conclusion failure
- hosted PASS boundary: cross-layer QA, recursive PowerShell/NSIS identity controls, Rust all-features, unsigned production NSIS build, silent install, installed x64 regular-path payload and actual window launch, unconditional cleanup and summary
- hosted FAIL boundary: handle-only production smoke observed the installed window but did not find required roaming app-data before force-stop
- hosted NOT RUN boundary: normal close/exit, normal uninstall preservation, private installed E2E, artifact staging/upload/acceptance; artifact count 0
- local current-tree gates: focused adversarial Windows contract, repeated `npm run qa`, frontend 83/366, Rust default 319, Prisma/database, Vite/Tauri/full harness, Rust all-features 335/335, dependency audit 0, review prerequisite and diff check all PASS

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P1 | initial review state had only the hosted `result: FAIL` | recorded a distinct local remediation `result: PASS`, moved to review only after QA |
| resolved P2 | root-cause wording overstated unexecuted Windows confirmation | downgraded to supported analysis and retained changed lifecycle as `NOT RUN` |
| resolved P3 | roaming provenance was indirect | pinned Tauri 2.11.5 PathResolver and dirs 6.0.0 Windows roaming sources |
| resolved P2 | comment, polarity, wrapper/oracle no-op, lifecycle reorder and document decoys passed partial regex checks | added exact semantic blocks, physical function/source digests and focused mutations |
| resolved P3 | cleanup property race could expose a native path error | wrapped the complete guard/force-stop/wait path in a constant-error catch |
| resolved P3 | zero-byte controls were not independent | repeated DB and daily zero-byte checks from an otherwise complete fixture and restored a positive state |
| resolved P2 | dormant strings, scriptblocks, false branches, export decoys, backtick whitespace and token-attached comments bypassed normalized checks | rejected multiline/here strings, bound five critical raw sources exactly and added dedicated dormant/continuation/token mutations |
| none | No remaining P0–P3 code, evidence, privacy or lifecycle finding | three final independent re-reviews approved |

## Requirements Trace

- startup readiness now requires an exact responsive installed process plus stable roaming SQLite, one completed daily backup and empty workspace before one normal OS close request.
- normal exit requires a 60-second bound, exit code 0 and no exact process; force-stop remains failure cleanup only.
- production evidence can claim app-data preservation only after normal exit and unchanged database/daily-backup hashes following NSIS uninstall.
- production smoke remains narrower than the private installed full UI/native/restart/import/export/backup/restore suite.

## Privacy Review

- customer rows, credentials, raw database, backup, export, installer or E2E artifact were not added to source, docs or evidence.
- readiness tokens and runner paths are not emitted; native inspection failures are converted to constant errors.
- synthetic mutation fixtures use OS temporary directories and the artifact boundary remains the exact production three-file allowlist.

## Residual Risk

- the changed PowerShell readiness, normal close/uninstall and installed lifecycle remain actual Windows `NOT RUN` until the follow-up exact `windows-2025` run.
- private installed full E2E and successful three-file artifact acceptance likewise require that follow-up run.
- WebView2-absent network-blocked clean VM, Authenticode trust, SmartScreen reputation and public distribution remain outside scope.

## Follow-Ups

- Plan-022 must bind the new main commit's automatic push run by exact SHA and accept every Windows step and artifact value.
- any failure remains FAIL/NOT RUN and receives a new plan with QA and independent review before another run.
