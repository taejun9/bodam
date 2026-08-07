# plan-028-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-028-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-028-windows-hosted-acceptance` before commit
- baseline: main `37a5031ce2e107cd36628e54b18c63f6ea417022`
- authoritative run: `31190817318`, attempt 1, job `92906854501`
- reviewers: independent run/evidence, artifact/privacy and harness/lifecycle
- reviewed_at: 2026-08-08 KST

## QA Evidence

- [authoritative run 31190817318](https://github.com/taejun9/bodam/actions/runs/31190817318):
  main push, exact baseline SHA, `windows-2025`, every build/test/lifecycle/cleanup/upload
  step and post-step succeeded.
- actual production lifecycle: current-user NSIS install, exact executable launch/readiness,
  normal close, roaming DB/daily backup, uninstall and app-data/shared-WebView2 preservation PASS.
- installed full E2E: Customer write 6/6, restart 4/4, XLSX/CSV round trips 4/4 each,
  rollback 1/1, DB 3/3, export 6/6 and four backup/restore phases 1/1 each PASS.
- four reporter-level `FAILED` sessions are controlled app-exit specs; the successful parent
  orchestrator verified phase markers, logical snapshots, residue and cleanup contracts.
- artifact consumer: exact one artifact, ID `8999827782`, 216336758-byte ZIP and API SHA-256
  `89f62effb398e39bcbab7f87d0d6427b40c4e94f9d74ea0cbb4518d7d514bbac` PASS.
- exact three regular unencrypted entries, 216335276-byte installer SHA-256
  `4dd05128f9139d95ab3e9e8fcb92391559441bba221ec0c306f0579d56939727`, checksum and
  strict 24-key evidence PASS; source and installed hashes are valid and intentionally distinct.
- final post-finding `npm run qa`: Node subprocess, lint/typecheck, frontend 83 files/367 tests,
  Prisma contract, Rust default 319, Vite build, Tauri check and full harness PASS.
- focused Windows release contract, CRLF/CR fixtures, eight two-document semantic mutations,
  `run_review.py` and `git diff --check` PASS; every changed file remains below 300 lines.

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P3 | two residual-boundary sentences attributed current hosted NTFS/artifact evidence to Plan-013 | changed both provenance labels to Plan-028, reran full QA and obtained independent no-finding re-reviews |
| none | No remaining P0–P3 evidence, artifact, privacy, security, harness or lifecycle finding | all three independent final reviews approved |

## Requirements Trace

- exact run/job/SHA and every hosted result are bound to durable case-sensitive checker tokens.
- actual installed Windows automation covers the complete synthetic UI/native, persistence,
  import/export, rollback and backup/restore suite, including the corrected settled dialog flow.
- the production artifact is bound to exact metadata, ZIP allowlist, checksum, evidence schema,
  source/installed binary identities, retention and temporary cleanup.
- all 49 hosted production/installed/upload checklist items are checked; all ten offline clean-VM
  items remain unchecked and explicitly `NOT RUN - environment unavailable`.

## Privacy Review

- no customer row, credential, raw database, backup, export, installer bytes, raw runner log,
  full runner path or local temporary path was copied into the repository or evidence documents.
- artifact checks used private temporary directories, never executed or filesystem-extracted the
  installer, and deleted all local copies after streamed inspection.
- repository `runtime-data` and `.runtime` are absent; only bounded counts, identifiers, hashes,
  basenames and status metadata are retained.

## Residual Risk

- the artifact is `NotSigned`; Unknown Publisher or SmartScreen warnings remain possible and
  public-distribution trust is not claimed.
- WebView2-absent network-blocked clean-VM wizard acceptance remains `NOT RUN`; hosted Windows
  proves the current production lifecycle and full feature execution, not that external gate.
- the GitHub artifact expires at 2026-08-14T15:38:04Z; rebuild or a separately authorized release
  channel is required after expiry.
- local SQLite, exports and backups are plaintext and depend on OS-account and disk protection.

## Follow-Ups

- obtain Authenticode credentials and a clean Windows 11 VM only if signed/public distribution is
  authorized; do not downgrade the present unsigned hosted result to a public release claim.
- preserve or republish the installer only under a separately approved distribution lifecycle.
