# plan-025-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-025-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-025-windows-hosted-acceptance` before commit
- baseline: main `1bd13f23520d75fe3e14d82cf7b4e9ea834626a6`
- reviewers: independent evidence/lifecycle, installer/privacy/security, adversarial harness
- reviewed_at: 2026-08-07 KST

## QA Evidence

- authoritative run `31181536529`, job `92875742049`, attempt 1, exact baseline SHA,
  main push, `windows-2025`, conclusion failure
- hosted scoped PASS: checkout, bounded cleanup retry, Windows installer identity and
  production launch-readiness controls
- hosted FAIL: rendered PowerShell fixture lost the normalized hash helper after a nested
  forced dependency-module reload
- hosted SKIPPED / `NOT RUN`: isolated npm trust, setup, QA, Rust, build, production
  lifecycle, private installed E2E, upload and downloaded artifact acceptance; artifacts 0
- local current-tree gates: focused Windows release contract, repeated full `npm run qa`,
  frontend 83/366, Rust default 319, Prisma/build/Tauri/full harness, review prerequisites
  and diff check all PASS
- corrected module-qualified PowerShell wiring: actual Windows `NOT RUN`

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P1 | rendered module's nested `Import-Module -Force` removed the caller-visible dependency helper | remove nested reload and use the caller-loaded module-qualified command |
| resolved P3 | durable evidence documents still described only Plan-024 and overstated `NOT RUN` for the executed corrected commit | record Plan-025 scoped PASS, fixture FAIL, downstream SKIPPED, artifacts 0; reserve `NOT RUN` for the new wiring |
| none | No remaining P0–P3 code, evidence, privacy, security or lifecycle finding | three final independent reviews approved |

## Requirements Trace

- every production and private caller loads the exact dependency module before the exact
  rendered module; immutable hashes bind all three callers and both modules.
- the rendered module does not reload its dependency and calls the dependency assertion
  through `windows-nsis-dependency-contract\Assert-BodamNsisDependencyContract`.
- negative controls reject a reintroduced nested reload and an unqualified dependency call.
- durable evidence keeps actual PASS, FAIL, SKIPPED and `NOT RUN` outcomes distinct.

## Privacy Review

- no customer row, credential, raw database, backup, export, installer, E2E artifact or
  full runner path was copied into source, documents, screenshots or logs.
- hosted evidence uses identifiers, bounded status and artifact count only.
- artifact boundary remains the exact production installer/checksum/evidence allowlist.

## Residual Risk

- the corrected module-qualified PowerShell fixture and downstream Windows lifecycle are
  actual `NOT RUN` until the follow-up exact `windows-2025` run.
- private installed full UI/native/restart/import/export/backup/restore and downloaded
  three-file artifact acceptance still require a successful hosted run.
- WebView2-absent network-blocked clean VM, Authenticode trust, SmartScreen reputation and
  public distribution remain outside scope.

## Follow-Ups

- Plan-026 must bind this completion commit's automatic main-push run by exact SHA and
  require every Windows step plus downloaded production artifact acceptance to pass.
- any new failure remains FAIL/NOT RUN and receives a new plan with QA and independent review.
