# plan-036-installer-delivery Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-036-installer-delivery.md`
- installer source: main `d1e04735e1398541cee11804974c71c30c0e3a76`
- macOS artifact: locally built Universal DMG and Downloads copy
- Windows artifact: hosted run `33154066622`, job `98792558237`, artifact `9679469187` and Downloads copy
- reviewers: independent package/evidence, privacy/trust and plan lifecycle reviewers
- reviewed_at: 2026-09-01 KST

## QA Evidence

- `npm run package:macos`: PASS; exact-one DMG, read-only mount, root allowlist, Applications link, production identifier/version, arm64+x86_64 and strict ad-hoc signature inspection.
- macOS DMG: 11,310,387 bytes; SHA-256 `fffcfcff27eb6f882bffb3b62b028e0fbb667a45cb681a7a496f96e25cd481c1`; build output and Downloads copy byte-equal; `hdiutil verify` PASS.
- Windows hosted run: push/main, exact source SHA, completed/success; checkout, cross-layer QA, all-feature Rust, production package, install/launch/uninstall, installed full E2E, cleanup, evidence and upload including all 21 returned steps PASS.
- Windows artifact: one unexpired `bodam-windows-x64-unsigned` artifact with exact production EXE, checksum and sanitized evidence files.
- Windows EXE: 265,844,388 bytes; SHA-256 `485eaedb22f939aa28c474bf01f0cbbe31ecdadba6e047916dfd64ec17f390a5`; checksum/evidence/staging/Downloads copy exact match.
- Windows evidence: BODAM 0.1.0, `app.bodam.desktop`, x64 NSIS, current-user, offline WebView2, NotSigned, successful launch/install/uninstall and preserved app-data/shared WebView.
- Downloads: DMG, EXE, `INSTALL.txt`, `SHA256SUMS.txt` exact four regular files; both manifest checks PASS.
- completed plan/review tree `npm run qa`: PASS; Vitest 90 files/389 tests, Rust 321 tests, lint, typecheck, Prisma contracts, production build, Tauri check and full harness.
- `npm run test:e2e`: exit 0; isolated release native app passed persistence, Dashboard/Calendar, XLSX/CSV import/export/round-trip/rollback and backup/restore/exit orchestration.
- review prerequisites and staged diff check: PASS before independent review.

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P2 | final implementation checkbox combined completed-document creation with the post-commit Git lifecycle | limit the checkbox to completed plan/review creation and perform commit, merge, push and cleanup afterward |
| resolved P3 | Goal wording could imply that the exact four-file delivery contained only two files | distinguish the two installers from the accompanying guide and checksum manifest |
| none | no remaining P0–P3 package, provenance, privacy or trust finding | independent reviewers approved the installer and delivery evidence |

## Requirements Trace

- macOS install package: satisfied by the verified Universal `BODAM_0.1.0_universal.dmg`.
- Windows install package: satisfied by the verified x64 current-user `BODAM_0.1.0_x64-setup.exe` with offline WebView2.
- immediately available download: satisfied by the exact four-file Downloads delivery folder and installation guide.
- same current application source: satisfied by local HEAD/origin and Windows workflow head SHA binding to `d1e04735e1398541cee11804974c71c30c0e3a76`.
- usable application confidence: satisfied by macOS native E2E and hosted Windows installed full E2E plus installer lifecycle evidence.

## Privacy Review

- Final delivery contains no SQLite database, backup, E2E installer, import/export output, raw log, customer row or credential.
- The mounted production macOS bundle contains no runtime DB, backup, export, E2E marker or diagnostic log.
- Windows download acceptance used only production EXE, checksum and sanitized evidence; temporary staging remained private and is removed after review.
- No production app-data was opened or mutated during macOS verification; native E2E used a separate identifier and synthetic OS-temp runtime.

## Residual Risk

- macOS is ad-hoc signed and not Apple-notarized; Windows has no Authenticode signature. Gatekeeper or SmartScreen may require an explicit user confirmation.
- The same-folder checksum confirms byte integrity but does not authenticate the publisher.
- A WebView2-missing, network-disabled clean Windows VM and interactive wizard were not run. Hosted execution verifies the installed application but does not expand to that environment.
- Intel is present as a statically verified Universal slice but was not executed on physical Intel Mac hardware.

## Follow-Ups

- Add Apple Developer ID notarization and Windows Authenticode only when the user provides distribution identities and approves a signed public release workflow.
- Run a clean offline Windows VM interactive acceptance if that distribution environment becomes a requirement.
