# plan-012-backup-settings Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-012-backup-settings.md`
- reviewed tree: `codex/plan-012-backup-settings` worktree before commit
- baseline: main `f5f010c`
- reviewer roles: independent data/lifecycle, UI/accessibility, privacy/capability
- review order: full QA, read-only review, seven finding fixes, targeted/full QA and actual app rerun, three independent final re-reviews
- reviewed_at: 2026-08-07 KST

## QA Evidence

- `npm run qa`: ESLint, typecheck, Vitest 83 files/366 tests, Prisma registry/hash/diff, Rust default 318 tests, production web build, Tauri check and harness PASS
- Rust: backup 107/107, all-features 334/334, fmt, all-targets/all-features Clippy `-D warnings` and diff-check PASS
- dependencies: npm vulnerability 0; audited Cargo lock had blocking vulnerability 0 and 17 allowed transitive GTK/Tauri ecosystem warnings
- actual `BODAM E2E.app`: dedicated backup/settings and complete native E2E both exit 0
- backup evidence: independent ZIP entries/manifest/size/SHA-256/schema verification, source logical immutability, process-abort residue 0, exact all-table restore digest
- lifecycle evidence: daily idempotence, changed exit automatic/exit +1, unchanged exit +0, real unavailable custom directory dialog/retry/pathless warning/bypass with archive +0
- complete feature evidence: Customer, Policy, Coverage, Benchmark, Family, Consultation, Dashboard, Schedule/Calendar and XLSX/CSV import/export/restart/rollback PASS
- actual Browser: 1280×720 and 390×844, light/dark, valid/invalid settings, Dashboard application, focus/keyboard/overflow and console error 0
- production: `BODAM.app` and DMG build PASS; identifier `app.bodam.desktop`, version 0.1.0, icon, exact `core:default`, E2E markers 0
- DMG: 5,776,249 bytes, SHA-256 `5aa2264d7882b850267162c78727c1e2c9f8f87cab2e938bb677399477730598`, `hdiutil verify` VALID and read-only mount contained `BODAM.app` plus `/Applications` link

## Findings

| severity | finding | resolution |
|---|---|---|
| P1 | invalid current DB was not recovered from valid safety when candidate preparation failed | revalidate current and marker-bound safety, rollback invalid current, retain marker on invalid safety |
| P1 | nested `.bodam-backup` artifacts could escape the root-only ignore rule | global ignore, repository-wide scanner and nested negative controls |
| P2 | verified temp archive was not object-bound to the published final archive | Unix open-handle device/inode checks before/after publish plus strict final revalidation and reopen identity |
| P2 | interrupted state/write-probe temporary files were not all swept | exact v4 state and both write-probe names swept in startup/default/active custom capability paths with fail-closed cleanup |
| P2 | changed-exit E2E allowed either zero or one automatic artifact | exact automatic +1 and exit +1, followed by exact unchanged +0 |
| P2 | real exit-backup failure dialog path was not exercised | actual custom-directory loss, native close, focus, retry alert, path redaction and warned exit scenario |
| P3 | manifest local date accepted noncanonical widths | parse and exact `%Y-%m-%d` round-trip validation with regression cases |

All three final independent re-reviews reported zero unresolved or new P0–P3 findings.

## Requirements Trace

- Settings: SQLite canonical theme, recent/unconsulted ranges, card limit and pathless default/custom backup location
- Backup: SQLite online snapshot, strict two-entry ZIP, canonical manifest, checksum/schema/integrity validation and 30 automatic retention
- Triggers: serialized daily/resume/date checks, manual creation and changed-only exit with blocking failure recovery UX
- Restore: native pathless selection, preview/cancel, pre-restore safety, durable marker, startup working migration, verified atomic install or rollback
- UI: responsive settings/backup panels, plaintext/same-disk warning, busy/error/result state, dialog focus and non-dismissible failed-exit gate
- Privacy/capability: no customer values or full paths in IPC/log evidence, no broad fs/shell/process/network permission, global backup artifact gate
- Verification: actual Browser and release-mode Tauri processes with synthetic isolated DB/files only

## Privacy Review

- No real customer database, backup, row value, attachment or private path was copied into source, fixtures, logs, screenshots or docs.
- Native paths stay behind dialog/backend boundaries; IPC returns only safe codes, kind, basename, bounded manifest metadata and opaque tokens.
- Backup files are explicitly described as unencrypted sensitive artifacts, excluded globally from Git and scanned repository-wide.
- Cleanup targets exact generated names and regular files; matching symlinks, directories, malformed names and delete/sync failures fail closed.

## Residual Risk

- Backup artifacts are plaintext and may share the same disk; encryption, app lock, key management and remote/off-site backup are not implemented.
- Removable/network filesystem atomicity and hostile concurrent filesystem mutation remain platform/filesystem dependent.
- Windows archive/directory/source identity is still path-based rather than HANDLE-relative; reparse-point/NTFS acceptance is Plan-013 scope.
- The macOS app has only a linker ad-hoc signature. Full app resource sealing, Apple Developer ID signing and notarization are absent, so strict bundle signature verification fails and the DMG is not a signed distribution release.
- Allowed transitive GTK/Tauri advisories and the production chunk-size warning remain tracked maintenance/performance risks.

## Follow-Ups

- Plan-013 implements Windows current-user NSIS packaging, installed-binary E2E, install/uninstall and registry/file evidence, plus Windows HANDLE/reparse protections.
- Distribution credentials and an offline clean-VM acceptance environment are required before claiming signed public macOS/Windows distribution.
