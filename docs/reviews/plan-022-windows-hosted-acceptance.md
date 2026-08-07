# plan-022-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-022-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-022-windows-hosted-acceptance` before commit
- baseline: main `17f5f5755291483a25a33064f5bf196db0c06848`
- reviewers: independent evidence/lifecycle/privacy, Windows cleanup, adversarial harness
- reviewed_at: 2026-08-07 KST

## QA Evidence

- authoritative hosted run `31160070617`, job `92808166405`, exact baseline SHA,
  main push attempt 1, `windows-2025`, conclusion failure
- hosted PASS boundary: cross-layer QA, actual PowerShell controls, Rust all-features,
  unsigned production NSIS build, unconditional cleanup and summary
- hosted FAIL boundary: production lifecycle outer cleanup encountered an app-owned
  WebView2 UDF `IOException`, exact HResult `0x80070020`
- hosted NOT RUN boundary: normal exit/uninstall completion and preservation are not
  proven; private installed E2E and artifact upload were skipped; artifact count 0
- local current-tree gates: repeated `npm run qa`, frontend 83/366, Rust default 319,
  Rust all-features 335/335, database/build/Tauri/full harness, focused mutations,
  dependency audit 0, review prerequisite and diff check all PASS

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P2 | cleanup existence probes treated arbitrary provider errors like absence | exact `ItemNotFoundException` helper, probe/postcondition use, real missing-drive control and mutations |
| resolved P2 | workflow step substring allowed a comment-only filename and synthetic command | exact active mapping-field `run`/`id` binding and comment-decoy mutation |
| resolved P2 | first exact regex still accepted block-scalar `run:` decoys and activation modifiers | exact field indentation, reviewed workflow SHA-256, block-comment/`if: false`/`continue-on-error` rejection |
| none | No remaining P0–P3 code, evidence, privacy or lifecycle finding | three final independent reviews approved |

## Requirements Trace

- cleanup retries only exact Windows sharing violations for 20 attempts at 250ms while
  revalidating direct-child and reparse safety every attempt.
- exact not-found is the only successful absence probe; access/provider errors and
  exhausted locks fail closed without broad WebView2 process termination.
- the hosted control step is bound to the exact reviewed workflow, unconditional
  execution and fail-closed outcome.
- hosted baseline failure and locally reviewed remediation remain distinct evidence.

## Privacy Review

- no customer rows, credentials, raw database, backup, export, installer, E2E artifact
  or full runner path was copied into source, documents or logs.
- lock controls use synthetic temporary files and pathless constant failure messages.
- artifact boundary remains the exact production installer/checksum/evidence allowlist.

## Residual Risk

- changed cleanup and native provider/lock controls are actual Windows `NOT RUN` until
  the follow-up exact `windows-2025` run.
- normal production lifecycle, private installed full UI/native/restart/import/export/
  backup/restore E2E and successful three-file artifact acceptance require that run.
- WebView2-absent network-blocked clean VM, Authenticode trust, SmartScreen reputation
  and public distribution remain outside scope.

## Follow-Ups

- Plan-023 must bind the new main commit automatic push run by exact SHA and accept every
  Windows step and artifact value.
- any failure remains FAIL/NOT RUN and receives a new plan with QA and independent review.
