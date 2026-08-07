# plan-015-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-014가 수정 main commit의 hosted Windows acceptance를 Plan-015로 명시했다.
- 승인 범위: exact main `26759625a2a34f9fe58fdeb059f445bd3ed74531`의 자동 `windows-2025` run 관찰, native PowerShell/NTFS/Rust/NSIS/installed E2E/cleanup 및 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- GitHub `windows-2025`에서 exact commit의 cross-layer QA와 recursive PowerShell parser를 실제 실행한다.
- production x64 current-user NSIS build/install/window launch/uninstall과 app data·shared WebView2 보존을 검증한다.
- private E2E NSIS의 installed exact executable로 전체 합성 UI/native/restart/import/export/backup/restore suite와 Windows NTFS tests를 실행한다.
- cleanup success와 production-only exact three-file artifact metadata/checksum/evidence를 대사한다.
- 실패가 있으면 failure/NOT RUN 경계를 유지하고 원인·최소 수정·QA·독립 리뷰를 완료한 뒤 다음 exact-commit acceptance plan으로 넘긴다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-015-windows-hosted-acceptance`와 `.worktree/plan-015-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하며 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 검사하며 E2E installer나 runtime data를 다운로드·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit의 rerun은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `26759625a2a34f9fe58fdeb059f445bd3ed74531`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] 실패 run의 artifact 0건과 upload skipped를 확인하고 successful-run allowlist 대사는 NOT RUN으로 유지
- [x] failure root cause 분류, 최소 수정과 전체 QA 수행
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
| 2026-08-07 | Plan-014 fix commit의 automatic main push run만 authoritative하게 사용 | validated tree와 hosted tree를 exact SHA로 결속 |
| 2026-08-07 | failure가 있으면 Plan-015에서 fix lifecycle을 닫고 rerun은 다음 plan으로 분리 | completed plan/review 전 commit 금지와 exact post-push run 순서를 동시에 준수 |
| 2026-08-07 | run `31141527184`의 cross-layer QA failure를 migration checkout byte 불일치로 분류하고 해당 SQL만 LF로 고정 | 실제 세부 로그에서 lint/typecheck/Vitest/Prisma validate 통과 후 9개 migration raw SHA mismatch를 확인했고 registry와 Rust runtime 모두 exact bytes를 검증함 |
| 2026-08-07 | Windows식 격리 clone에서 추가 재현된 달력·대시보드 테스트의 real-timer 경쟁도 함께 제거 | 100 ms 기본 timer가 deferred response와 겹치는 negative control을 재현했으며 fake-timer를 해당 midnight scenario 안으로 한정하는 테스트 전용 수정임 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-014 fix `2675962`를 main에 fast-forward·push하고 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-015 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | run `31141527184`, job `92752255800`가 exact SHA에서 실패했다. dependency setup은 success, cross-layer QA는 failure, 후속 Windows 검증은 skipped, cleanup과 summary는 success, artifact는 생성되지 않았다. |
| 2026-08-07 | quality_runner | 세부 QA 로그는 lint/typecheck, Vitest 83/366과 Prisma validate PASS 뒤 `database:registry`에서 9개 migration 모두 Rust registry checksum mismatch를 보고한 것을 확인했다. Python 실행 문제나 PowerShell parser 재발이 아니다. |
| 2026-08-07 | quality_runner | exact commit을 `core.autocrlf=true`로 checkout한 격리 clone의 full unit suite에서 별도 `calendar-page.test.ts` retry assertion(expected 5, actual 0)을 재현했다. 기본 100 ms real midnight timer가 retry 요청과 겹쳐 응답을 stale 처리했으며 isolated 1 ms negative control도 같은 실패를 냈다. |
| 2026-08-07 | harness_builder | migration SQL만 `text eol=lf`로 고정하고 필수 repository rule과 제거 mutation control을 추가했다. 달력·대시보드 midnight delay는 각 fake-timer scenario 안에서만 100 ms를 사용하도록 격리했다. |
| 2026-08-07 | quality_runner | 최종 tree의 local full QA, CRLF checkout full QA, Rust all-features/fmt/Clippy, Windows MSVC projection, audit와 승인된 실제 macOS full E2E를 모두 통과했다. |
| 2026-08-07 | review_judge | migration/harness, timer isolation, hosted evidence/privacy 독립 리뷰 3개가 P0–P3 0건과 PASS verdict를 냈다. |

## QA Evidence

- local remediation result: PASS
- hosted Windows acceptance: FAIL — run [31141527184](https://github.com/taejun9/bodam/actions/runs/31141527184), job `92752255800`, main push, attempt 1, exact `26759625a2a34f9fe58fdeb059f445bd3ed74531`, `windows-2025`
- hosted boundary: install dependencies success; cross-layer QA failure; host safety, Windows Rust, production lifecycle, installed E2E skipped; cleanup·summary success; upload skipped; artifact 0
- authenticated read-only failed log: lint/typecheck, Vitest 83 files/366 tests와 Prisma validate PASS 후 `database:registry`가 9개 migration의 Rust registry checksum mismatch로 종료
- root cause/control: Windows CRLF checkout이 raw SQL SHA-256을 변경했다. 첫 migration은 registered LF hash와 CRLF hash가 달랐고, migration-only `text eol=lf` 적용 전 9/9 mismatch, 적용 후 registry PASS
- checkout regression: fresh `core.autocrlf=true` clone에서 일반 source는 CRLF, migration은 `i/lf w/lf`·`text eol=lf`; 최종 5-file fix와 harness control을 적용한 `npm run qa` 전체 exit 0
- timer regression: calendar 1 ms/default 100 ms real timer negative control은 retry model을 stale 처리해 expected 5/actual 0을 재현했다. calendar/dashboard 기본 60 s와 scenario-local 100 ms fake timer 후 focused 2 files/10 tests, full 83 files/366 tests PASS
- `npm run qa`: ESLint, Vue typecheck, Vitest 366, Prisma validate/registry/diff, Rust default 319, Vite production build, Tauri check, harness와 mutation controls PASS
- Rust: all-features 335/335, fmt check, all-target/all-feature Clippy `-D warnings` PASS
- Windows MSVC projection: stable rustup compiler, `x86_64-pc-windows-msvc`, tests/all-features, `RUSTFLAGS=-Dwarnings`, host SQLite pkg-config와 LLVM resource compiler no-link cross type-check PASS
- dependencies: `npm audit --audit-level=high` — vulnerability 0
- actual macOS `BODAM E2E.app`: 승인된 GUI 환경의 `npm run test:e2e` overall exit 0; customer/policy/coverage/benchmark/family/consultation/dashboard/schedule/calendar, restart, XLSX/CSV import/export/round-trip/rollback, backup/restore/reauthorization/exit/idempotency PASS
- expected-process boundary: restore와 exit child WDIO의 process-level FAILED는 의도된 restart/exit이며 상위 runner가 marker, archive, logical DB snapshot과 residue를 대사한 뒤 exit 0
- sandbox-only diagnostic: 최초 GUI 비허용 실행은 app startup SIGABRT로 중단됐고 승인된 실제 GUI 재실행으로 대체했으며 제품 failure evidence로 사용하지 않음
- final checks: migration 9개 모두 attr `text`/`eol=lf`, file line limits 300 미만, sensitive artifact scan, harness review-state validation과 `git diff --check` PASS

## Review Findings

- migration/harness reviewer: P0–P3 0. migration 9개와 미래 중첩 경로에 selective `text eol=lf`가 적용되고 raw-byte registry/runtime invariant, binary fixture, removal mutation과 300-line/privacy 경계가 유지됨을 확인했다.
- timer reviewer: P0–P3 0. `vi.clearAllMocks()`가 구현을 보존하는 경계에서 양쪽 `beforeEach`의 60 s 복구와 scenario-local 100 ms fake timer가 정확하며 focused 10 tests를 5회 반복해 모두 통과했다.
- evidence/privacy reviewer: P0–P3 0. run/job/SHA/attempt, failure·skipped·cleanup·artifact 0과 실제 log root cause를 독립 대사하고 local/hosted, child process/upper runner 경계가 명확함을 확인했다.
- final verdict: PASS with residual risk. 새 exact commit의 hosted Windows production/install/E2E/artifact acceptance는 Plan-016 전까지 NOT RUN이다.

## Completion Notes

- exact run `31141527184`는 cross-layer registry에서 Windows CRLF로 변환된 migration 9개의 raw checksum이 달라 실패했다. 후속 Windows Rust, NSIS lifecycle, installed E2E, upload는 실행되지 않았고 cleanup·summary는 성공했으며 artifact는 0건이다.
- migration SQL만 LF checkout으로 고정하고 하네스 removal mutation을 추가했다. 별도 Windows식 clone에서 재현된 calendar/dashboard real-timer 경쟁도 midnight fake-timer scenario 안으로 격리했다.
- final tree는 local/CRLF full QA, Rust 319/335, fmt/Clippy, Windows MSVC projection, audit 0, 실제 macOS full native E2E와 독립 리뷰 3개를 통과했다.
- 완료된 수정 commit을 main에 반영하면 자동 실행되는 새 exact SHA의 hosted Windows acceptance와 exact production three-file artifact 대사는 Plan-016이 소유한다.
- Authenticode, SmartScreen reputation과 WebView2가 없는 network-blocked clean VM은 계속 별도 권한·환경 범위다.
