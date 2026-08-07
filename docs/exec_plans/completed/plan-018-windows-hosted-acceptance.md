# plan-018-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-017이 Windows backup filesystem 수정 main commit의 hosted acceptance를 Plan-018로 명시했다.
- 승인 범위: exact main `8cf376c95d74ca27ff9af3e8358d330d25eae39d`의 자동 `windows-2025` run, native PowerShell/NTFS/Rust/NSIS/installed E2E/cleanup과 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 GitHub `windows-2025` cross-layer QA와 recursive PowerShell parser를 실제 실행한다.
- Windows default/all-feature Rust에서 writable durability sync, exact rename buffer, HANDLE/reparse/name-swap/FlushFileBuffers tests를 실행한다.
- production x64 current-user NSIS build/install/window launch/uninstall과 app data·shared WebView2 보존을 검증한다.
- private E2E NSIS의 installed exact executable로 합성 UI/native/restart/import/export/backup/restore suite를 실행한다.
- cleanup success와 production-only exact three-file artifact metadata/checksum/evidence를 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-018-windows-hosted-acceptance`와 `.worktree/plan-018-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `8cf376c95d74ca27ff9af3e8358d330d25eae39d`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] 실패 run의 artifact 0건과 upload skipped를 확인하고 successful artifact 대사는 NOT RUN으로 유지
- [x] successful artifact가 없어 checksum/bytes/evidence 검사는 NOT RUN이며 임시 다운로드가 없음을 확인
- [x] Win32 wrapper rename 오류를 native pinned-directory rename 계약으로 교체하고 overwrite·name-swap 회귀 control 추가
- [x] hosted outcome 문서, 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- cross-layer frontend 366/database 계약과 Windows default 310 expected tests 확인
- actual PowerShell recursive parse, junction sentinel, registry views와 shared WebView2 `pv` preservation 확인
- Windows Rust default/all-features, NTFS HANDLE-relative CRUD, identity-swap, symlink/junction와 FlushFileBuffers 확인
- production NSIS exact x64/config/feature/marker/hash, silent lifecycle, launch와 owned-residue/app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema 대사

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup 단계가 success다.
2. writable existing-file durability sync가 bytes를 보존하고 leaf name-swap의 pinned handle이 original에만 쓰며 replacement를 건드리지 않는다.
3. production current-user/offline NSIS가 실제 설치·창 실행·제거되고 user data와 shared WebView2 `pv`가 보존된다.
4. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
5. successful non-PR artifact 하나가 exact production 3-file allowlist만 포함하고 checksum/evidence가 일치한다.
6. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/filesystem reviewer가 exact commit binding, step/result 해석, checksum/allowlist, 개인정보 경계와 잔여 주장 범위를 검토한다. 수정이 생기면 작성자가 아닌 reviewer가 코드도 재검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-017 fix commit의 automatic main push run만 authoritative하게 사용 | validated tree와 hosted tree를 exact SHA로 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | automatic run `31146413994`를 authoritative attempt로 결속 | main push, attempt 1, exact full SHA와 workflow identity가 evidence contract에 일치 |
| 2026-08-07 | attempt 1은 Windows rename 공통 원인을 최소 수정한 뒤 후속 exact commit run으로 재검증 | default Rust 310개 중 29개 실패가 동일 directory capability rename 실패에서 파생됐고 이후 release 단계는 실행되지 않음 |
| 2026-08-07 | pinned directory handle과 basename을 native `NtSetInformationFile(FileRenameInformation)` 계약으로 전달 | 실패 정리 뒤 target이 없으므로 오류 87은 post-rename flush가 아닌 Win32 wrapper 입력 단계이며 native 계약은 non-null RootDirectory 상대 rename을 명시함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-017 fix `8cf376c`을 main에 fast-forward·push하고 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-018 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31146413994`가 exact `8cf376c95d74ca27ff9af3e8358d330d25eae39d`, main push, attempt 1로 시작된 것을 확인했다. |
| 2026-08-07 | quality_runner | run `31146413994`, job `92766662181`은 `windows-2025`에서 cross-layer QA 실패, cleanup·summary 성공, 이후 Windows all-feature/NSIS/installed E2E/upload skipped, artifact 0건으로 종료됐다. |
| 2026-08-07 | quality_runner | frontend/database 계약은 통과했고 Windows default Rust는 310개 중 281 pass/29 fail이었다. Plan-017의 writable sync, directory name-swap, foreign backup path 검증은 통과했으며 공통 실패는 relative rename 오류 87이었다. |
| 2026-08-07 | harness_builder | rename 실패 cleanup은 임시 basename만 제거하므로 post-rename flush 실패라면 target이 남는다. hosted target 부재를 근거로 SetFileInformationByHandle 단계 실패로 국소화했다. |
| 2026-08-07 | harness_builder | `NtSetInformationFile(FileRenameInformation)`의 non-null RootDirectory 계약으로 rename을 전환하고 기존 target 교체와 junction name-swap 뒤 pinned original rename control을 추가했다. |
| 2026-08-07 | quality_runner | local full QA, Rust all-feature/backup/fmt/Clippy, Windows MSVC projection, audit와 실제 macOS full native E2E를 모두 통과했다. |
| 2026-08-07 | review_judge | Win32 native semantics와 backup regression 심사는 P0–P3 0이었고 evidence 심사의 lifecycle P2를 완료 plan/review mirror로 해소했다. |
| 2026-08-07 | doc_gardener | hosted FAIL, local remediation PASS와 새 Windows 실행 NOT RUN 경계를 유지한 완료 계획과 동일 번호 리뷰를 작성했다. |

## QA Evidence

- result: FAIL — [automatic run 31146413994](https://github.com/taejun9/bodam/actions/runs/31146413994), job `92766662181`, main push, attempt 1, exact `8cf376c95d74ca27ff9af3e8358d330d25eae39d`, `windows-2025`
- dependency setup: PASS
- cross-layer frontend/database: PASS; Windows default Rust: FAIL — 281/310 pass, 29 fail
- confirmed repaired contracts: writable existing-file durability sync PASS, selected-directory name-swap/pinned-handle PASS, foreign host backup path clearing PASS
- common failure: `relative_crud_listing_and_file_identity_are_handle_bound`가 `SetFileInformationByHandle` 입력 단계의 Windows error 87로 실패했고 28개 backup/restore fixture 실패가 파생됨
- downstream boundary: hosted cleanup safety, Windows all-feature, production NSIS lifecycle, private E2E build/installed E2E와 upload는 skipped
- unconditional cleanup/evidence summary: PASS
- artifact API: exact run artifact 0건; 실패 run이므로 production artifact acceptance는 후속 run으로 이월
- production NSIS/install/window/installed E2E/Windows all-feature continuation과 accepted three-file artifact: NOT RUN
- local remediation result: PASS
- `npm run qa`: ESLint, Vue typecheck, Vitest 83/366, Prisma validate/registry/diff, Rust default 319, Vite production build, Tauri check와 harness controls PASS
- Rust: backup focused 108/108, all-features 335/335, fmt check, all-target/all-feature Clippy `-D warnings` PASS
- Windows MSVC projection: `x86_64-pc-windows-msvc`, tests 기본/all-features, `RUSTFLAGS=-Dwarnings`, host SQLite pkg-config와 LLVM resource compiler no-link type-check PASS
- dependencies: `npm audit --audit-level=low` — vulnerability 0
- actual macOS `BODAM E2E.app`: GUI 환경에서 full `npm run test:e2e`를 실행해 customer/policy/coverage/benchmark/family/consultation/dashboard/schedule/calendar, restart, XLSX/CSV import/export/round-trip/rollback, backup/restore/reauthorization/exit/idempotency PASS
- expected-process boundary: restore와 exit child WDIO의 process-level FAILED는 의도된 restart/exit이며 별도 `npm run test:e2e:backup-settings` 상위 runner가 marker, archive, logical DB snapshot과 residue를 대사한 뒤 exit 0
- modified Windows rename의 actual NTFS execution: 후속 exact commit hosted run 전까지 NOT RUN

## Review Findings

- Win32 reviewer: P0–P3 0. native rename buffer의 길이·정렬·초기화, NTSTATUS 변환, DELETE/write 권한, pinned RootDirectory와 post-rename flush를 확인했다.
- backup regression reviewer: P0–P3 0. stale target overwrite, held source identity/bytes, junction name-swap 뒤 original-only rename과 archive cleanup/final revalidation을 확인했다.
- evidence/privacy reviewer: code/evidence P0–P3 0. exact run/job/SHA/attempt, failure/skipped/artifact 0과 hosted/local·child/upper-runner 경계를 대사했다. 심사 중 제기한 lifecycle P2는 completed plan 이동과 review mirror 작성으로 해소했다.
- final verdict: PASS with residual risk. 수정된 native rename의 actual Windows/NTFS 실행과 downstream installer/artifact acceptance는 후속 exact run 전까지 NOT RUN이다.

## Completion Notes

- exact run `31146413994`는 frontend 366과 database 계약 뒤 Windows Rust default 281/310에서 실패했다. 직접 실패는 Win32 relative rename error 87이고 나머지 28건은 동일 backup fixture failure에서 파생됐다.
- target 부재와 cleanup 흐름으로 rename 후 flush가 아니라 `SetFileInformationByHandle` 입력 단계에 국소화했다. pinned directory 상대 rename을 공식 native `NtSetInformationFile(FileRenameInformation)`로 전환했다.
- Windows regression은 closed stale target 교체, held source와 final target의 동일 identity/bytes, junction name-swap 뒤 pinned original에만 create/rename/remove가 일어나는 계약을 검증한다.
- final tree는 local full QA, Rust 319/335, backup 108, fmt/Clippy, Windows MSVC 기본/all-feature projection, audit 0과 실제 macOS full native E2E를 통과했다.
- 완료 수정 commit의 automatic main run에서 actual Windows default/all-feature Rust, host safety, production NSIS/install/window, installed E2E, cleanup과 exact three-file artifact를 확인하는 일은 Plan-019가 소유한다.
- Authenticode, SmartScreen reputation과 WebView2가 없는 network-blocked clean VM은 계속 별도 권한·환경 범위다.
