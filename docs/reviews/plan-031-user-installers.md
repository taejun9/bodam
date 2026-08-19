# plan-031-user-installers Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-031-user-installers.md`
- reviewed tree: `codex/plan-031-user-installers` before commit
- baseline: main `2f1ffa25324f3f7ed26380da42154fc6a7c10e2d`
- reviewers: independent packaging/security review and QA evidence review
- reviewed_at: 2026-08-19 KST

## QA Evidence

- final and post-finding `npm run qa`: ESLint, vue-tsc, frontend 84 files/370 tests, Prisma registry/diff, Rust 319 tests, Vite production build, Tauri check and full harness PASS.
- Rust all-feature tests 335 PASS; fmt and all-target/all-feature Clippy with warnings denied PASS.
- `npm run package:macos`: Universal DMG build, `hdiutil verify`, read-only mount, exact root allowlist, Applications symlink, temporary copy, production identifier/version, arm64+x86_64 and strict ad-hoc signature PASS.
- `npm run test:e2e`: isolated release Tauri app and temporary SQLite write/restart/import/export/rollback/backup/settings/restore orchestrator PASS.
- package negative controls, Windows release mutation controls and isolated npm trust preflight PASS; wrong-host `package:windows` fail-fast PASS.
- `python3 harness/scripts/run_review.py` and `git diff --check`: PASS.

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P1 | Windows inspector treated the standard NSIS setup wrapper as an AMD64 executable and would reject Tauri's i386 PE32 installer stub | separated setup `0x014c` validation from actual BODAM application `0x8664` validation; added a negative control, refreshed immutable hashes and reran full QA |
| none | no remaining P0-P2 packaging, platform, privacy or test-contract finding | independent final review approved |

## Requirements Trace

- approved goal: expose separate macOS and Windows packaging shortcuts that produce installable artifacts for non-developers and verify the real sequence.
- implementation evidence: `package:macos` builds and inspects one Universal DMG; `package:windows` builds and inspects one current-user NSIS with offline WebView2; README separates builder and end-user steps.
- runtime evidence: final users receive only DMG/EXE and do not install Node, npm, Rust, Prisma or SQLite; actual app behavior passed isolated release-mode native E2E.
- non-goal compliance: no signing credentials, auto-update, stores, remote dependency, data-model or customer-data changes were added.

## Privacy Review

- actual data exposure: none; production macOS identifier was not launched because existing app-data is present, and functional execution used synthetic fixtures plus a temporary E2E database.
- prohibited fields: no resident identifier, insurer credential, sensitive medical history or detailed medical record was introduced.
- permissions/external communication: installer packaging adds no Tauri capability or runtime network access; npm registry and official tool downloads were build-time QA only.

## Residual Risk

- macOS is ad-hoc signed and not notarized; Windows is unsigned, so Gatekeeper or SmartScreen warnings remain possible for public downloads.
- exact Windows package/install/launch/uninstall and installed full E2E evidence requires plan-032 on `windows-2025` after this tree reaches main.
- Intel Mac execution, production-identifier launch in a disposable macOS account, and WebView2-absent network-blocked Windows VM are not verified.
- `npm audit --audit-level=high` reports 17 existing transitive Node build/test findings; no Node runtime or node_modules ships in the desktop installer, and dependency remediation remains a separate upgrade scope.

## Follow-Ups

- plan-032: bind Windows hosted package shortcut, production lifecycle, installed full E2E, cleanup and artifact evidence to the exact implementation main SHA.
- authorize separate credential work before claiming warning-free public distribution or notarized/signed installers.
- schedule a dependency-upgrade plan for the existing Node audit and WebdriverIO peer graph.
