# plan-013-windows-release Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-013-windows-release.md`
- reviewed tree: `codex/plan-013-windows-release` worktree before commit
- baseline: main `558d037`
- reviewer roles: independent Windows filesystem, installer/CI and privacy/artifact
- review order: local QA, three independent reviews, eight finding fixes, full QA and actual app rerun, three cross re-reviews
- reviewed_at: 2026-08-07 KST

## QA Evidence

- `npm run qa`: ESLint, Vue typecheck, Vitest 83 files/366 tests, Prisma registry/hash/diff, Rust default 319 tests, production web build, Tauri check and harness PASS
- Rust: all-features 335/335, fmt, all-targets/all-features Clippy `-D warnings`, Windows MSVC tests/all-features cross-check and diff-check PASS
- dependencies: `npm audit --audit-level=high` vulnerability 0; local Cargo audit subcommand unavailable
- actual `BODAM E2E.app`: full native UI/function E2E exit 0 after the final fixes
- feature evidence: Customer, Policy, Coverage, Benchmark, Family, Consultation, Dashboard, Schedule/Calendar, restart, XLSX/CSV import/export/round-trip/rollback PASS
- backup evidence: manual backup, mutation, restore/restart, startup verification, directory reauthorization, failed-exit recovery, changed exit and unchanged idempotency PASS
- Windows contracts: action SHA pins, config, script/evidence keys, status summary, exact artifact allowlist, hidden-path rejection and offline-claim mutation controls PASS
- review harness, workflow YAML parse, 300-line and sensitive-artifact checks PASS

## Findings

| severity | finding | resolution |
|---|---|---|
| P1 | HKCU uninstall shared view was counted twice | query HKCU once and check both redirected HKLM views |
| P1 | Windows identity-swap test reused a delete-pending name | rename the held original, clone at the original name and explicitly clean the sibling |
| P2 | shared WebView2 preservation was asserted without a registry snapshot | exact post-install GUID/view/`pv` comparisons after uninstall and cleanup gate evidence |
| P2 | cleanup checked only the root for reparse points | scan all descendants and run a real junction/external-sentinel negative control |
| P2 | workflow actions used mutable tags | pin five verified full commit SHAs with human-readable tag comments |
| P2 | HANDLE-relative rename did not flush the same file handle | call and propagate `FlushFileBuffers` after successful rename |
| P2 | COM/LPT superscript device-name aliases were missing | reject and test ASCII 1–9 plus ¹²³ aliases |
| P3 | always-summary could imply success after an earlier failure | report job status and all eight verification-step outcomes |

All three cross re-reviews reported zero unresolved or new P0–P3 findings.

## Requirements Trace

- Installer: x64 NSIS, current-user LocalAppData/HKCU scope, production offline WebView2 and explicit unsigned boundary
- Production lifecycle: exact installer/binary/hash/PE/registry/launch, uninstall-owned residue 0 and user/shared-runtime preservation
- Installed E2E: isolated product/identifier/target, exact installed executable and complete synthetic native suite
- Filesystem: local fixed NTFS HANDLE-relative operations, no-follow reparse checks, file identity and name-swap rejection
- CI/artifact: immutable actions, failure-aware summary and successful non-PR exact three-file upload only
- Privacy: no real rows, full private paths, E2E database/backup/export/raw logs or credentials in evidence/artifacts

## Privacy Review

- Production and E2E identifiers, install roots, features and artifact paths remain physically separated.
- Evidence contains only bounded product metadata, hashes, sizes, exit codes and booleans; it excludes full runner paths and business row values.
- Recursive cleanup accepts exact direct children only, rejects root or nested reparse points and preserves an external sentinel in the native negative control.
- Shared WebView2 state is read and compared but never removed. Synthetic app data cleanup occurs only after uninstall preservation checks.

## Residual Risk

- Native PowerShell parsing, WOW64 registry views, NSIS install/uninstall, WebView2 state and NTFS HANDLE/junction tests were not executable on the macOS host; Plan-014 hosted `windows-2025` is required.
- The hosted test will not prove a WebView2-missing, network-disabled clean VM, interactive wizard/UAC or consumer hardware.
- The installer is unsigned. Authenticode certificate, timestamping, SmartScreen reputation and public distribution trust are absent.
- Windows flush evidence is limited to the renamed file HANDLE; no parent-directory or power-loss durability guarantee is claimed.
- Backup and database files remain plaintext and depend on OS-account and disk protection.

## Follow-Ups

- Plan-014 records the exact main commit, hosted run URL/ID, step outcomes, release evidence and artifact SHA-256, fixing any Windows-only failure through the full lifecycle.
- A separate authorized clean Windows VM and signing credentials are required before claiming offline bootstrap or signed public distribution readiness.
