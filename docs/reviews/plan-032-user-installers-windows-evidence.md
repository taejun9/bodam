# plan-032-user-installers-windows-evidence Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-032-user-installers-windows-evidence.md`
- reviewed tree: `codex/plan-032-user-installers-windows-evidence` before commit
- implementation baseline: main `289709f4e05d137f53d3721e723300c667eeeeb0`
- authoritative run: `32219085193`, attempt 1, job `95966064908`
- reviewers: independent run/evidence and artifact/privacy
- reviewed_at: 2026-08-19 KST

## QA Evidence

- [authoritative run 32219085193](https://github.com/taejun9/bodam/actions/runs/32219085193):
  exact main push, `windows-2025`, every build/test/lifecycle/cleanup/upload and post-step succeeded.
- `npm run package:windows` ran preflight, production NSIS build and inspector; the inspector
  verified the 219744882-byte setup, x64 app executable and offline WebView2 contract.
- production lifecycle installed and launched the exact executable, confirmed readiness, local DB
  and daily backup, closed normally, uninstalled and preserved app-data/shared WebView2.
- installed E2E passed Customer write 6/6, persistence 4/4, XLSX/CSV import, persistence, export,
  round-trip, rollback and backup phases. Four reporter failures are controlled app-exit sessions;
  the successful parent verified phase markers, logical snapshots, residue and cleanup.
- artifact exact one: ID `9354058079`, 219746364-byte ZIP, SHA-256
  `0475f3ff0925db0ec3e5b09fdc56044abe16c8efd6dcfa4cf6dd18173a6d43c2`, exact run/SHA binding.
- two read-only consumers verified three root regular unencrypted entries, CRC, the exact checksum,
  219744882-byte installer SHA-256 `70e0db1b08ed6a8deff7694e9ef3fe220b9cced1abbdc7918a06f0253e1e9265`
  and strict 24-key evidence without extracting or executing the installer.
- exact evidence values bind unsigned x64 NSIS, current-user install, offline WebView2, launch and
  preservation success, zero install/uninstall exits, hosted runner and `offlineVmAccepted: false`.
- local and final evidence-tree `npm run qa`: frontend 84 files/370 tests, Rust default 319,
  Vite build, Tauri check and full harness PASS.

## Findings

| severity | finding | resolution |
|---|---|---|
| none | No P0–P3 run, package, installed-E2E, artifact, privacy or evidence finding | both independent reviewers approved |

## Requirements Trace

- the friendly Windows shortcut was executed on Windows and produced the expected current-user
  offline NSIS rather than only passing a static package.json check.
- actual production installation and launch plus the installed private full feature suite prove the
  packaged app works across native, persistence, restart, exchange, rollback and backup paths.
- artifact metadata, bytes, checksum, evidence schema, retention and cleanup are bound to the exact
  reviewed implementation SHA.
- hosted success remains distinct from warning-free public distribution and clean offline-VM proof.

## Privacy Review

- no customer row, credential, raw DB/backup/export, raw runner log, full runner path, installer
  bytes or private temporary path was copied into the repository.
- both artifact checks used private temporary directories, did not extract or execute the installer,
  and removed ZIP/log trees after bounded inspection.
- repository `runtime-data`, `.runtime` and Windows installer output are absent.

## Residual Risk

- the installer is `NotSigned`; Unknown Publisher or SmartScreen warnings remain possible and this
  evidence does not authorize a public release.
- an interactive double-click wizard and a WebView2-absent network-blocked clean Windows VM remain
  `NOT RUN`; the hosted run proves install/launch/functionality on `windows-2025` only.
- the private artifact expires at 2026-08-26T05:58:40Z and is evidence, not a durable release channel.
- a pinned GitHub Action emitted a Node 20→24 execution deprecation warning; no app test failed.

## Follow-Ups

- obtain Authenticode credentials and a clean Windows 11 offline VM only under a separately approved
  signed/public distribution plan.
- rebuild or publish through an approved release lifecycle after the evidence artifact expires.
