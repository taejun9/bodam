# plan-017-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-016이 Windows CP1252 수정 main commit의 hosted acceptance를 Plan-017로 명시했다.
- 승인 범위: exact main `e1e1df7854e56143edf3d167eeade20b3d693ac0`의 자동 `windows-2025` run, native PowerShell/NTFS/Rust/NSIS/installed E2E/cleanup과 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 GitHub `windows-2025` cross-layer QA와 recursive PowerShell parser를 실제 실행한다.
- production x64 current-user NSIS build/install/window launch/uninstall과 app data·shared WebView2 보존을 검증한다.
- private E2E NSIS의 installed exact executable로 합성 UI/native/restart/import/export/backup/restore suite와 Windows NTFS tests를 실행한다.
- cleanup success와 production-only exact three-file artifact metadata/checksum/evidence를 대사한다.
- 실패가 있으면 failure/NOT RUN을 유지하고 원인·수정·QA·독립 리뷰 후 다음 exact-commit plan으로 넘긴다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-017-windows-hosted-acceptance`와 `.worktree/plan-017-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `e1e1df7854e56143edf3d167eeade20b3d693ac0`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] 실패 run의 artifact 0건과 upload skipped를 확인하고 successful artifact 대사는 NOT RUN으로 유지
- [x] Windows Rust snapshot/handle root cause를 공식 API 계약과 결속하고 최소 수정·회귀 control 추가
- [x] successful production artifact 대사는 failed run이라 NOT RUN으로 기록하고 artifact 0을 확인
- [x] checksum/evidence 검사는 artifact 부재로 NOT RUN이며 임시 다운로드가 없음을 확인
- [x] hosted outcome 문서, 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual PowerShell recursive parse, junction sentinel, registry views와 shared WebView2 `pv` preservation 확인
- Windows Rust default/all-features, NTFS HANDLE-relative CRUD, identity-swap, symlink/junction와 FlushFileBuffers 확인
- production NSIS exact x64/config/feature/marker/hash, silent lifecycle, launch와 owned-residue/app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema 대사
- 수정 시 `npm run qa`, Rust default/all-features/fmt/Clippy, Windows MSVC cross-check와 actual macOS E2E 재실행

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup 단계가 success다.
2. production current-user/offline NSIS가 실제 설치·창 실행·제거되고 user data와 shared WebView2 `pv`가 보존된다.
3. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
4. Windows NTFS HANDLE/reparse/name-swap/FlushFileBuffers tests와 external-sentinel cleanup control이 통과한다.
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
| 2026-08-07 | Plan-016 fix commit의 automatic main push run만 authoritative하게 사용 | validated tree와 hosted tree를 exact SHA로 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | automatic run `31144926212`를 authoritative attempt로 결속 | main push, attempt 1, exact full SHA와 workflow identity가 evidence contract에 일치 |
| 2026-08-07 | cross-layer failure 뒤 production artifact 검사는 NOT RUN으로 유지 | Windows Rust default failure로 후속 safety/all-feature/NSIS/E2E/upload가 skipped이고 artifact가 0건 |
| 2026-08-07 | snapshot sync와 Win32 rename buffer/test contract를 분리해 수정 | Microsoft 계약상 FlushFileBuffers는 write access가 필요하고 rename information buffer는 struct 크기와 이름 bytes의 합 이상이어야 하며 open descendant는 ancestor rename을 차단 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-016 fix `e1e1df7`을 main에 fast-forward·push하고 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-017 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31144926212`가 exact `e1e1df7854e56143edf3d167eeade20b3d693ac0`, main push, attempt 1로 시작된 것을 확인했다. |
| 2026-08-07 | quality_runner | job `92762290564`는 frontend/database 계약 뒤 Windows Rust default 268/309까지 통과했지만 backup 41 tests가 실패했다. cleanup·summary는 success, 후속 검증은 skipped, artifact는 0건이다. |
| 2026-08-07 | repo_cartographer | 공통 snapshot failure를 read-only sync handle과, 별도 error 87/5를 undersized rename buffer와 Windows의 open-descendant ancestor-rename 차단 계약에 결속했다. |
| 2026-08-07 | harness_builder | snapshot/restore의 existing file durability sync를 write-enabled helper로 모으고 Windows bytes-preservation test를 추가했다. rename buffer와 directory name-swap test도 공식 Win32 계약에 맞췄다. |
| 2026-08-07 | quality_runner | local full QA, Rust all-features/fmt/Clippy, Windows MSVC projection, audit와 승인된 실제 macOS full native E2E를 모두 통과했다. |
| 2026-08-07 | review_judge | durability/error mapping, Win32 handle semantics, hosted evidence/privacy 독립 심사 3개가 P0–P3 finding 없이 PASS했다. |
| 2026-08-07 | doc_gardener | baseline hosted FAIL과 새 수정 commit의 NOT RUN 경계를 유지한 완료 계획과 동일 번호 리뷰를 작성했다. |

## QA Evidence

- result: FAIL — [automatic run 31144926212](https://github.com/taejun9/bodam/actions/runs/31144926212), job `92762290564`, main push, attempt 1, exact `e1e1df7854e56143edf3d167eeade20b3d693ac0`, `windows-2025`
- hosted boundary: dependencies success; cross-layer QA failure; host safety, all-feature Windows Rust, production lifecycle, installed E2E skipped; cleanup·summary success; upload skipped; artifact 0
- authenticated read-only log: lint/typecheck, Vitest 83/366, Prisma validate와 database registry/diff PASS 뒤 Rust default 268 passed/41 failed; failure는 backup snapshot 계열과 Windows directory capability tests에 한정
- common snapshot root: `sync_file`이 `File::open`의 read-only handle로 `sync_all`을 호출하지만 Windows `FlushFileBuffers`는 `GENERIC_WRITE`를 요구해 `BACKUP_SNAPSHOT_FAILED`로 수렴
- handle roots: `FILE_RENAME_INFO` allocation이 required struct-plus-name bytes보다 짧아 rename이 error 87; Windows는 open descendant가 있는 ancestor rename을 error 5로 차단하므로 기존 identity-swap test의 전제가 플랫폼 계약과 불일치
- production NSIS/install/window/installed E2E/NTFS continuation과 accepted three-file artifact: NOT RUN
- local remediation result: PASS
- `npm run qa`: ESLint, Vue typecheck, Vitest 83/366, Prisma validate/registry/diff, Rust default 319, Vite production build, Tauri check, harness controls PASS
- Rust: backup focused 108/108, all-features 335/335, fmt check, all-target/all-feature Clippy `-D warnings` PASS
- Windows MSVC projection: `x86_64-pc-windows-msvc`, tests/all-features, `RUSTFLAGS=-Dwarnings`, host SQLite pkg-config와 LLVM resource compiler no-link cross type-check PASS
- dependencies: `npm audit --audit-level=high` — vulnerability 0
- actual macOS `BODAM E2E.app`: 승인된 GUI 환경의 `npm run test:e2e` overall exit 0; customer/policy/coverage/benchmark/family/consultation/dashboard/schedule/calendar, restart, XLSX/CSV import/export/round-trip/rollback, backup/restore/reauthorization/exit/idempotency PASS
- expected-process boundary: restore와 exit child WDIO의 process-level FAILED는 의도된 restart/exit이며 상위 runner가 marker, archive, logical DB snapshot과 residue를 대사한 뒤 exit 0

## Review Findings

- durability reviewer: P0–P3 0. existing-only write handle, create/truncate 부재, bytes 불변 test, snapshot/restore error mapping과 backup 108/108을 확인했다.
- Win32 reviewer: P0–P3 0. checked struct-plus-name allocation의 길이·정렬·초기화, leaf name-swap의 reparse/pinned-handle/cleanup 의미와 MSVC projection을 확인했다.
- evidence/privacy reviewer: P0–P3 0. exact run/job/SHA/attempt와 failure/skipped/artifact 0, hosted/local·child/upper-runner 경계, 민감정보 비유입을 독립 대사했다.
- final verdict: PASS with residual risk. 새 수정 commit의 actual Windows acceptance는 Plan-018 전까지 NOT RUN이다.

## Completion Notes

- exact run `31144926212`는 frontend 366과 database 계약 뒤 Windows Rust default 268/309에서 실패했다. 39건은 read-only durability sync의 snapshot cluster이고, 2건은 undersized rename buffer와 잘못된 ancestor rename test 전제였다.
- snapshot/restore existing DB를 write-enabled handle로 flush하고 Windows bytes-preservation control을 추가했다. rename allocation은 Win32 minimum으로 늘리고 selected leaf name-swap이 pinned original에만 쓰는 test로 교체했다.
- final tree는 local full QA, Rust 319/335, fmt/Clippy, Windows MSVC projection, audit 0, 승인된 실제 macOS full native E2E와 독립 심사 3개를 통과했다.
- 완료 수정 commit의 automatic main run에서 Windows default/all-feature Rust, host safety, production NSIS/install/window, installed E2E, cleanup과 exact three-file artifact를 확인하는 일은 Plan-018이 소유하며 그전까지 NOT RUN이다.
- Authenticode, SmartScreen reputation과 WebView2가 없는 network-blocked clean VM은 계속 별도 권한·환경 범위다.
