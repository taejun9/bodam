# plan-020-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-019가 harness portability 수정 main commit의 hosted acceptance를 Plan-020에 명시했다.
- 승인 범위: exact main `30eb91fc0af3291fe393dbe2d61dee03d914f0b0`의 자동 `windows-2025` run, PowerShell/NTFS/Rust/NSIS/installed E2E/cleanup과 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 GitHub `windows-2025` cross-layer QA와 recursive PowerShell parser를 실제 실행한다.
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

- `codex/plan-020-windows-hosted-acceptance`와 `.worktree/plan-020-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `30eb91fc0af3291fe393dbe2d61dee03d914f0b0`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows all-feature Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] successful production artifact 대사 — lifecycle failure로 upload skipped, artifact 0개, `NOT RUN`
- [x] checksum/evidence 대사 — staged evidence와 artifact가 없어 `NOT RUN`
- [x] restored source의 첫 Tauri `UNK` marker를 `NSS`로 치환한 exact expected payload와 설치본을 비교
- [x] 제거 전 실제 installed executable SHA-256을 capture해 production evidence에 전달
- [x] synthetic NSIS marker positive/tamper-negative PowerShell control과 durable source/acceptance 문서 추가
- [x] 전체 로컬 QA와 독립 리뷰, 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- cross-layer frontend 366/database 계약, Windows default 310 expected tests와 harness negative controls 확인
- actual PowerShell recursive parse, junction sentinel, registry views와 shared WebView2 `pv` preservation 확인
- Windows Rust default/all-features, NTFS HANDLE-relative overwrite/CRUD, identity-swap, symlink/junction와 FlushFileBuffers 확인
- production NSIS exact x64/config/feature/marker/hash, silent lifecycle, launch와 owned-residue/app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema 대사

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup 단계가 success다.
2. POSIX repo-relative harness diagnostics와 absolute-root redaction controls가 actual Windows에서 통과한다.
3. native pinned-directory rename이 stale target을 교체하고 junction name-swap 뒤 original identity에만 적용된다.
4. production current-user/offline NSIS가 실제 설치·창 실행·제거되고 user data와 shared WebView2 `pv`가 보존된다.
5. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
6. successful non-PR artifact 하나가 exact production 3-file allowlist만 포함하고 checksum/evidence가 일치한다.
7. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/filesystem reviewer가 exact commit binding, step/result 해석, checksum/allowlist, 개인정보 경계와 잔여 주장 범위를 검토한다. 실패 수정이 생기면 작성자가 아닌 reviewer가 코드도 재검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-019 완료 commit의 automatic main push run만 authoritative하게 사용 | harness 수정, 완료 plan/review와 hosted tree를 exact SHA로 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | automatic run `31150012396`을 authoritative attempt로 결속 | main push, attempt 1, exact full SHA와 workflow identity가 evidence contract에 일치 |
| 2026-08-07 | raw source/install hash equality를 Tauri NSIS patch-aware exact payload equality로 교체 | CLI 2.11.4는 bundle 직전 첫 `UNK` marker를 `NSS`로 patch하고 installer 생성 뒤 target source를 원본으로 복원하므로 raw hash 차이는 정상 |
| 2026-08-07 | evidence에는 uninstall 전 actual installed binary hash를 전달 | restored source hash를 `installedBinarySha256`으로 잘못 표기하지 않고 실제 설치본을 증거화 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-019 `30eb91f`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-020 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31150012396`, job `92777516401`이 exact `30eb91fc0af3291fe393dbe2d61dee03d914f0b0`, main push, attempt 1, `windows-2025`로 시작된 것을 확인했다. |
| 2026-08-07 | quality_runner | cross-layer, host safety, all-feature Rust와 production NSIS build는 통과했으나 production lifecycle의 raw executable hash assertion이 실패했고 E2E/upload는 skipped, cleanup·summary는 성공했다. |
| 2026-08-07 | review_judge | hosted build log와 pinned Tauri 2.11.4 source를 대사해 installer payload의 `UNK`→`NSS` patch 뒤 source 복원이 raw hash 차이의 결정적 원인임을 확인했다. |
| 2026-08-07 | harness_builder | shared installer contract를 first-marker patch-aware full-payload hash로 바꾸고 실제 installed hash evidence, tamper negative control과 immutable source 문서를 추가했다. |
| 2026-08-07 | quality_runner | focused Windows release mutation controls와 `npm run qa`를 재실행해 frontend 366/366, Rust 319/319, Prisma·DB·Vite·Tauri·전체 harness를 통과했고 `npm audit --audit-level=high`은 취약점 0을 보고했다. |
| 2026-08-07 | review_judge | evidence 의미가 아닌 key substring만 검사해 actual installed hash 회귀와 patch-aware 문서 회귀를 놓칠 수 있는 P2를 발견해 계획을 QA로 되돌렸다. |
| 2026-08-07 | harness_builder | 실제 release 파일의 격리 fixture와 capture·forwarding·assignment·boolean·두 acceptance 문서·immutable source pin mutation controls로 P2를 해결했다. |
| 2026-08-07 | quality_runner | post-finding focused controls와 전체 `npm run qa`를 재실행해 frontend 366/366, Rust 319/319, Prisma·DB·Vite·Tauri·전체 harness를 통과했고 audit 0을 재확인했다. |
| 2026-08-07 | review_judge | semantic regex가 comment decoy·suffix identifier를 허용하고 exact match count를 고정하지 않는 잔여 P2를 발견해 계획을 다시 QA로 돌렸다. |
| 2026-08-07 | harness_builder | active full-line anchor, block/line-comment 제거, exact-one match와 comment·suffix·duplicate mutation controls로 잔여 P2를 해결했다. |
| 2026-08-07 | quality_runner | 두 번째 post-finding focused controls와 전체 `npm run qa`의 frontend 366/366, Rust 319/319, DB·build·Tauri·harness를 모두 재통과했다. |

## QA Evidence

- result: FAIL — [automatic run 31150012396](https://github.com/taejun9/bodam/actions/runs/31150012396), job `92777516401`, main push, attempt 1, exact `30eb91fc0af3291fe393dbe2d61dee03d914f0b0`, `windows-2025`
- setup and locked dependencies: PASS
- cross-layer QA: PASS — Vitest 83 files/366 tests, Prisma/database contract, Windows default Rust 310/310, Vite production build, Tauri check와 full harness
- hosted cleanup safety: PASS — recursive PowerShell parse와 nested junction sentinel preservation
- Windows all-feature Rust: PASS — 324/324
- unsigned production NSIS build: PASS
- production lifecycle: FAIL — silent install exit 0, install directory·installed executable·uninstaller regular-path와 installed x64 PE까지 PASS한 뒤 `installed executable does not match the bundled executable`
- root cause: pinned Tauri CLI 2.11.4가 source의 첫 `__TAURI_BUNDLE_TYPE_VAR_UNK`를 `..._NSS`로 patch해 NSIS에 넣은 뒤 target source를 unpatched bytes로 복원하므로 raw SHA equality oracle이 false negative를 냈다.
- lifecycle NOT RUN: install file exact allowlist, HKCU registry identity, installed marker scan, WebView snapshot, window launch, normal uninstall exit 0, app-data/shared-WebView preservation와 release evidence staging
- private E2E NSIS, installed E2E and artifact upload: SKIPPED
- unconditional exact app-owned cleanup and hosted summary: PASS; 정상 uninstall이나 shared WebView preservation 증거로 확대하지 않음
- artifacts: 0; successful allowlist/checksum/evidence acceptance `NOT RUN`
- local remediation result: PASS — Windows release positive/negative controls, frontend 83 files/366 tests, Rust 319 tests, Prisma schema/migration registry·diff, Vite production build, Tauri check와 full harness
- post-finding remediation result: PASS — actual capture·forwarding·assignment, patch-aware boolean, two acceptance documents and immutable source pin mutation controls plus complete local QA
- second post-finding remediation result: PASS — active exact-line/count semantics, comment/suffix/duplicate negative controls and complete local QA
- dependency audit: PASS — `npm audit --audit-level=high`, vulnerabilities 0
- actual PowerShell marker control, production lifecycle와 installed E2E: current macOS worktree에서는 실행 불가; reviewed fix commit의 후속 exact `windows-2025` run에서 검증

## Review Findings

- resolved P2: local release harness가 key substring만 검사해 actual installed hash와 patch-aware 문서 회귀를 놓칠 수 있었다. 실제 release 파일의 격리 fixture와 capture·forwarding·assignment·boolean·문서·source-pin mutation controls를 추가하고 전체 QA를 재통과했다.
- resolved P2: 첫 semantic regex가 comment decoy, suffix identifier와 duplicate statement를 허용할 수 있었다. comment 제거 뒤 active full-line을 정확히 한 번만 허용하도록 고정하고 comment·suffix·duplicate controls와 전체 QA를 통과했다.
- code reviewer: first-marker projection, full-payload SHA-256, unsigned contract와 actual installed hash capture를 재심사해 잔여 P0–P3 0건으로 승인했다.
- evidence reviewer: exact active semantics, mutation controls, patch-aware 문서와 immutable source pin을 재심사해 잔여 P0–P3 0건으로 승인했다.
- privacy/lifecycle reviewer: temp fixture, cleanup, evidence path·row 비노출과 FAIL/NOT RUN 주장 경계를 재심사해 잔여 P0–P3 0건으로 승인했다.
- final verdict: PASS with documented residual risk. 수정 commit의 actual Windows lifecycle/E2E/artifact acceptance는 후속 exact run 전까지 `NOT RUN`이다.

## Completion Notes

- authoritative run은 production 설치와 x64 PE 확인까지 통과한 뒤 Tauri의 정상 NSIS marker patch를 허용하지 않은 raw-hash oracle에서 실패했다. 이후 lifecycle, installed E2E와 artifact는 PASS로 확대하지 않았다.
- source의 첫 `UNK`만 `NSS`로 투영한 전체 payload hash를 실제 설치본과 비교하고 source·installed hash를 구분해 기록하도록 공용 production/E2E 계약을 수정했다.
- actual-source fixture, marker tamper, evidence capture·forwarding·assignment·boolean, comment·suffix·duplicate와 immutable 문서/source-pin negative controls를 추가했다.
- 최종 tree는 repeated focused controls, `npm run qa`의 frontend 366/Rust 319/DB/build/Tauri/full harness, audit 0, diff 검사와 세 독립 재심사를 통과했다.
- 이 완료 commit의 automatic main-push run에서 실제 Windows PowerShell/NSIS lifecycle, installed full E2E와 exact three-file artifact를 검증하는 일은 Plan-021이 소유한다.
- WebView2가 없는 network-blocked clean VM, Authenticode·SmartScreen과 public distribution은 계속 별도 권한·환경 범위다.
