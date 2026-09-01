# plan-036-installer-delivery

## Status

completed

## Owner

project_lead / quality_runner / privacy_guard

## User Request

현재 BODAM 앱을 macOS와 Windows에서 바로 설치해 사용할 수 있는 설치 파일로 패키징하고, 두 운영체제용 결과물을 사용자의 Downloads 폴더에 저장한다.

## Approval

- 요청일: 2026-09-01
- 승인일: 2026-09-01
- 승인 근거: 사용자가 macOS·Windows 설치 패키지 생성과 자신의 Downloads 폴더 저장을 명시적으로 요청했다.
- 승인 범위: 현재 `origin/main` exact source의 Universal macOS DMG와 Windows x64 current-user NSIS를 생성 또는 검증된 hosted artifact로 확보하고, checksum 및 짧은 설치 안내와 함께 사용자 Downloads의 전용 폴더에 복사한다.

## Goal

- 현재 `origin/main` source SHA를 macOS와 Windows 결과물 모두에 결속한다.
- macOS arm64/x86_64 Universal DMG를 로컬에서 새로 빌드하고 기존 inspector로 검증한다.
- Windows `windows-2025` workflow의 같은 source SHA successful non-PR artifact를 확인하고, exact allowlist와 SHA-256을 대사한다.
- 설치 실행 파일은 DMG와 EXE만 두고, 안내·checksum 두 파일을 Downloads 전용 폴더에 함께 저장한다.
- 산출물 checksum, source SHA, unsigned 상태와 설치 방법을 별도 안내 파일에 기록한다.

## Non-Goals

- Apple Developer ID 서명·notarization, Windows Authenticode·SmartScreen reputation
- auto-update, public release page, App Store·Microsoft Store, MSI·PKG
- 실제 고객 데이터 또는 기존 production app-data를 사용한 실행 검증
- WebView2 미설치·network-blocked Windows clean VM과 interactive installer wizard 수동 검증
- 앱 기능·도메인·UI 변경 또는 버전 번호 변경

## Constraints

- `codex/plan-036-installer-delivery`와 `.worktree/plan-036-installer-delivery`에서만 계획·증거 문서를 변경한다.
- installer source는 계획 문서 변경 전의 current `origin/main` SHA로 고정하고 두 OS 결과가 같은 source임을 확인한다.
- Windows artifact는 successful non-pull-request workflow의 production installer, checksum, sanitized evidence exact allowlist만 사용한다.
- Downloads에는 앱 installer와 배포 안내·checksum만 두며 runtime DB, backup, E2E installer, raw log를 복사하지 않는다.
- QA 완료 전 리뷰하지 않고 리뷰 완료 전 commit하지 않는다.

## Open Questions

- 없음. 현재 자격증명으로 서명·공증되지 않은 내부 배포본을 제공하고 OS 경고 가능성을 안내한다.

## Implementation Plan

- [x] current `origin/main` source SHA와 작업 환경을 고정하고 기존 package 계약을 사전 검사한다.
- [x] locked dependency 및 macOS Universal target을 확인한 뒤 `npm run package:macos`를 실행한다.
- [x] macOS DMG inspector 결과와 SHA-256·크기를 기록한다.
- [x] 같은 source SHA의 successful Windows workflow와 exact artifact를 찾아 내려받는다.
- [x] Windows artifact allowlist, installer checksum·크기와 sanitized evidence를 대사한다.
- [x] 두 installer, checksum manifest와 설치 안내를 Downloads 전용 폴더에 저장하고 최종 파일을 재검증한다.
- [x] QA 증거 기록 뒤 독립 리뷰를 수행한다.
- [x] plan을 completed로 이동하고 동일 번호 review mirror를 작성한다.

## QA Plan

- `npm ci --ignore-scripts` 또는 exact lockfile에 맞는 기존 dependency tree 검증
- package/harness targeted contract와 `npm run package:macos`
- `hdiutil verify`, DMG root allowlist, production identifier/version, Universal slices, ad-hoc signature inspector 결과 확인
- GitHub workflow repository/event/SHA/conclusion/job identity와 모든 required step success 확인
- downloaded artifact exact three-entry allowlist, ZIP/installer SHA-256, evidence schema·값 대사
- Downloads 최종 DMG/EXE regular-file·basename·byte size·SHA-256 재검증
- `npm run qa`, `python3 harness/scripts/run_review.py`, `git diff --check`

## Review Plan

QA 완료 뒤 source SHA 결속, 플랫폼·architecture, installer self-containment, artifact allowlist/checksum, Downloads 경계, 개인정보·runtime artifact 부재와 unsigned 주장 제한을 독립 검토한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-09-01 | installer source는 계획 문서 변경 전의 current `origin/main` SHA로 고정한다. | 두 OS 산출물이 사용자가 요청한 동일한 최신 앱 tree를 가리키고 계획 문서만의 후속 commit이 바이너리 차이를 만들지 않게 하기 위해서다. |
| 2026-09-01 | macOS는 로컬 새 Universal DMG, Windows는 exact-SHA hosted Windows artifact를 사용한다. | platform-native toolchain으로 실제 설치 파일을 만들고 macOS에서 Windows binary를 cross-build했다고 오인하지 않기 위해서다. |
| 2026-09-01 | 최종 파일은 사용자 Downloads 아래 별도 version 폴더에 둔다. | 기존 다운로드를 덮어쓰거나 다른 파일과 혼동하지 않고 installer와 무결성 정보를 함께 전달하기 위해서다. |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-09-01 | project_lead | 사용자 요청을 승인 근거로 plan-036을 만들고 installer delivery 범위를 고정했다. |
| 2026-09-01 | quality_runner | locked dependency 761개와 macOS arm64/x86_64 targets를 확인하고 Universal DMG를 새로 만들었다. 첫 sandbox 실행은 system DMG bundler 경계에서 중단됐고, 승인된 macOS packaging 권한으로 같은 명령을 재실행해 inspector까지 통과했다. |
| 2026-09-01 | quality_runner | exact main SHA의 hosted Windows run `33154066622`와 job `98792558237`의 21개 step success를 확인하고 accepted artifact `9679469187`을 내려받았다. |
| 2026-09-01 | privacy_guard | Windows artifact의 production EXE·checksum·sanitized evidence exact three-file allowlist와 hash/size/unsigned/current-user/offline WebView2 값을 대사했다. |
| 2026-09-01 | quality_runner | macOS·Windows installer와 안내·checksum을 Downloads 전용 폴더에 복사하고 exact four regular files, source copy equality, SHA-256과 DMG checksum을 재검증했다. |
| 2026-09-01 | quality_runner | 전체 QA와 격리된 release-mode macOS native E2E를 통과하고 plan status를 review로 전환했다. |
| 2026-09-01 | review_judge / privacy_guard | Downloads와 원본 artifact, DMG bundle, GitHub provenance를 독립 재검증하고 pass-with-residual-risk, 열린 P0–P3 finding 없음으로 승인했다. |
| 2026-09-01 | plan_keeper | finding 반영 뒤 completed plan 이동과 동일 번호 review mirror 작성을 진행했다. |
| 2026-09-01 | privacy_guard | 최종 Downloads checksum을 다시 확인하고 private OS-temp의 중복 Windows artifact와 delivery staging만 제거했다. |
| 2026-09-01 | quality_runner | completed plan/review tree에서 전체 QA, review prerequisites와 staged diff check를 재통과했다. |

## QA Evidence

- result: PASS — installer source는 current `origin/main` `d1e04735e1398541cee11804974c71c30c0e3a76`이며 macOS와 Windows가 같은 SHA에 결속된다.
- result: PASS — `npm ci --ignore-scripts`, 761 packages를 lockfile 기준으로 설치했다.
- result: PASS — `npm run package:macos`; production build 뒤 `BODAM_0.1.0_universal.dmg` 생성과 exact-one/root allowlist, `/Applications` link, `app.bodam.desktop`, version 0.1.0, arm64+x86_64, strict ad-hoc codesign, read-only mount/detach cleanup inspector를 통과했다.
- result: PASS — macOS DMG 11,310,387 bytes, SHA-256 `fffcfcff27eb6f882bffb3b62b028e0fbb667a45cb681a7a496f96e25cd481c1`; build output과 Downloads copy에서 `hdiutil verify` PASS.
- result: PASS — hosted Windows run `33154066622`, push/main, exact source SHA, `windows-2025`, job `98792558237`, 2026-08-28T08:07:05Z–08:31:01Z; checkout부터 QA, all-feature Rust, production NSIS, install lifecycle, private installed E2E, cleanup, evidence와 upload까지 21개 returned step 모두 success.
- result: PASS — artifact `9679469187`, `bodam-windows-x64-unsigned`, unexpired, exact three regular files; production EXE 265,844,388 bytes, SHA-256 `485eaedb22f939aa28c474bf01f0cbbe31ecdadba6e047916dfd64ec17f390a5`가 checksum과 evidence에 일치했다.
- result: PASS — Windows evidence는 BODAM 0.1.0, `app.bodam.desktop`, x64 NSIS, current-user, WebView2 offline installer, NotSigned, launch smoke, install/uninstall exit 0, app-data/shared WebView preservation을 기록한다.
- result: PASS — Downloads `/Users/taejungkim/Downloads/BODAM-0.1.0-installers`에 DMG, EXE, `INSTALL.txt`, `SHA256SUMS.txt` exact four regular files만 있고 staging과 byte-equal이며 두 checksum이 재통과했다.
- result: PASS — `npm run qa`; Vitest 90 files/389 tests, Rust default 321 tests, lint, typecheck, Prisma validation·registry·diff, production build, Tauri check, repository/application/privacy/package harness 전부 통과했다.
- result: PASS — `npm run test:e2e` exit 0; 격리된 `app.bodam.desktop.e2e`와 OS-temp synthetic runtime에서 native write/restart, Dashboard/Calendar, XLSX·CSV import/export/round-trip/rollback, Settings backup/restore/reauthorization/exit orchestration을 통과했다. 복원·종료형 WDIO child의 failed 표시는 앱 종료를 parent runner가 검증하는 기존 expected lifecycle이며 최종 orchestrator가 성공했다.
- result: PASS — final delivery에는 운영 DB, backup, E2E installer, raw log, 실제 고객 행과 credential이 없다.
- result: PASS — 독립 리뷰 뒤 private OS-temp staging 두 곳을 exact path와 no-symlink 경계로 확인해 제거했고 Downloads의 두 installer checksum은 계속 일치했다.
- result: PASS — completed plan/review tree `npm run qa`; Vitest 90 files/389 tests, Rust 321 tests, build, Tauri check와 full harness를 재통과했다.

## Review Findings

- verdict: `pass-with-residual-risk`; independent package/evidence와 privacy/trust reviewer 모두 열린 P0–P3 finding 없음으로 승인했다.
- resolved P2 — 마지막 implementation checkbox가 completed 문서 작성과 후속 Git lifecycle을 한 항목으로 묶어 순환적으로 읽혔다. checkbox 범위를 completed plan/review mirror 작성으로 한정하고 Git lifecycle은 그 뒤 repository 규칙대로 수행한다.
- resolved P3 — Goal의 “DMG와 EXE만”을 exact four-file delivery와 모순 없이 installer 두 개와 안내·checksum 두 개로 명확히 했다.
- artifact review: Downloads exact four regular files, byte equality, 두 SHA-256, DMG read-only/root/identifier/version/Universal/ad-hoc signature와 Windows PE/unsigned/evidence 값을 독립 재검증했다.
- provenance review: GitHub API에서 exact SHA의 push/main completed-success run, job과 returned 21 steps, single unexpired artifact를 독립 재조회했다.
- privacy review: final delivery와 app bundle에 DB, backup, E2E installer, export, raw log, 고객 데이터, credential이 없고 안내문의 source/unsigned 경계가 실제 상태와 일치한다.

## Completion Notes

- 완료 결과: current source `d1e04735e1398541cee11804974c71c30c0e3a76`의 macOS Universal DMG와 Windows x64 current-user NSIS를 `/Users/taejungkim/Downloads/BODAM-0.1.0-installers`에 설치 안내·checksum과 함께 저장했다.
- macOS: `BODAM_0.1.0_universal.dmg`, 11,310,387 bytes, SHA-256 `fffcfcff27eb6f882bffb3b62b028e0fbb667a45cb681a7a496f96e25cd481c1`.
- Windows: `BODAM_0.1.0_x64-setup.exe`, 265,844,388 bytes, SHA-256 `485eaedb22f939aa28c474bf01f0cbbe31ecdadba6e047916dfd64ec17f390a5`.
- 잔여 위험: macOS는 ad-hoc·미공증, Windows는 Authenticode 미서명이므로 Gatekeeper/SmartScreen 경고가 가능하다. 같은 폴더의 checksum은 전송 무결성만 확인하고 publisher identity를 인증하지 않는다.
- 잔여 위험: WebView2 미설치·network-blocked clean Windows VM의 interactive wizard, Intel Mac 실기 실행과 warning-free public distribution은 `NOT RUN` 또는 non-goal이다.
