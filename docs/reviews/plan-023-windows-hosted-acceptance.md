# plan-023-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-023-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-023-windows-hosted-acceptance` before commit
- baseline: main `b1afed381609542909e2082586736e7f5b6a3485`
- reviewers: independent evidence/lifecycle/privacy, launcher/security, adversarial harness
- reviewed_at: 2026-08-07 KST

## QA Evidence

- authoritative hosted run `31164325344`, job `92821578155`, exact baseline SHA,
  main push attempt 1, `windows-2025`, conclusion failure
- hosted scoped PASS: cross-layer QA, actual PowerShell controls, Rust all-features,
  unsigned production NSIS build, production lifecycle, runner-local three-file staging,
  unconditional cleanup and summary
- hosted FAIL: Node.js 24.18.1 rejected direct absolute `.cmd` spawning with `EINVAL`
  before the private Tauri/Rust build began
- hosted NOT RUN: private installed full E2E and artifact upload/download; artifacts 0
- local current-tree gates: repeated `npm run qa`, frontend 83/366, Rust default 319,
  Rust all-features 335/335, database/build/Tauri/full harness, actual subprocess controls,
  dependency audit 0, review prerequisites and diff check all PASS
- local actual `npm run test:e2e`: PASS with a real macOS Tauri/WebKit application,
  synthetic UI/native/restart/import/export/backup/restore scenarios and cleanup

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P1 | empty immutable control could bypass digest validation | unconditional digest comparison and zero-byte mutation |
| resolved P2 | two npm consumers were not digest-bound and computed dynamic spawn could evade static matching | six normalized source digests plus inactive/computed child-process mutations |
| resolved P2 | Windows case-insensitive npm environment aliases could override fixed provenance | remove every alias before canonical reinjection and test uppercase poison values |
| resolved P2 | evidence wording risked expanding successful steps into a failed-run PASS | scoped production PASS separated from run failure and private/upload `NOT RUN` |
| resolved P1 | Windows uppercase environment lookups were expected absent despite case-insensitive semantics | platform-aware actual-control expectations for canonical fixed values |
| resolved P1 | `run-s --npm-path true` could replace the QA task graph | exact ordered task tuple and option-injection mutation |
| resolved P3 | chronology implied later test-only fixes reran unchanged application E2E | exact rerun boundary recorded without expanding evidence |
| none | No remaining P0–P3 code, evidence, privacy or lifecycle finding | three final independent reviews approved |

## Requirements Trace

- child Node tools use only `process.execPath`, verified absolute regular JavaScript CLI
  files, argv arrays and fixed `shell: false`; spawn errors, signals and null status fail.
- npm child provenance cannot be replaced by case variants from scenario input, and
  expected nonzero exits are the only accepted failure mode.
- actual subprocess controls run before the QA graph and exercise paths and argv with
  spaces and shell metacharacters while proving no shell sentinel was created.
- immutable normalized digests and adversarial mutations bind the runner, builders,
  consumers, package task order and official security rationale.
- hosted baseline failure and locally reviewed remediation remain distinct evidence.

## Privacy Review

- no customer rows, credentials, raw database, backup, export, installer, E2E artifact
  or full runner path was copied into source, documents, screenshots or logs.
- controls use synthetic temporary files, bounded values and pathless failure messages.
- artifact boundary remains the exact production installer/checksum/evidence allowlist.

## Residual Risk

- the changed Node launcher and private installed suite are actual Windows `NOT RUN`
  until the follow-up exact `windows-2025` run.
- GitHub artifact packaging, metadata, digest and downloaded inner allowlist/evidence
  acceptance require that successful run.
- WebView2-absent network-blocked clean VM, Authenticode trust, SmartScreen reputation
  and public distribution remain outside scope.

## Follow-Ups

- Plan-024 must bind the new main commit automatic push run by exact SHA and accept every
  Windows step and the downloaded production artifact.
- any failure remains FAIL/NOT RUN and receives a new plan with QA and independent review.
