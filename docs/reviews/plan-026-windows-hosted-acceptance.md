# plan-026-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-026-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-026-windows-hosted-acceptance` before commit
- baseline: main `a5a0bd9bf640c5ed416ba4100de2da2b48f29208`
- reviewers: independent evidence, PowerShell root-cause and adversarial harness
- reviewed_at: 2026-08-07 KST

## QA Evidence

- authoritative run `31182975142`, job `92880515158`, attempt 1, exact baseline SHA,
  main push, `windows-2025`, conclusion failure
- hosted scoped PASS: checkout, bounded cleanup retry, Windows installer identity and
  production launch-readiness controls
- hosted FAIL: rendered NSIS fixture returned only the normalized generic exact-form error;
  the hosted log does not identify an inner assertion
- hosted SKIPPED / `NOT RUN`: isolated npm trust, setup, QA, Rust, build, production
  lifecycle, private installed E2E, upload and downloaded artifact acceptance; artifacts 0
- local PowerShell 7.6.4 reproduction isolated a provider-only ancestor property failure and
  a latent comma-precedence split; the temporary non-Windows shim is not junction evidence
- local current-tree gates: corrected rendered control, focused Windows contract, full
  `npm run qa`, frontend 83/366, Rust default 319, Rust all-features 335/335,
  Prisma/build/Tauri/full harness, review prerequisites and diff check all PASS
- corrected CLR-type, exact-three-newline and parent-reparse wiring: actual Windows `NOT RUN`

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P1 | raw `DirectoryInfo.Parent` was required to expose provider-added `PSIsContainer` | use CLR type/name/attribute checks and add a parent reparse negative |
| resolved P1 | PowerShell comma precedence produced five fixture elements instead of three newline scalars | parenthesize each concatenation, assert exact count/types and bind mutations |
| resolved P3 | durable docs attributed local dependency-entry trace detail to the generic hosted failure | separate hosted outcome from local trace and scope the non-Windows shim |
| resolved P1 | a source line wrap broke the exact durable `NOT RUN` phrase required by the checker | restore the contiguous boundary and rerun focused and full QA |
| none | No remaining P0–P3 code, evidence, privacy, security or lifecycle finding | three final independent reviews approved |

## Requirements Trace

- dependency checks use raw CLR object identity and fail closed on terminal or ancestor
  reparse points without relying on provider-added properties.
- newline fixtures are exactly three scalar strings for LF, CRLF and CR; negative mutations
  reject ungrouped concatenation or a removed count/type assertion.
- immutable SHA-256 mappings bind dependency and rendered modules to all callers.
- durable evidence keeps hosted PASS, generic FAIL, SKIPPED and actual `NOT RUN` distinct
  from local portable reproduction evidence.

## Privacy Review

- no customer row, credential, raw database, backup, export, installer, E2E artifact, full
  runner path or local temporary path was copied into source, documents or screenshots.
- hosted evidence uses identifiers, bounded status and artifact count only.
- artifact boundary remains the exact production installer/checksum/evidence allowlist.

## Residual Risk

- corrected rendered fixture and downstream Windows lifecycle are actual `NOT RUN` until
  the follow-up exact `windows-2025` run.
- private installed full UI/native/restart/import/export/backup/restore and downloaded
  three-file artifact acceptance still require a successful hosted run.
- WebView2-absent network-blocked clean VM, Authenticode trust, SmartScreen reputation and
  public distribution remain outside scope.

## Follow-Ups

- Plan-027 must bind this completion commit's automatic main-push run by exact SHA and
  require every Windows step plus downloaded production artifact acceptance to pass.
- any new failure remains FAIL/NOT RUN and receives a new plan with QA and independent review.
