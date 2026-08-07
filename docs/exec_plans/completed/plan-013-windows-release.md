# plan-013-windows-release

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-06
- 승인 근거: 사용자가 `/goal`로 전체 MVP 완성과 실제 실행 테스트를 지속 위임했고, plan-002 승인 프로필이 Windows x64 NSIS, WebView2 `offlineInstaller`와 GitHub Windows release-app E2E를 명시했다.
- 승인 범위: current-user x64 NSIS production/E2E installer harness, 설치된 실행 파일의 전체 합성 E2E, install/uninstall·registry/file evidence, production artifact 격리, Windows HANDLE/reparse backup 경계
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Code signing, public release channel과 WebView2가 없는 network-blocked clean VM의 offline wizard acceptance는 자격증명·외부 환경이 필요한 별도 범위다. Plan-013은 harness와 보안 경계를 구현·로컬 검토하고, main 반영 뒤 Plan-014에서 hosted Windows run을 실제 실행·관찰해 증거와 finding을 닫는다.

## Goal

- production Windows x64 NSIS가 명시적 current-user 설치와 WebView2 offline installer를 사용하도록 고정한다.
- production installer를 silent install한 뒤 `%LOCALAPPDATA%\BODAM\bodam.exe`, HKCU uninstall metadata, PE architecture와 file hash를 대사하고 실제 launch smoke를 수행한다. silent uninstall 뒤 install-owned 잔여 0과 user app-data 보존을 구분해 증명하는 harness를 만든다.
- 별도 `BODAM E2E` NSIS를 설치하고 source-tree binary가 아닌 설치된 실행 파일로 전체 WebDriver E2E를 수행한다.
- production installer·실행 파일·capability에 E2E feature/marker가 없고 E2E installer는 artifact로 외부 공개되지 않게 한다.
- Windows backup directory/archive/restore-source를 HANDLE file identity와 reparse-point 검사로 결속해 path-only TOCTOU fallback을 제거한다.
- hosted runner와 offline clean VM이 증명하는 범위를 문서·workflow summary에서 명확히 구분한다.

## Non-Goals

- Authenticode/code signing certificate, timestamping, SmartScreen reputation, public download/release, auto-update
- 실제 WebView2 미설치·network-disabled clean VM, interactive NSIS wizard screenshot, UAC/per-machine install
- MSI/WiX, Windows 7, x86/ARM64, Microsoft Store, macOS notarization
- WebView2 fixed runtime pinning, shared runtime 제거, system/user data purge
- 업무 UI·계산·schema 변경, 실제 고객 데이터 사용, 원격 telemetry/log upload

## Context Map

- `src-tauri/tauri.conf.json`, `tauri.e2e.conf.json`: production offline/current-user와 E2E identity/install mode
- `src-tauri/src/backup`: Windows directory/file HANDLE, reparse identity, final archive publish binding
- `e2e/build-e2e.mjs`, `run-e2e.mjs`, `run-backup-settings-e2e.mjs`, `wdio.conf.mjs`: NSIS build와 installed-binary exact path
- `e2e/windows-installer-*.ps1`: production/E2E artifact assertion, install/uninstall, evidence 생성
- `.github/workflows/tauri-e2e-windows.yml`: production installer gate 뒤 installed E2E를 직렬 실행
- quality/privacy/release docs와 harness: 증거 범위, artifact allowlist, 민감 log·marker·line-limit 검사

## Constraints

- `codex/plan-013-windows-release`와 `.worktree/plan-013-windows-release`에서만 구현·검증한다.
- 계획·승인 → 구현 → 로컬 QA → 독립 리뷰 → 완료 plan/review → commit·merge 순서를 지킨다.
- Windows 실제 hosted 실행은 main 반영 뒤 작은 Plan-014에서 run ID·commit·artifact hash와 실패 finding을 기록한다.
- source·workflow·PowerShell·문서는 300줄 전에 책임 단위로 분리한다.
- PowerShell은 exact resolved child path와 allowlist만 삭제하고 WebView2/shared registry/system directory를 제거하지 않는다.
- production과 E2E product identity, frontend, Cargo target, install directory, registry key와 artifact를 물리적으로 분리한다.
- production artifact만 제한 기간 upload하며 E2E installer·runtime DB·backup·WDIO raw log는 공개 artifact에서 제외한다.
- 로그·workflow summary에는 합성 count, basename, SHA-256, version, architecture와 pass/fail만 기록하고 전체 임시 path·row value를 남기지 않는다.

## Windows Installer Contract

- production target은 x64 NSIS 하나이며 `installMode: currentUser`, `webviewInstallMode: offlineInstaller`를 명시한다.
- current-user installer는 elevation 없이 `%LOCALAPPDATA%\BODAM`과 HKCU uninstall key만 사용한다.
- CI는 exact one production `*-setup.exe`, PE x64 실행 파일, product/version/icon, generated capability `core:default`, E2E marker 0과 SHA-256을 확인한다.
- silent install은 NSIS `/S /NS`, uninstall은 registered `UninstallString`의 app-owned executable에 `/S /NS`를 사용한다. exit code와 process 종료를 확인한다.
- installed `bodam.exe` SHA-256은 production build executable과 같아야 한다. install directory에는 allowlisted executable/uninstaller/resource만 허용한다.
- uninstall 뒤 install directory, HKCU uninstall key와 BODAM shortcut/process가 없어야 한다. 사용자 DB·app-data는 보존되어야 하며 shared WebView2 runtime과 타 application state는 검사만 하고 수정하지 않는다. ephemeral hosted runner의 합성 app-data cleanup은 uninstaller 결과 검증 뒤 별도 exact allowlist 단계로만 수행한다.
- production unsigned artifact는 installer, `.sha256`과 sanitized JSON/Markdown evidence만 upload한다. 서명된 배포본이라고 표시하지 않는다.

## Installed E2E Contract

- E2E config는 `BODAM E2E`, `app.bodam.desktop.e2e`, isolated Cargo target·frontend와 current-user NSIS를 사용하고 hosted runner의 기존 WebView2를 사용한다.
- E2E build는 exact one private NSIS를 만들고 `%LOCALAPPDATA%\BODAM E2E\bodam.exe`에 설치한다.
- Windows installed mode는 `BODAM_E2E_APP_BINARY_PATH`의 exact expected path만 허용하고 internal no-bundle build를 건너뛴다.
- `npm run test:e2e` 전체는 설치된 같은 binary로 Customer→restart, XLSX/CSV import/export/rollback과 backup→restore→restart→exit failure/changed/unchanged를 실행한다.
- 테스트 종료 뒤 E2E process, install directory, HKCU keys, shortcuts, synthetic runtime과 generated files가 없어야 한다.
- E2E installer·DB·backup·export·phase marker는 upload하지 않는다.

## Windows Filesystem Contract

- existing directory/file selection은 reparse point를 따라가지 않고 Windows HANDLE을 열어 final path와 volume/file identity를 보유한다.
- cached directory, archive temp/final과 restore source는 열린 HANDLE identity로 이름 재개방 객체를 대사한다.
- create/open/remove/replace 뒤 directory·file identity가 바뀌면 pathless safe error로 fail closed하며 성공을 기록하지 않는다.
- junction/symlink retarget, same-byte new-file swap, delete-pending/share-mode와 rename/replace behavior를 Windows test와 installed E2E에서 합성 경로로 검증한다.
- macOS/Linux FD-relative behavior와 Browser/production capability는 바뀌지 않는다.

## Implementation Plan

- [x] 승인된 Windows installer·hosted/offline evidence 경계를 product/quality/privacy/release 문서에 고정
- [x] production NSIS current-user/offline config와 exact artifact assertion script 구현
- [x] production silent install·registry/file/hash·uninstall/cleanup PowerShell lifecycle 구현
- [x] E2E NSIS build, installed-binary path guard와 build-skip runner mode 구현
- [x] hosted Windows workflow를 production gate → E2E install/full suite → cleanup/evidence 순서로 재구성
- [x] Windows directory/archive/restore-source HANDLE identity와 reparse fail-closed 구현
- [x] workflow/script/config/harness unit·negative controls와 cross-platform regression 추가
- [x] 전체 로컬 QA와 가능한 macOS actual E2E regression 실행
- [x] QA 뒤 independent Windows filesystem, installer/CI, privacy/artifact 리뷰와 finding 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- JSON/YAML/PowerShell/Node syntax와 exact config schema, workflow action pin/permissions/timeout/artifact allowlist 검사
- production/E2E identity·target·installer path negative controls, installed path escape·symlink/reparse·multiple artifact 거부
- production marker/capability/PE x64/hash/evidence schema와 E2E artifact upload 금지 검사
- Windows HANDLE identity, junction/symlink/same-byte swap/delete/share/rename tests와 non-Windows regression
- `npm run qa`, Rust default/all-features, fmt, all-targets/all-features Clippy `-D warnings`, audits, diff·300줄·sensitive scan
- normal source-tree macOS E2E runner가 installed-mode 변경 뒤에도 backup/settings actual flow를 통과하는지 확인
- Plan-014 hosted `windows-2025`: production NSIS build/install/hash/uninstall, E2E NSIS installed full suite, cleanup, artifact/evidence inspection

## Acceptance Scenarios

1. production config가 x64 NSIS current-user와 offline WebView2를 명시하고 MSI/per-machine elevation을 만들지 않는다.
2. production installer·binary가 exact identity/version/x64/icon/capability를 가지며 E2E marker는 0이다.
3. silent install 뒤 exact LocalAppData executable과 HKCU metadata가 있고 build executable hash가 같다.
4. production installed binary가 실제로 시작되고, silent uninstall 뒤 install-owned process/directory/uninstall-registry/shortcut 잔여는 0이며 user app-data와 shared WebView2는 보존된다.
5. private E2E NSIS의 설치된 exact binary가 전체 native 기능·restart·restore·exit E2E를 수행한다.
6. E2E binary 외 source-tree/production binary를 installed mode에서 사용하면 WDIO와 runner가 즉시 실패한다.
7. production installer+checksum+sanitized evidence만 artifact로 남고 E2E installer·합성 data/log 원문은 남지 않는다.
8. Windows junction/reparse와 file swap이 directory/archive/restore 성공으로 오인되지 않는다.
9. hosted pass와 offline clean-VM 미검증을 README·workflow summary·review가 구분한다.

## Review Plan

로컬 QA PASS 뒤 independent Windows filesystem reviewer, installer/CI reviewer와 privacy/artifact reviewer가 HANDLE/reparse, NSIS identity/install/uninstall, installed binary provenance, artifact allowlist, pathless evidence와 hosted/offline 주장 경계를 확인한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 SmartScreen reputation 운영 주체
- WebView2가 실제로 없는 network-blocked clean Windows 11 VM image와 수동 wizard evidence 보관 위치
- offline installer 크기와 조직 배포 방식, 향후 updater/channel 필요 여부

위 항목은 자격증명·외부 VM·배포 정책이 필요하므로 Plan-013에서 추측하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | NSIS `currentUser`를 default에 의존하지 않고 명시 | elevation 없이 LocalAppData/HKCU에 설치되는 계약 drift 방지 |
| 2026-08-07 | production offline installer와 E2E installed app을 별도 NSIS로 검증 | production feature 격리와 설치된 binary의 실제 기능을 모두 증명 |
| 2026-08-07 | E2E installer는 hosted WebView2를 사용하고 artifact upload 금지 | offline payload는 production에서 검증하고 test-only remote artifact 노출 방지 |
| 2026-08-07 | hosted execution evidence와 failure fixing은 Plan-014로 분리 | workflow 변경은 main 반영 후 실행되며 run 결과를 추측하지 않고 별도 lifecycle로 기록 |
| 2026-08-07 | Windows path-only fallback을 HANDLE identity로 교체 | junction/reparse와 name swap에서 검증한 객체와 실제 대상 결속 |
| 2026-08-07 | release staging을 `runtime-data/windows-release`로 변경 | upload-artifact가 dot-prefixed directory 내부 파일을 기본 제외하므로 exact allowlist를 비숨김 경로에 둠 |
| 2026-08-07 | Windows 선택 경로를 canonicalize 전에 HANDLE로 검증 | junction을 따라간 target이 사용자 승인 경로로 승격되는 것을 방지 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | plan-012를 `558d037`로 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-07 | repo_cartographer | 기존 Windows hosted E2E, NSIS/offline config, installed path와 Plan-012 Windows filesystem 잔여를 조사했다. |
| 2026-08-07 | plan_keeper | standing approval 범위로 plan-013 전용 branch/worktree와 installer/HANDLE 구현 계획을 만들었다. |
| 2026-08-07 | harness_builder | production/E2E NSIS lifecycle, exact installed-binary resolver, upload allowlist와 hosted cleanup을 구현했다. |
| 2026-08-07 | privacy_guard | Windows fixed-NTFS HANDLE relative operations, reparse rejection과 file identity 재대사를 구현했다. |
| 2026-08-07 | quality_runner | local QA, Windows MSVC cross-check와 actual macOS full E2E를 실행했다. |
| 2026-08-07 | review_judge | filesystem, installer/CI, privacy/artifact 독립 리뷰의 P1 2건·P2 5건·P3 1건을 해결했다. |
| 2026-08-07 | quality_runner | 수정 뒤 전체 QA, all-features·Clippy·Windows MSVC cross-check와 actual full app E2E를 다시 통과했다. |
| 2026-08-07 | doc_gardener | 세 영역 교차 재리뷰에서 신규 또는 미해결 P0–P3 0건을 확인하고 완료 plan/review를 기록했다. |

## QA Evidence

- result: PASS
- 최종 `npm run qa`: PASS — ESLint, vue-tsc, Vitest 83 files/366 tests, Prisma validate/diff, Rust default 319 tests, production build, Tauri check와 전체 harness.
- `cargo test --all-features`: PASS — 335 tests. `cargo fmt --check`와 all-target/all-feature Clippy `-D warnings`도 PASS.
- Windows MSVC full-crate cross type-check: PASS — `x86_64-pc-windows-msvc`, tests/all-features, `RUSTFLAGS=-Dwarnings`; Windows projection-only harness도 PASS.
- `npm audit --audit-level=high`: PASS — 0 vulnerabilities. `cargo audit`은 로컬에 subcommand가 없어 실행 불가했으며 lockfile compile/test와 hosted Windows build를 authoritative gate로 유지한다.
- 최종 `npm run test:e2e`: PASS, exit code 0 — sandbox 밖 실제 macOS app/WebKit 창에서 customer/policy/coverage/family/consultation/schedule, restart persistence, XLSX/CSV import/export/round-trip/rollback과 backup/restore/exit recovery 전체 실행. Restore/restart와 exit의 예상된 WebDriver 종료는 phase marker·DB·후속 process 대사가 맞을 때만 runner가 허용했다.
- `npm run test:e2e:backup-settings`: PASS, exit code 0 — manual backup, mutation, phased restart restore, startup verification, directory reauthorization, failed-exit recovery, changed-only exit backup과 unchanged idempotency를 독립 재검증했다.
- `git diff --check`, 300줄 검사, workflow YAML parse, Windows release mutation controls와 `run_review.py`: PASS. npm high vulnerability는 0건이다.
- 초기 통합 중 Vitest 달력 retry test가 자원 경합 상태에서 1회 실패했으나 단독 재실행과 이후 전체 suite는 반복 PASS했다. 제품 변경·재현 가능한 회귀는 관찰되지 않았다.
- PowerShell parser와 native NSIS lifecycle, Windows-only HANDLE tests는 macOS에서 실행하지 못했다. Plan-014 `windows-2025` actual run이 최종 실행 증거다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P1 | HKCU uninstall key를 32/64 view에서 중복 logical record로 조회 | shared HKCU는 Registry64 한 번, redirected HKLM은 Registry32·64를 각각 검사 |
| P1 | Windows identity-swap test가 열린 delete-pending 이름을 재사용 | 원본을 held sibling으로 HANDLE-relative rename한 뒤 원래 이름에 clone을 만들고 sibling을 명시 정리 |
| P2 | shared WebView2 보존을 실제 registry state로 증명하지 않음 | 공식 GUID의 post-install HKCU/HKLM nonzero `pv`를 snapshot하고 uninstall·cleanup 뒤 exact-equal일 때만 evidence 생성 |
| P2 | recursive cleanup이 nested junction을 사전 거부하지 않음 | 전체 descendant를 반복 검사하고 nested reparse를 삭제 전에 거부하며 외부 sentinel 음성 대조군 추가 |
| P2 | workflow action이 mutable tag를 사용 | 조회·검증한 5개 action full commit SHA와 tag 설명 comment로 고정 |
| P2 | HANDLE-relative rename 뒤 file buffer flush가 없음 | 같은 writable source HANDLE에 `FlushFileBuffers`를 호출하고 실패를 전파 |
| P2 | Windows 예약 이름에서 COM/LPT superscript ¹²³ 누락 | ASCII 1–9와 ¹²³, 대소문자·확장자 변형 회귀 검사 추가 |
| P3 | always summary가 실패해도 full E2E 완료처럼 보일 수 있음 | `job.status`와 8개 검증 step outcome을 개별 기록하고 full E2E는 scope로만 표시 |

수정 뒤 PowerShell installer/cleanup, workflow/artifact, Rust HANDLE 세 교차 재리뷰에서 신규 또는 미해결 P0–P3 finding은 0건이었다.

## Completion Notes

- Production Windows x64 current-user NSIS는 WebView2 offline installer, unsigned 상태와 exact 3-file artifact allowlist를 명시한다.
- 별도 private E2E NSIS는 설치된 exact LocalAppData executable로 전체 합성 기능을 실행하고 installer·DB·backup·raw log를 upload하지 않는다.
- Windows local fixed NTFS backup 경로는 HANDLE-relative open/rename/delete, reparse rejection과 file identity 재대사를 사용한다.
- 로컬 전체 QA와 실제 macOS 화면·기능 회귀는 통과했다. 실제 Windows NSIS/WebView2/NTFS/PowerShell 증거는 main push 뒤 Plan-014 hosted run에서 확정한다.
- Authenticode, SmartScreen과 WebView2 미설치·network-disabled clean VM은 외부 자격증명·환경이 없어 별도 `NOT RUN` 경계로 유지한다.
