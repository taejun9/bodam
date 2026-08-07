# plan-027-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-027-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-027-windows-hosted-acceptance` before commit
- baseline: main `e42ad20d75acb9f33c5529f2397b25e3796089ee`
- authoritative run: `31185908075`, attempt 1, job `92890241298`
- reviewers: independent code/dialog, evidence/privacy and trust/harness
- reviewed_at: 2026-08-07 KST

## QA Evidence

- authoritative exact-SHA main-push run on `windows-2025`: overall FAIL
- actual Windows PASS: corrected PowerShell controls, isolated npm trust, cross-layer QA,
  all-feature Rust, production and private NSIS builds, production install/readiness/normal
  close/uninstall, app-data/shared-WebView2 preservation and failure cleanup
- actual installed first spec: `2 PASS / 4 FAIL`; overlap rejection and one-row preservation
  passed before an unscoped Escape did not close the open dialog
- actual Windows `NOT RUN`: remaining restart/persistence, import/export, rollback,
  backup/restore, upload and downloaded artifact acceptance; artifacts 0
- remediation PASS: focused AppDialog 8/8, local actual-app bundle full E2E exit 0,
  frontend 83 files/367 tests, Rust default 319 and all-features 335, build, Tauri,
  isolated npm trust, Windows contracts, full harness, review prerequisites and diff check
- corrected dismissal actual Windows: `NOT RUN` until the follow-up exact-commit run

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P1 | submit disabled the active control, while a global Escape was not bound to the dialog dismissal target | expose busy/dismiss-disabled, wait for settlement and click the scoped close control |
| resolved P2 | local macOS app-bundle evidence and later same-spec failures were worded too broadly | limit local evidence and label the downstream cascade as inference, not an independent defect |
| resolved P3 | hosted wording claimed an unobserved settled state and used the wrong QA date | state only the open-dialog observation and record the actual date |
| resolved P2 | loose durable tokens allowed exact SHA, PASS and `NOT RUN` meaning reversals | bind exact phrases and add eight two-document negative mutations |
| none | No remaining P0–P3 code, evidence, privacy, security or lifecycle finding | all three independent re-reviews approved |

## Requirements Trace

- pending submit state now blocks Escape, backdrop and close-button dismissal through the
  shared dialog contract; rejection settlement restores an enabled explicit close action.
- E2E requires rejection text, unchanged row count, busy release, close enablement, scoped
  close, zero open dialogs and invoker focus restoration.
- immutable SHA-256 mappings bind the changed 54-file E2E trust tree through the node checker,
  isolated preflight and workflow checker.
- durable evidence binds exact commit, production PASS, installed FAIL, remaining `NOT RUN`,
  upload skip/artifact 0 and corrected-flow Windows `NOT RUN` with negative controls.

## Privacy Review

- no customer row, credential, raw database, backup, export, installer, E2E artifact, full
  runner path or local temporary path was copied into source, documents or screenshots.
- only bounded synthetic counts, run/job identifiers, exact commit and status were retained.
- the production three-file allowlist was not downloaded because upload was skipped.

## Residual Risk

- the corrected dialog flow, remaining installed suite and downloaded artifact acceptance
  require the next exact-SHA `windows-2025` run.
- WebView2-absent network-blocked clean VM, Authenticode trust, SmartScreen reputation and
  public distribution remain outside this plan's authority.
- the 299-line component test file must be split before another source addition.

## Follow-Ups

- Plan-028 must bind this remediation commit's automatic main-push run by exact SHA.
- it must require the complete installed suite and exact three-file downloaded artifact
  acceptance; any new failure stays FAIL/`NOT RUN` and receives a new reviewed plan.
