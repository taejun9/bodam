# plan-003-insurance-policy-core Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-003-insurance-policy-core.md`
- reviewed tree: `codex/plan-003-insurance-policy-core` worktree before commit
- reviewer roles: 독립 `review_judge`, `privacy_guard`
- review order: 전체 QA PASS 후 1차 리뷰, P1 해결·회귀 검증, 최종 읽기 전용 재리뷰
- reviewed_at: 2026-08-06 KST

## QA Evidence

- 수정 후 `npm run qa`: PASS
- Vitest: 7 files / 20 tests PASS
- Rust default/all-features: 32/32 PASS
- Prisma validate, migration registry/hash, schema diff, runtime history/schema/FK drift: PASS
- `cargo fmt --check`, all-targets/all-features clippy `-D warnings`: PASS
- Python QA harness, negative controls, `npm audit` 0 vulnerabilities, `git diff --check`: PASS
- in-app Browser: 음수 금액 거부, 계약 2건 생성·수정·합계 포함/제외·reload·삭제, Customer 삭제, 390×844 layout와 dialog keyboard flow 확인
- release-mode macOS `BODAM.app`: 두 프로세스 E2E 2/2 PASS, SQLite restart persistence와 soft-delete 확인
- production boundary: 표준 app 재빌드·실행, WDIO/env override/TCP 4445·임시 DB 잔존 없음

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| P1 | Customer A→B route 전환 실패 시 A의 detail·Policy·합계가 남음 | `CustomerInsurancePage.loadPage` 상태 전환 검토 | load 시작 시 이전 상태·dialog를 제거하고 route별 async guard 추가 |

`customer-insurance-page.test.ts`가 A load 성공 뒤 B load 실패 시 A의 고객명·상품·합계가 사라짐을 검증한다. 최종 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding이 없음을 확인했다.

## Requirements Trace

- 승인 범위: 활성 Customer별 InsurancePolicy CRUD, 합계대상 월보험료 합계와 실제 앱 persistence
- 구현 증거: Vue application/repository/UI, Browser adapter, Tauri IPC·Rust SQLite repository, Prisma migration
- 금액 계약: SQLite `INTEGER`/Prisma `BigInt` → IPC decimal string → TypeScript `bigint`; 부동소수점과 파생 합계 저장 없음
- 데이터 계약: active parent, Policy `deletedAt`, Customer soft-delete 시 child 원본 유지·기본 조회 숨김, hard delete FK `RESTRICT`
- migration 계약: version/order/hash/history와 table·column·index·FK runtime drift 검사
- non-goal 준수: Coverage, Family 합계, 증권번호, 특약 breakdown, 외부 통신과 민감 병력 저장을 추가하지 않음

## Privacy Review

- 저장 필드는 승인 프로필의 계약 필드에 한정되며 주민등록번호, 보험사 로그인 정보, 민감·상세 병력은 없다.
- TypeScript와 Rust가 UUID·날짜·Unicode 길이·금액 범위·unknown field를 각각 검증한다.
- validation/repository 오류는 거부값이나 DB 원문 대신 허용된 고정 메시지만 노출한다.
- fixture, Browser, native E2E는 명시적인 합성 데이터와 임시 SQLite만 사용한다.
- production capability에 broad filesystem, shell, network, telemetry 또는 WebDriver가 없다.

## Native Test Note

- 최종 `npm run verify` 중 비-GUI QA는 모두 PASS했지만 첫 WDIO write session이 상세 단계 없이 Jasmine 60초 timeout으로 한 차례 종료됐다.
- 새 임시 DB와 동일 release 코드의 `npm run test:e2e` 재실행은 write 3.8초, restart 2.3초로 2/2 PASS했고 timeout은 재현되지 않았다.
- timeout을 기능 결함으로 뒷받침하는 app/backend 오류나 잔존 process·listener·DB artifact는 발견되지 않았다.

## Residual Risk

- Windows hosted E2E와 x64 NSIS·WebView2 미설치·network-offline VM 설치는 아직 실증하지 않았다.
- 로컬 SQLite는 암호화되지 않아 OS 계정·디스크 보호에 의존한다.
- macOS native GUI 자동화는 sandbox 밖 GUI 권한이 필요하고 WebDriver session 자체의 일시 정지 가능성이 남는다.
- Customer와 InsurancePolicy 이외의 MVP 기능은 후속 계획에서 구현·검증해야 한다.

## Follow-Ups

- 다음 수직 계획에서 Policy별 Coverage와 고객 보장 합계를 구현한다.
- 이후 Family, Consultation, Benchmark, Dashboard, Calendar, Import/Export, Backup/Restore를 작은 승인 계획으로 진행한다.
- 최종 release에서 Windows x64 NSIS와 offline VM 전체 회귀를 수행한다.
