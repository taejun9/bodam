# plan-021-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-020이 Tauri NSIS payload identity 수정 main commit의 hosted acceptance를 Plan-021에 명시했다.
- 승인 범위: exact main `823dc392c74dbcb53963c0943e7977c924db85ce`의 자동 `windows-2025` run, PowerShell/NTFS/Rust/NSIS/installed E2E/cleanup과 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 GitHub `windows-2025` cross-layer QA와 recursive PowerShell parser를 실제 실행한다.
- first-marker NSIS payload identity positive/tamper-negative control을 actual PowerShell에서 실행한다.
- Windows default/all-feature Rust에서 native pinned-directory rename과 cross-platform harness controls를 실행한다.
- production x64 current-user NSIS build/install/window launch/uninstall과 app data·shared WebView2 보존을 검증한다.
- private E2E NSIS의 installed exact executable로 합성 UI/native/restart/import/export/backup/restore suite를 실행한다.
- cleanup success와 production-only exact three-file artifact metadata/checksum/evidence를 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-021-windows-hosted-acceptance`와 `.worktree/plan-021-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `823dc392c74dbcb53963c0943e7977c924db85ce`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows all-feature Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] successful production artifact metadata와 exact inner allowlist 대사 — lifecycle failure로 upload skipped, artifact 0개, `NOT RUN`
- [x] installer bytes/hash/checksum과 sanitized evidence JSON 대사 — staged artifact가 없어 `NOT RUN`
- [x] failure를 Tauri configured-window-before-setup 순서와 기존 handle-only smoke의 조기 강제 종료가 만든 경쟁 가설로 분석; 변경분 hosted 확인은 `NOT RUN`
- [x] exact roaming DB·daily backup·빈 workspace 안정화와 정상 OS close/exit, uninstall hash 보존 계약 및 대조군 구현
- [x] 변경분 전체 QA와 focused mutation controls 재검증
- [x] 세 관점 독립 재심사와 모든 P0–P3 finding remediation 완료
- [x] 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- cross-layer frontend 366/database 계약, Windows default expected tests와 harness negative controls 확인
- actual PowerShell recursive parse, junction sentinel와 NSIS payload positive/tamper-negative control 확인
- Windows Rust default/all-features, NTFS HANDLE-relative overwrite/CRUD, identity-swap, symlink/junction와 FlushFileBuffers 확인
- production NSIS exact x64/config/feature/marker/payload, silent lifecycle, launch와 owned-residue/app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema·값 대사

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup·upload 단계가 success다.
2. actual PowerShell이 first-marker projection positive와 non-marker tamper negative control을 통과한다.
3. native pinned-directory rename이 stale target을 교체하고 junction name-swap 뒤 original identity에만 적용된다.
4. production current-user/offline NSIS가 실제 설치·창 실행·제거되고 user data와 shared WebView2 `pv`가 보존된다.
5. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
6. successful non-PR artifact 하나가 exact production 3-file allowlist만 포함하고 checksum/evidence가 일치한다.
7. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/filesystem reviewer가 exact commit binding, step/result 해석, checksum/allowlist, 두 executable hash와 개인정보 경계, 잔여 주장 범위를 검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-020 완료 commit의 automatic main push run만 authoritative하게 사용 | patch-aware identity와 evidence mutation controls를 reviewed tree와 exact SHA로 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | automatic run `31153074187`을 authoritative attempt로 결속 | main push, attempt 1, exact full SHA와 workflow identity가 evidence contract에 일치 |
| 2026-08-07 | LocalAppData가 아니라 exact roaming DB를 production data 계약으로 유지 | locked Tauri 2.11.5 `app_data_dir()`의 Windows 경로와 BODAM `lib.rs`가 일치 |
| 2026-08-07 | window handle 뒤 daily backup·empty workspace 안정화를 기다리고 OS normal close를 1회 요청 | configured window가 setup보다 먼저 생기므로 handle 직후 force-stop이 setup·daily IPC보다 앞설 수 있다는 분석을 fail-closed로 검증; 후속 hosted 확인은 미실행 |
| 2026-08-07 | uninstall 전후 exact database와 daily backup hash를 대사 | directory 존재만으로 `appDataPreserved: true`를 기록하지 않음 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-020 `823dc39`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-021 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31153074187`이 exact `823dc392c74dbcb53963c0943e7977c924db85ce`, main push, attempt 1로 시작된 것을 확인했다. |
| 2026-08-07 | quality_runner | job `92786630714`은 cross-layer, actual PowerShell marker controls, all-feature Rust, production NSIS build와 installed window까지 통과한 뒤 roaming app-data 생성 assertion에서 실패했다. |
| 2026-08-07 | repo_cartographer | Tauri core 2.11.5 source에서 configured window build가 user setup보다 먼저이고 `app_data_dir()`가 roaming identifier 경로임을 대사했다. |
| 2026-08-07 | harness_builder | exact DB/daily backup/empty workspace readiness, stable responsive window, normal close/exit와 uninstall hash 보존 및 actual PowerShell/mutation controls를 구현했다. |
| 2026-08-07 | quality_runner | frontend 83/366, Rust 319, Prisma registry/diff, Vite build, Tauri check, full harness와 audit 0건을 재검증했다. |
| 2026-08-07 | quality_runner | `cargo test --all-features` 335/335로 private E2E feature의 추가 Rust path/dialog 계약까지 재검증했다. |
| 2026-08-07 | review_judge | 초기 심사에서 review prerequisite, 원인 표현, direct roaming provenance, comment/polarity/oracle/order/document-decoy 결속 결함을 발견했다. |
| 2026-08-07 | harness_builder | PowerShell active-code parser와 exact body digest를 분리하고 roaming root, readiness wrapper/oracle, junction setup, lifecycle order, hash preservation을 fail-closed mutation으로 결속했다. |
| 2026-08-07 | privacy_guard | native path 오류를 상수 오류로 축약하고 DB/daily backup 관찰·보존 검사에서 runner path가 증거에 노출되지 않도록 보강했다. |
| 2026-08-07 | quality_runner | 리뷰 remediation 뒤 focused contract, `npm run qa`, audit 0건, Rust all-features 335/335와 `git diff --check`를 다시 PASS했다. |
| 2026-08-07 | review_judge | 재심사에서 cleanup property 경합, 비독립 zero-byte controls와 dormant PowerShell string/scriptblock/false-branch decoy를 발견했다. |
| 2026-08-07 | harness_builder | cleanup guard 전체 catch, full-ready zero-byte controls, here-string masking과 installer/host/readiness/production whole-code digest 및 dormant-code mutations를 추가했다. |
| 2026-08-07 | quality_runner | 두 번째 remediation 뒤 `npm run qa`, focused/full harness, audit, Rust 335/335, review prerequisite와 diff check를 current tree에서 모두 PASS했다. |
| 2026-08-07 | review_judge | trailing-space/backtick continuation과 token-attached comment 우회를 재현해 exact raw-source digest와 전용 mutations로 닫았고 최종 세 심사가 P0–P3 0건을 판정했다. |

## QA Evidence

- result: FAIL — [automatic run 31153074187](https://github.com/taejun9/bodam/actions/runs/31153074187), job `92786630714`, main push, attempt 1, exact `823dc392c74dbcb53963c0943e7977c924db85ce`, runner `windows-2025`
- setup and locked dependencies: PASS
- cross-layer QA: PASS — frontend 83 files/366 tests, Prisma/database contract, Windows default Rust expected suite, Vite production build, Tauri check와 full harness
- hosted cleanup safety: PASS — recursive PowerShell parse, junction sentinel와 actual NSIS payload identity positive/tamper-negative control
- Windows all-feature Rust and unsigned production NSIS build: PASS
- production lifecycle: FAIL — silent install, installed regular-path/x64/unsigned, first-marker patch-aware full payload, exact file allowlist, HKCU registry, installed production marker scan과 exact installed window launch까지 PASS한 뒤 `production launch did not create its required roaming app-data`
- lifecycle NOT RUN: normal uninstall exit 0, normal-uninstall app-data/shared-WebView preservation와 release evidence staging
- unconditional exact app-owned cleanup and hosted summary: PASS; normal uninstall 증거로 확대하지 않음
- private E2E NSIS, installed full E2E and artifact upload: SKIPPED
- artifacts: 0; successful allowlist/checksum/evidence acceptance `NOT RUN`
- root-cause analysis: SUPPORTED — repository/locked source order는 Local WebView/window 관찰 뒤 BODAM roaming directory·SQLite·repository setup과 renderer daily-backup IPC가 뒤따르는 경쟁 설명을 강하게 지지하지만, false-negative 확정과 변경분 production lifecycle 확인은 후속 `windows-2025` run 전까지 `NOT RUN`
- result: PASS — Plan-021 current-tree review remediation local gate; comment/string/dormant-code-safe exact PowerShell contracts, mutation controls, full QA, dependency audit, all-feature Rust와 diff validation 통과. Windows 전용 실행을 PASS로 확대하지 않음
- focused Windows release contract controls: PASS — exact active statements와 comment/suffix/timeout/path/polarity mutation controls
- post-remediation local full QA: PASS — `npm run qa`; ESLint/typecheck, frontend 83 files/366 tests, Prisma validate/registry/diff, Rust 319 tests, Vite production build, Tauri cargo check와 full harness
- post-remediation local all-feature Rust: PASS — 335/335 tests
- post-remediation dependency audit: PASS — `npm audit --audit-level=high`, vulnerabilities 0
- post-remediation static validation: PASS — focused Windows release contract controls와 `git diff --check`
- actual new PowerShell parser/readiness controls and production lifecycle: `NOT RUN` locally — macOS에 PowerShell/NTFS/installed Windows production binary가 없으며 후속 exact `windows-2025` run이 실행 증거를 소유

## Review Findings

- P1: 초기 심사 시 `Status: active`와 hosted baseline `result: FAIL`만 있어 review prerequisite가 실패했다. post-remediation QA PASS 뒤 `Status: review`와 별도 local `result: PASS`를 기록해 선행조건을 충족했다. 독립 재심사 0 findings.
- P2: 실행하지 않은 변경분을 root-cause reproduction PASS로 확정한 표현을 supported analysis·hosted confirmation `NOT RUN`으로 보정했다. 독립 재심사 0 findings.
- P3: Tauri `app_data_dir()`에서 Windows roaming으로 이어지는 근거가 간접적이었다. Tauri 2.11.5 PathResolver와 dirs 6.0.0 Windows mapping을 version-pinned direct source로 추가하고 문서 mutation으로 결속했다. 독립 재심사 0 findings.
- P2: reparse fragment와 inline comment가 조건 반전·주석 decoy를 허용했다. active inline comment 제거, exact condition block, readiness body digest와 각 path polarity/decoy mutation으로 보정했다. 독립 재심사 0 findings.
- P2: readiness wrapper와 actual control oracle을 no-op으로 바꿔도 통과했다. 두 function body를 exact하게 결속하고 `$true`/`if ($false)` mutation을 추가했다. 독립 재심사 0 findings.
- P2: `HasExited`, readiness polarity, close/wait guard와 close 위치를 약화해도 통과했다. launch body digest와 strictly ordered success gate→regular-path→single close→bounded exit→failure cleanup 계약 및 reorder/polarity mutation으로 보정했다. 독립 재심사 0 findings.
- P3: 필수 evidence phrase가 HTML comment에만 있어도 통과했다. HTML comment를 제거한 visible text만 검사하고 comment-only mutation을 추가했다. 독립 재심사 0 findings.
- P3: failure cleanup의 process property guard가 constant-error catch 밖이라 종료 경합 시 native 오류가 원래 stage 오류를 덮을 수 있었다. guard·force stop·wait 전체를 하나의 catch로 감싸고 launch digest를 갱신했다. current-tree QA PASS, 독립 재심사 0 findings.
- P3: 초기 zero-byte DB/daily controls가 다른 미충족 조건과 겹쳐 Length 조건을 독립 검증하지 못했다. full-ready fixture에서 DB와 daily만 각각 0-byte로 바꾸고 복구 positive를 확인하며 actual readiness script 전체 digest로 결속했다. current-tree QA PASS, 독립 재심사 0 findings.
- P2: regex가 here/multiline string, 미호출 scriptblock과 `if ($false)` 안의 원문을 실행문으로 오인했다. multiline/here-string을 fail-closed로 거부하고 readiness/installer/host/readiness-test/production 다섯 파일의 exact raw-source digest와 dormant-code mutations를 추가했다. 독립 재심사 0 findings.
- P2: blank comment와 backtick trailing space가 줄 연속성을 깨도 정규화 digest가 같았고 token-attached `#`를 comment로 오인했다. digest가 원문 줄·끝 공백을 보존하도록 바꾸고 continuation/token mutations를 추가했다. 독립 재심사 0 findings.
- Advisory: roaming root assignment, junction 생성·cleanup, uninstall 후 daily/DB hash 보존의 false-pass와 native full-path 오류 위험을 exact contract와 상수 오류로 함께 보강했다.
- Final verdict: evidence, lifecycle/privacy, adversarial harness 세 독립 재심사 모두 P0 0/P1 0/P2 0/P3 0.

## Completion Notes

- baseline hosted run은 production launch readiness에서 FAIL했고 이후 normal lifecycle, private E2E와 artifact acceptance는 `NOT RUN`이었다.
- exact roaming readiness, single normal close, bounded exit와 uninstall hash preservation을 구현하고 모든 local QA·adversarial mutation 및 독립 재심사를 통과했다.
- 변경된 Windows lifecycle은 이 plan에서 PASS로 선기록하지 않으며, 완료 commit의 automatic main-push run과 artifact acceptance를 Plan-022에 인계한다.
