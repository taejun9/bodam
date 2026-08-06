# plan-004-coverage-core

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-06
- 승인 근거: 사용자가 `/goal`로 전체 MVP 완성과 실제 실행 테스트를 지속 위임했고, plan-002에서 후속 작은 Exec Plan에 적용할 기본 운영 프로필 전체를 승인했다.
- 승인 범위: CoverageCategory foundation, Policy별 Coverage CRUD, 고객별 카테고리 보장 합계, schema migration, Browser와 실제 데스크톱 E2E
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

프로필을 벗어나는 데이터 재해석, Benchmark 권고값, 외부 통신 또는 민감정보 저장은 별도 승인 없이 진행하지 않는다.

## Goal

- 활성 Customer의 각 활성 InsurancePolicy에 표준 카테고리와 KRW 금액으로 Coverage를 생성·조회·수정·soft delete한다.
- 승인된 10개 초기 CoverageCategory를 enum이 아닌 수정·soft-delete 가능한 업무 데이터로 제공한다.
- 같은 Customer·Category에 연결된 여러 Coverage를 Policy의 합계대상 여부까지 반영해 `bigint`로 합산한다.
- 제외 Policy의 Coverage 원본은 편집 화면에 유지하되 고객 합계에서는 제외한다.
- Browser preview와 Tauri/Rust/SQLite가 같은 active-parent, validation, soft-delete, 합계 동작을 제공한다.
- 기존 Customer·InsurancePolicy DB를 보존하는 세 번째 migration과 runtime history/schema/FK drift 검사를 완성한다.
- 합성 데이터로 실제 Browser 화면과 release-mode 앱 두 프로세스 persistence를 검증한다.

## Non-Goals

- Coverage Benchmark CRUD, 나이·성별 구간, 부족·적정·과다 판정
- 권고 보장금액 seed 또는 카테고리 전체를 합친 단일 보장 총액
- Coverage 메모, 특약명, 진단·치료·입원·청구·병력 관련 필드
- 보장기간, 피보험자, 증권번호, Coverage별 합계대상·상태
- Category 색상·아이콘·사용자 정렬, 삭제 복원 UI
- CoverageCategory 신규 생성과 import/export mapping
- Family·Dashboard 보장 합계, 원격 API, telemetry, broad capability
- Windows NSIS·WebView2 미설치 offline VM 검증 완료 주장

## Context Map

- `src/features/coverage`: category/coverage domain, validation, 합계 service, application, adapter와 UI
- `src/features/insurance`: Customer별 Policy 목록과 합계대상 원본, 보장 관리 진입점
- `database/prisma`: Category/Coverage schema, 초기 category seed와 세 번째 migration
- `src-tauri/src/coverage`: strict IPC DTO, SQLite repository와 commands
- `src-tauri/src/database`: migration registry와 v3 runtime history/schema/FK drift 검사
- `e2e`: release app 두 프로세스의 Coverage persistence·합계·soft-delete 시나리오
- `docs/product/proposed-operating-profile.md`: 승인된 category·합계·금액·soft-delete 규칙

## Constraints

- `codex/plan-004-coverage-core`와 `.worktree/plan-004-coverage-core`에서만 구현·검증한다.
- UI는 금액 합산·Policy 포함 조건·저장 규칙을 계산하지 않고 coverage application 계약을 호출한다.
- domain service는 Vue, Router, Tauri, Prisma와 SQLite에 의존하지 않는다.
- 외부 form과 IPC payload를 TypeScript Zod 및 Rust 경계에서 각각 strict 검증한다.
- 개별 보장금액은 SQLite `INTEGER`, Prisma `BigInt`, IPC decimal string, TypeScript `bigint`로 전달한다.
- 금액 `0`은 허용하고 음수·소수·공백·leading zero·i64 최대 초과를 거부한다. 합계는 i64를 넘어도 `bigint`로 유지한다.
- 업무 삭제는 `deletedAt` soft delete이고 FK는 hard delete `RESTRICT`, key update `CASCADE`다.
- soft-deleted Customer·Policy·Category의 Coverage 원본은 유지하되 기본 조회와 합계에서 숨긴다.
- Coverage를 생성한 뒤 Policy 관계는 update로 이동하지 않는다.
- source, migration, 문서는 300줄 전에 책임 단위로 분리한다.
- 실제 고객·계약 행과 금지된 민감정보를 source, test, log, screenshot에 넣지 않는다.

## Domain Contract

- `CoverageCategory`: id, name, createdAt, updatedAt, deletedAt
- `Coverage`: id, policyId, categoryId, amountWon, createdAt, updatedAt, deletedAt
- Category 이름은 trim 후 1–100자이며 활성 이름 중복을 자동 병합하거나 금지하지 않는다.
- 승인 seed: 암, 유사암, 뇌혈관, 심혈관, 질병수술, 상해수술, 후유장해, 입원, 간병, 운전자
- seed는 migration에서 한 번만 만들고 삭제·rename 후 앱 시작 때 자동 복원하지 않는다.
- 같은 Policy·Category와 같은 Customer·Category의 여러 Coverage를 허용하고 모두 합산한다.
- 관리 목록은 활성 Customer·Policy·Category·Coverage를 대상으로 하며 Policy `isIncluded=false`도 포함한다.
- 고객 합계는 활성 Customer의 `deletedAt IS NULL AND isIncluded=true` Policy에 연결된 활성 Category·Coverage만 Category ID별로 합산한다.
- `Customer.isManaged`와 자유 입력 Policy status를 합계 제외 조건으로 해석하지 않는다.
- Category 이름이 같아도 ID가 다르면 별도 합계 행으로 유지해 조용히 병합하지 않는다.
- 합계는 요청 시 순수 service가 계산하고 DB에 파생값으로 저장하지 않는다.

## Implementation Plan

- [x] CoverageCategory/Coverage Prisma model과 세 번째 migration·초기 seed 추가
- [x] migration registry/hash와 v0–v3 runtime object·column·index·FK drift 계약 갱신
- [x] clean DB, v2 upgrade 보존, seed 단회성·drift Rust tests 구현
- [x] Rust Category list/update/delete와 Coverage list/create/update/delete repository·commands 구현
- [x] canonical UUID, strict payload, Unicode text, decimal money와 값 비노출 오류 tests 구현
- [x] TypeScript category/coverage types, Zod schema와 wire/domain bigint 변환 구현
- [x] category별 순수 합계 service와 application/repository port 구현
- [x] Browser localStorage adapter와 Tauri IPC adapter parity 구현
- [x] Customer 보장 합계 summary와 Policy 행·card의 접근 가능한 보장 관리 action 구현
- [x] PolicyCoverageDialog의 목록·empty·form·delete·excluded 안내 구현
- [x] 공통 Category 설정 dialog의 rename·영향 안내 soft delete 구현
- [x] loading, validation, adapter error, responsive·keyboard·route async 격리 구현
- [x] unit/adapter/component tests와 in-app Browser 실제 회귀 수행
- [x] release-mode 두 프로세스 E2E에 Coverage 합계·제외·reload·restart·soft-delete 추가
- [x] 전체 QA와 standard production capability boundary 재검증
- [x] QA 이후 독립 리뷰 findings 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`, `npm run typecheck`, `npm run test:unit`
- `npm run prisma:validate`, `npm run database:contract`
- `cargo fmt --check`, all-targets/all-features clippy `-D warnings`, `cargo test --all-features`
- `npm run qa`와 release-mode 실제 앱 `npm run test:e2e`
- in-app Browser에서 category summary, Coverage 생성·수정·삭제, Policy 포함/제외, reload, 390px와 keyboard focus를 확인
- E2E WebDriver·DB override가 표준 production bundle/capability에 포함되지 않는지 재검사
- `npm audit`, `git diff --check`, 민감정보·SQLite/temp artifact 잔존 검사를 수행

## Acceptance Scenarios

1. 기존 v2 DB가 Customer·Policy 행을 보존하며 v3로 upgrade되고 초기 Category 10개가 정확히 한 번 생성된다.
2. 활성 Policy에 Category와 0 이상 원 단위 정수 금액으로 Coverage를 생성한다.
3. 빈 category, 음수·소수·leading zero·범위 초과 금액과 unknown/missing IPC field가 거부된다.
4. 같은 Customer·Category의 여러 Coverage가 건수와 정확한 category 합계로 표시된다.
5. 서로 다른 Category는 별도 합계 행이고 Category 이름이 같아도 ID별로 조용히 합치지 않는다.
6. `isIncluded=false` Policy Coverage는 관리 dialog에 남지만 고객 합계에서 제외되고 다시 포함하면 재반영된다.
7. Coverage Category·금액 수정과 Coverage soft delete가 목록·건수·이전/새 합계에 즉시 반영된다.
8. Category rename은 연결 Coverage 표시에 반영되고 soft delete는 영향 확인 뒤 자식 원본을 남긴 채 조회·합계에서 숨긴다.
9. 개별 i64 최대 Coverage 여러 건의 합계가 i64를 넘어도 TypeScript bigint로 손실 없이 표시된다.
10. renderer reload와 새 앱 프로세스 뒤 Coverage, Category rename, Policy 포함 여부와 합계가 유지된다.
11. Customer·Policy·Category·Coverage soft-delete 시 자식 행은 남고 active read·합계에서 승인 규칙대로 숨겨진다.
12. dialog autofocus·첫 오류 focus·Escape·호출 버튼 focus 복귀와 390px layout이 동작한다.

## Review Plan

QA PASS 뒤 독립 `review_judge`와 `privacy_guard`가 다음을 확인한다.

- 승인 필드 밖의 특약·병력·메모·Benchmark 정보를 저장하지 않는지
- 금액·합계에 number/float/i64 overflow·locale 의존·UI 계산이 없는지
- Category ID별 다건 합계와 Policy `isIncluded` 조건이 모든 adapter에서 같은지
- soft-deleted Customer·Policy·Category·Coverage의 원본 유지와 숨김 규칙이 같은지
- Category 삭제 영향이 사용자에게 보이고 seed가 자동 재생성되지 않는지
- direct IPC가 unknown/missing field, invalid UUID/text/money를 거부하고 값 원문을 노출하지 않는지
- v2 upgrade와 migration history/runtime schema/FK drift가 기존 데이터를 보호하는지
- 실제 Browser/release app 증거와 production capability boundary가 정확한지

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 `/goal`과 승인 운영 프로필을 plan-004 승인 근거로 기록 | 작은 후속 계획을 연속 진행하라는 승인 범위 안의 핵심 MVP 기능 |
| 2026-08-06 | Category foundation·rename/delete와 Coverage CRUD·고객 합계를 한 수직 계획으로 구성 | Category 없이 Coverage가 유효할 수 없고 실제 합계까지 있어야 사용자 질문에 답할 수 있음 |
| 2026-08-06 | Category 신규 생성·복원은 후속으로 두고 승인 seed를 한 번만 제공 | 프로필이 명시한 초기 Category 수정·삭제까지만 구현하고 미승인 관리 규칙을 확대하지 않음 |
| 2026-08-06 | Coverage 금액 0을 허용하고 음수·비정수·i64 초과를 거부 | 빈 값과 명시적 0을 구분하면서 plan-003의 KRW 저장 경계와 SQLite 범위를 일치시킴 |
| 2026-08-06 | Category 이름 중복을 금지하거나 자동 병합하지 않음 | 대소문자·Unicode 중복 정책을 추측하지 않고 원본 ID별 의미를 보존함 |
| 2026-08-06 | 사용 중 Category soft delete 시 연결 Coverage를 숨기되 원본을 유지 | 승인 프로필의 부모 soft-delete 공통 규칙을 따르고 영향 건수를 확인 UI에 표시함 |
| 2026-08-06 | 고객 합계에서 Customer 관리대상·Policy status를 해석하지 않음 | 승인된 합계 제외 조건은 soft delete와 Policy 합계대상뿐임 |
| 2026-08-06 | `.gitignore`의 test coverage 경로를 `/coverage/`로 고정 | 기존 `coverage/` 패턴이 실제 `src/features/coverage` 소스까지 숨기므로 루트 산출물만 제외함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-003을 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | repo_cartographer | Coverage 데이터·화면·privacy 경계를 병렬로 읽기 전용 매핑했다. |
| 2026-08-06 | plan_keeper | plan-004 전용 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | 세 번째 migration, seed, v0–v3 drift와 strict Coverage Rust IPC·repository를 구현했다. |
| 2026-08-06 | review_judge | TypeScript bigint 합계, Browser/Tauri adapter parity와 12개 Coverage 계약 테스트를 구현했다. |
| 2026-08-06 | privacy_guard | 합계·Category·Policy Coverage UI와 반응형·접근성 상태를 구현했다. |
| 2026-08-06 | quality_runner | WebKit select change 누락과 Policy action selector 회귀를 진단·수정해 native E2E 2/2를 통과시켰다. |
| 2026-08-06 | quality_runner | in-app Browser에서 CRUD, 합계 제외·재포함, reload, 390px와 keyboard focus를 실제 조작했다. |
| 2026-08-06 | quality_runner | 비동기 dialog 초기 focus 결함을 발견해 수정하고 Browser와 native E2E로 재검증했다. |
| 2026-08-06 | review_judge | 금액 공백 허용, 비-BMP 길이, 중복 Category 식별과 삭제 E2E 오탐 finding을 제기하고 수정 후 최종 PASS했다. |
| 2026-08-06 | privacy_guard | 승인 필드·오류 메시지·합성 fixture·production capability 경계를 검토하고 P0–P3 finding 없이 PASS했다. |
| 2026-08-06 | plan_keeper | QA·독립 리뷰 증거를 기록하고 plan-004를 completed로 이동했다. |

## QA Evidence

- command: 최종 수정 후 `npm run qa`
- result: PASS — lint, strict typecheck, Vitest 11 files / 35 tests, Prisma validate/diff, Rust 46 tests, Vite production build, Tauri check와 harness
- command: `cargo test --manifest-path src-tauri/Cargo.toml --all-features`
- result: PASS — 46/46, clean DB·v2 upgrade·seed 단회성, registry/history/runtime schema/FK drift, strict IPC, CRUD·soft-delete·active-parent visibility
- command: `cargo fmt --check`와 all-targets/all-features clippy `-D warnings`
- result: PASS
- command: `npm audit --audit-level=low`, `git diff --check`, harness sensitive/line/migration controls
- result: PASS — npm vulnerability 0건, workspace SQLite/WAL/SHM와 디버그 temp 잔존 0건
- migration: `20260806020000_add_coverage`, SHA-256 `9b105aafa8df7f5f4b7bc6b04504286305dc9e66f5cccb951fb989deab0e4ef7`
- in-app Browser: 합성 Customer·Policy에서 Coverage 50,000,000원 생성, 55,000,000원 수정, Policy 합계 제외 시 0원·재포함 시 복원, reload persistence, Coverage soft delete 후 합계 숨김 PASS
- Browser accessibility/layout: form autofocus, 비동기 list autofocus 수정, Escape·호출 버튼 focus 복귀, 390×844 card·하단 dialog, 가로 overflow 0과 console warning/error 0건 확인
- native E2E process 1: Customer·Policy 생성 뒤 Coverage 다건 생성, Category 합계·rename, Policy 제외, Coverage 수정과 renderer reload persistence PASS
- native E2E process 2: 새 앱 프로세스에서 Coverage·Category rename·Policy 제외 상태 재조회, Coverage·Category·Policy·Customer soft delete active-read 규칙 PASS
- 최종 native E2E: `npm run test:e2e` PASS — 중복 이름 Category의 ID별 합계·action 구분과 삭제 후 재진입 검증을 포함해 process 1은 37.5초, process 2는 3.9초에 완료
- production boundary: feature 없는 표준 `BODAM.app` 재빌드 PASS, binary에 `BODAM_E2E_DB_PATH`·WDIO·WebDriver 문자열 없음, production capability는 `core:default`만 허용
- cleanup: 진단용 임시 DB directory와 WDIO log/screenshot을 삭제했으며 E2E runner temp DB도 종료 시 제거됨

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P2 | TypeScript form이 금액을 trim해 공백 포함 입력을 domain 계약과 달리 허용 | 원문을 그대로 정규식 검증하고 공백·탭·개행 회귀 테스트 추가 |
| P3 | HTML `maxlength=100`이 UTF-16 code unit을 세어 비-BMP Unicode scalar 100자를 조기에 차단 | DOM 한도를 200으로 조정하고 Zod/Rust의 Unicode scalar 100자 계약 유지 |
| P2 | 이름이 같은 활성 Category의 선택·합계·action이 시각적·접근성 이름으로 구분되지 않음 | 중복 이름일 때만 전체 안정 Category ID를 모든 관련 표면에 표시하고 component/native E2E 추가 |
| P2 | Category 삭제 E2E가 delete 확인 화면에서 목록 DOM이 사라진 것을 실제 삭제로 오인할 수 있음 | 목록 복귀 대기와 dialog 재진입 후 대상 부재 검증으로 강화하고 Coverage 삭제에도 같은 원칙 적용 |

수정 뒤 정확성, UI/접근성, 개인정보 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding 없이 모두 PASS했다.

## Completion Notes

- 기존 Customer·InsurancePolicy 데이터를 보존하는 v3 migration과 수정·soft-delete 가능한 표준 CoverageCategory 10개를 추가했다.
- Policy별 Coverage CRUD, Category ID별 `bigint` 고객 합계, Policy 합계 포함/제외와 Browser/Tauri 저장소 parity를 완성했다.
- 실제 in-app Browser와 release-mode macOS 앱 두 프로세스에서 생성·수정·제외·재포함·reload·restart·soft-delete·390px·keyboard 흐름을 합성 데이터로 검증했다.
- QA와 세 독립 관점 리뷰를 통과했고, 표준 production 앱을 다시 빌드해 E2E 전용 DB override·WebDriver 기능이 포함되지 않았음을 확인했다.
