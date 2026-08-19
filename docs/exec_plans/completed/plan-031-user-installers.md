# plan-031-user-installers

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

개발 지식이 없는 사용자도 macOS와 Windows에서 설치 파일을 더블클릭해 필요한 런타임과 앱을 설치하고 바로 사용할 수 있도록 운영체제별 패키징 단축키를 `package.json`에 추가하고, 실제 순서대로 패키징·설치·실행을 검증한다.

## Approval

- 요청일: 2026-08-19
- 승인일: 2026-08-19
- 승인 근거: 사용자가 macOS·Windows를 나눈 원클릭 설치 패키징 구현과 실제 설치 순서 및 앱 동작 테스트까지 명시적으로 요청했다.
- 승인 범위: 사용자용 macOS DMG와 Windows x64 current-user NSIS 패키징 명령, 플랫폼/산출물 사전검사, 설치 안내, macOS 실제 빌드·설치·실행 검증, Windows hosted 빌드·설치·실행 검증

## Goal

- 루트 `package.json`에서 macOS와 Windows 설치 파일을 만드는 명확한 단축키를 각각 제공한다.
- macOS 산출물은 DMG 안의 self-contained BODAM 앱으로, Windows 산출물은 WebView2 offline installer를 포함한 current-user NSIS로 고정한다.
- 잘못된 운영체제에서 명령을 실행하거나 산출물이 없거나 여러 개이면 이해 가능한 오류로 즉시 실패한다.
- 개발 의존성 설치부터 패키징, 설치, 최초 실행까지 문서와 실제 자동화 명령이 일치한다.
- macOS는 이 worktree에서 실제 DMG 생성·read-only mount·임시 설치 복사·bundle/Universal/signature 검사를 수행하고, 별도 E2E identity와 임시 SQLite로 앱 실행·전체 기능·종료를 검증한다.
- Windows는 plan-031 반영 뒤 후속 plan-032에서 `windows-2025` hosted runner의 NSIS 생성·설치·실행·전체 합성 E2E·제거 증거를 exact main SHA에 결속한다.

## Non-Goals

- Apple Developer ID 서명·notarization, Windows Authenticode·SmartScreen reputation, 인증서 발급
- auto-update, public release/download page, Microsoft Store, Mac App Store, MSI/PKG
- Intel macOS 실기 실행, Windows ARM64/x86 cross-build
- 설치 과정에서 사용자 업무 데이터 생성·이전·삭제
- WebView2가 전혀 없는 network-blocked clean Windows VM의 interactive wizard/UAC 검증
- 기존 production app-data가 있는 현재 macOS 계정에서 exact production identifier 앱 실행

## Context Map

- `package.json`: 사용자용 운영체제별 패키징과 검증 단축키
- `scripts/package/`: 플랫폼 preflight와 설치 산출물 계약 검사
- `src-tauri/tauri.conf.json`: 공통 bundle, macOS DMG, Windows NSIS/WebView2 계약
- `e2e/`: 실제 native app 및 Windows installed application 검증
- `README.md`: 개발자가 설치 파일을 만드는 순서와 비개발 사용자의 설치 순서
- `harness/scripts/`: package script·bundle config·문서 정합성 검사
- `.github/workflows/tauri-e2e-windows.yml`: Windows 실제 NSIS 설치·실행 증거

## Constraints

- `codex/plan-031-user-installers`와 `.worktree/plan-031-user-installers`에서만 구현·검증한다.
- QA와 리뷰를 분리하고 QA 통과 전 리뷰하지 않는다.
- 범위 변경은 Decision Log에 기록한다.
- 개인정보와 실제 고객 데이터를 fixture, log, screenshot, installer에 넣지 않는다.
- package 명령은 개발 도구를 최종 사용자 PC에 설치하지 않는다. Node/npm/Rust는 패키지를 만드는 PC에만 필요하고 최종 앱에는 포함하지 않는다.
- platform-native installer는 해당 운영체제에서만 생성·실행하며 macOS에서 Windows 결과를 추측해 통과 처리하지 않는다.

## Open Questions

- 없음. 서명/notarization과 public distribution은 자격증명이 필요한 Non-Goal로 명시하고 unsigned 내부 배포물의 제한을 문서화한다.

## Implementation Plan

- [x] 운영체제별 사용자 패키징 명령과 공통 검증 명령을 `package.json`에 추가
- [x] 플랫폼 preflight와 exact-one DMG/NSIS 산출물 검증 스크립트 구현
- [x] macOS DMG와 Windows NSIS/WebView2 bundle 계약을 config·자동 검사로 고정
- [x] README에 패키지 제작자와 비개발 최종 사용자의 macOS·Windows 순서를 분리해 기록
- [x] harness unit/contract 검사를 추가하고 300줄·privacy·architecture gate와 연결
- [x] macOS 실제 DMG 빌드·read-only mount·설치 복사·정적 bundle 검사 및 격리된 전체 native E2E 수행
- [x] main 반영 뒤 Windows hosted 증거를 관찰할 후속 plan-032 범위 고정
- [x] QA 뒤 독립 리뷰, finding 해결, completed plan/review mirror 작성

## QA Plan

- `npm ci --ignore-scripts`로 lockfile 기반 제작 의존성 재현
- package command/config/artifact 검사 unit 및 negative control
- `npm run qa`, Rust test/fmt/clippy와 audit, repository harness
- `npm run package:macos`로 release DMG 생성 후 exact 산출물·bundle executable·identifier 검사
- DMG를 read-only mount하고 임시 Applications 대체 경로에 `.app`을 복사한 뒤 identifier·version·Universal slice·ad-hoc signature 검사
- `npm run test:e2e`로 release-mode Tauri 앱의 전체 합성 기능·지속성 확인
- plan-032에서 main-push Windows workflow의 `npm run package:windows`, production lifecycle, installed full E2E와 cleanup 결과 확인

## Review Plan

QA 통과 후 package UX·플랫폼 경계, installer/runtime self-containment, artifact ambiguity, 서명 주장 제한, 개인정보·권한 변화, 문서/명령 정합성을 독립적으로 리뷰한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-19 | macOS는 Tauri DMG, Windows는 기존 current-user NSIS를 사용자 설치 산출물로 사용한다. | 현재 Tauri 2 구조와 OS 기본 설치 경험을 유지하고 최종 사용자에게 Node/npm/Rust 설치를 요구하지 않기 위해서다. |
| 2026-08-19 | 서명되지 않은 내부 검증 산출물과 공용 배포 준비 상태를 구분한다. | Apple/Windows 서명 자격증명 없이 Gatekeeper·SmartScreen 신뢰를 보장할 수 없기 때문이다. |
| 2026-08-19 | macOS DMG는 arm64와 x86_64를 함께 담은 Universal binary로 만든다. | CPU 종류를 모르는 비개발 사용자에게 한 개의 macOS 설치 파일을 전달하기 위해서다. 현재 arm64 host에서는 두 slice를 정적으로 검사하고 arm64 실행만 검증한다. |
| 2026-08-19 | production DMG는 실행하지 않고 read-only mount/copy/정적 검사하며 실제 동작은 별도 E2E identity로 검증한다. | 현재 계정에 기존 production app-data가 있어 실행 시 migration·daily backup·WebKit 상태를 변경할 수 있고, HOME 재지정은 허용되지 않기 때문이다. |
| 2026-08-19 | exact main SHA의 Windows hosted 결과는 merge/push 뒤 plan-032에서 기록한다. | QA→review→completed plan/review→commit→merge/push Git Gate와 commit/ref가 필요한 hosted 실행 순서를 모두 지키기 위해서다. |
| 2026-08-19 | Windows package inspector는 NSIS PE32 wrapper와 실제 x64 BODAM 실행 파일을 분리 검사한다. | Tauri가 고정한 NSIS 3.11 setup stub은 i386 PE32이고 설치 대상 앱만 AMD64이므로 둘을 같은 machine type으로 가정하면 정상 installer를 거부하기 때문이다. |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-19 | plan_keeper | 사용자 요청을 승인 근거로 plan-031을 만들고 구현을 시작했다. |
| 2026-08-19 | harness_builder | 운영체제 가드, Universal DMG·PE/NSIS 검사, contract negative control과 Windows npm trust 결속을 구현했다. |
| 2026-08-19 | quality_runner | 전체 QA와 격리된 native E2E, 최신 코드의 Universal DMG 실제 생성·read-only 검사를 통과시켰다. |
| 2026-08-19 | plan_keeper | QA 증거를 고정하고 상태를 review로 전환했다. |
| 2026-08-19 | review_judge | NSIS wrapper를 AMD64로 오인한 P1 finding을 제기했다. |
| 2026-08-19 | harness_builder | NSIS wrapper i386와 실제 앱 AMD64 검사를 분리하고 negative control 및 immutable hash chain을 갱신했다. |
| 2026-08-19 | quality_runner | finding 수정 뒤 targeted controls와 전체 `npm run qa`를 재통과시켰다. |
| 2026-08-19 | review_judge | 독립 재리뷰에서 열린 blocker 없음으로 승인했다. |

## QA Evidence

- result: PASS — plan-031 current-tree local/macOS package contract, release DMG, isolated native E2E, full QA와 Windows npm trust preflight
- `npm ci --ignore-scripts`: PASS, lockfile 기준 761 packages 재현
- `npm run qa`: PASS
  - ESLint/typecheck/Prisma validate 및 migration diff PASS
  - Vitest 84 files, 370 tests PASS
  - Rust default tests 319 PASS
  - production Vue build, Tauri check, repository/application/privacy/line-limit harness PASS
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`: PASS
- `cargo test --manifest-path src-tauri/Cargo.toml --all-features`: 335 PASS
- `python3 -I harness/scripts/windows_npm_preflight.py`: PASS
- `python3 harness/scripts/test_windows_release_contract.py`: PASS, mutation controls 포함
- `git diff --check`: PASS
- `npm run package:windows` on macOS: expected fail-fast PASS, Windows build 시작 전 플랫폼 오류 확인
- `npm run package:macos`: PASS
  - output: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/BODAM_0.1.0_universal.dmg`
  - SHA-256: `a593932e9a6f1fd1e8ef2a9193bccd3f0358999dc2de182b469190e4a8a8cb8b`
  - size: 11,297,986 bytes
  - `hdiutil verify`, read-only mount, exact root allowlist, `/Applications` symlink, 임시 복사, identifier/version, arm64+x86_64, strict ad-hoc codesign, detach/cleanup PASS
- `npm run test:e2e`: PASS, 별도 `app.bodam.desktop.e2e` identity와 임시 SQLite에서 release native write/restart/import/export/rollback/backup/settings/restore 시나리오 완료
- post-review-fix `npm run qa`: PASS, frontend 84 files/370 tests, Rust 319 tests, Prisma/build/Tauri/full harness
- post-review-fix package installer checks/negative controls, Windows npm preflight, Windows release mutation controls와 ESLint: PASS
- official Tauri NSIS 3.11 `lzma_solid-x86-unicode` stub inspection: PE32 Intel 80386 확인; inspector는 setup `0x014c`, actual app `0x8664`를 각각 고정
- `python3 harness/scripts/run_review.py`: PASS
- `npm audit --audit-level=high`: non-zero, 기존 Node build/test dependency graph의 transitive high 17건
  - 배포 앱에는 Node runtime/node_modules가 포함되지 않고 BODAM 소스에서 취약 API를 직접 사용하지 않는다.
  - non-forced audit fix dry-run은 기존 WebdriverIO peer dependency 충돌로 `ERESOLVE`; 패키징 범위를 넘어선 dependency upgrade는 잔여 위험으로 분리한다.
- exact production macOS app launch: NOT RUN, 현재 계정의 기존 production app-data 보호를 위해 정적 DMG 검사와 격리 E2E로 대체
- exact Windows installer lifecycle: plan-032에서 main SHA 기준 hosted `windows-2025` 증거로 수행

## Review Findings

- resolved P1: 최초 Windows inspector가 NSIS setup wrapper 자체를 AMD64로 요구해 정상 Tauri installer를 거부할 수 있었다.
- resolution: setup wrapper의 i386 `0x014c`와 실제 `target/release/bodam.exe`의 AMD64 `0x8664`를 분리 검사하고 negative control·Windows immutable trust hashes를 갱신했다.
- final verdict: pass-with-residual-risk, 독립 재리뷰에서 열린 P0-P2 finding 없음

## Completion Notes

- 완료 결과: `package:macos`와 `package:windows`가 플랫폼 guard, self-contained installer build와 exact artifact inspection을 한 명령으로 제공한다. macOS Universal DMG 실제 생성·검사와 격리된 full native E2E를 완료했다.
- 잔여 위험: macOS는 ad-hoc·미공증, Windows는 unsigned이고 Node build/test dependency audit high 17건이 남는다. Intel Mac 실기, production identifier Mac 실행, WebView2 미설치 network-blocked Windows VM은 검증하지 않았다.
- 후속 계획: plan-031 merge/push 뒤 plan-032에서 exact main SHA의 Windows package shortcut, production install/launch/uninstall, installed full E2E와 artifact 증거를 기록한다.
