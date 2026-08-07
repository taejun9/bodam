# plan-020-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-020-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-020-windows-hosted-acceptance` before commit
- baseline: main `30eb91fc0af3291fe393dbe2d61dee03d914f0b0`
- reviewer roles: independent installer identity, evidence/harness, privacy/lifecycle
- reviewed_at: 2026-08-07 KST

## QA Evidence

- hosted run `31150012396`, job `92777516401`, exact baseline SHA, main push attempt 1, `windows-2025`, conclusion failure
- hosted PASS boundary: dependencies; Vitest 83/366; Prisma/database; Windows default Rust 310/310; recursive PowerShell and junction safety; all-feature Rust 324/324; unsigned production NSIS build; silent install exit 0; installed directory, executable, uninstaller regular-path and x64 PE; unconditional cleanup and summary
- hosted FAIL boundary: raw source/installed executable hash equality; Tauri CLI 2.11.4 intentionally changes the first bundle marker from `UNK` to `NSS` for the NSIS payload and restores the source afterward
- hosted NOT RUN boundary: installed file allowlist and registry, launch, normal uninstall, app-data/shared-WebView preservation, private NSIS and installed E2E, upload and artifact acceptance; artifact API count 0
- local gates after each finding: focused Windows release mutations and repeated `npm run qa` PASS; frontend 83 files/366 tests, Rust 319 tests, Prisma/database, Vite, Tauri and full harness; dependency audit 0; `git diff --check` PASS

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| resolved P2 | key-substring checks did not prove actual installed hash capture/forwarding/assignment or patch-aware documentation | first evidence review | added exact semantic contracts, actual-source fixture and mutations for four evidence paths, two documents and immutable source pin; reran full QA |
| resolved P2 | initial semantic regex accepted comment decoys, suffix identifiers and duplicates | first post-finding code re-review | anchored active full lines, removed comments, required exactly one match and added comment/suffix/duplicate controls; reran full QA |
| none | No remaining P0–P3 code, evidence, privacy or lifecycle finding | three final independent re-reviews | approved |

## Requirements Trace

- 승인된 goal: baseline Windows run을 exact SHA로 대사하고 실패 원인을 최소 수정한 뒤 전체 QA와 독립 리뷰를 완료한다.
- 구현 증거: Tauri와 동일한 first-marker byte projection의 full SHA-256만 설치본 identity로 허용하고 actual installed hash를 uninstall 전에 증거화한다.
- 회귀 증거: positive/tamper payload test와 evidence/document/source-pin의 active exact-line mutation controls가 false positive와 provenance 회귀를 막는다.
- lifecycle: 실패 baseline의 skipped 영역을 PASS로 확대하지 않고 수정 commit의 actual Windows acceptance를 Plan-021에 인계한다.

## Privacy Review

- 고객 row, 연락처, 메모, credential, raw database/backup/export 또는 E2E artifact를 소스·문서에 추가하지 않았다.
- release evidence에는 두 SHA-256, bounded metadata와 상태만 기록하며 private runner path를 거부한다.
- mutation fixture는 allowlisted source/config/workflow/docs만 OS 임시 디렉터리에 복사하고 각 검사 후 자동 정리한다.

## Residual Risk

- 새 PowerShell projection, binding, Authenticode와 synthetic tamper control은 후속 exact `windows-2025` run 전까지 actual Windows에서 `NOT RUN`이다.
- production install/window/uninstall, app-data/shared-WebView preservation, private installed full E2E와 exact three-file artifact acceptance도 Plan-021 hosted success가 필요하다.
- WebView2 미설치 network-blocked clean VM, Authenticode trust, SmartScreen reputation과 public distribution은 승인 범위 밖이다.

## Follow-Ups

- Plan-021에서 이 완료 commit의 automatic main-push run을 exact SHA로 결속하고 모든 Windows step과 artifact 내부 값을 대사한다.
- 새 실패가 있으면 failure/NOT RUN 경계를 유지하고 별도 plan의 QA·독립 review lifecycle 뒤 다시 실행한다.
