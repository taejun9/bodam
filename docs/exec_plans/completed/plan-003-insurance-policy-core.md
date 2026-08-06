# plan-003-insurance-policy-core

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-06
- 승인 근거: 사용자가 `/goal`로 전체 MVP 완성과 실제 실행 테스트를 지속 목표로 위임했고, plan-002에서 후속 계획에 적용할 기본 운영 프로필을 승인했다.
- 승인 범위: 고객별 InsurancePolicy CRUD, 합계대상 활성 계약의 월보험료 합계, Customer 상세 화면, schema migration, 실제 데스크톱 E2E
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

프로필을 벗어나는 데이터 재해석, 외부 통신, 민감정보 저장은 별도 승인 없이 진행하지 않는다.

## Goal

- 활성 고객 상세에서 보험계약을 생성·조회·수정·soft delete한다.
- 보험사, 상품명, 가입일, 보험기간, 납입기간, 월보험료, 고지플랜, 만기일, 갱신 여부, 계약 상태, 합계 포함 여부를 관리한다.
- 활성·합계대상 계약의 월보험료를 KRW 원 단위 정수로 합산하고 화면에 표시한다.
- Vue application/repository 계약, Browser preview adapter, Tauri IPC/Rust SQLite adapter가 같은 동작을 제공한다.
- 기존 DB를 보존하는 두 번째 Prisma migration과 runtime schema/history drift 검증을 완성한다.
- 합성 데이터로 Browser 화면과 release-mode 실제 앱의 persistence를 검증한다.

## Non-Goals

- 증권번호, 특약별 보험료 breakdown, 갱신주기, 다음 갱신일
- Coverage CRUD·보장 합계·benchmark 판정
- Family 보험료 합계, Dashboard, Calendar, Consultation
- Excel/CSV import/export 또는 원본 workbook 매핑
- Customer 복원 UI와 soft-deleted 부모의 자식 직접 조회 UI
- Windows NSIS·offline VM 검증 완료 주장
- 원격 API, telemetry, cloud sync, broad filesystem·shell·network capability

## Context Map

- `src/features/customer`: 활성 Customer 조회와 상세 화면 진입점
- `src/features/insurance`: 계약 domain, validation, 합계 service, application, repository port/adapters, UI
- `database/prisma`: InsurancePolicy schema와 순서가 고정된 migration artifact
- `src-tauri/src/insurance`: IPC DTO, validation, SQLite repository와 command
- `src-tauri/src/database`: migration registry와 runtime schema/history drift 검사
- `e2e`: 실제 release app의 두 프로세스 persistence 시나리오
- `docs/product/proposed-operating-profile.md`: 승인된 계약·금액·soft-delete 규칙

## Constraints

- `codex/plan-003-insurance-policy-core`와 전용 worktree에서만 구현·검증한다.
- UI는 bigint 합계나 저장 규칙을 계산하지 않고 insurance application 계약을 호출한다.
- domain service는 Vue, Pinia, Router, Tauri, Prisma에 의존하지 않는다.
- 외부 form 입력과 IPC payload를 TypeScript Zod 및 Rust 경계에서 각각 검증한다.
- 월보험료는 KRW 원 단위 비음수 정수이며 SQLite `INTEGER`, Prisma `BigInt`, IPC decimal string, TypeScript `bigint`로 전달한다.
- 금액 `0`은 허용하고 음수·소수·공백·안전 범위를 넘는 값을 거부한다.
- date-only는 `YYYY-MM-DD`, timestamp는 UTC 계약을 유지한다.
- 업무 삭제는 `deletedAt` soft delete이며 FK는 hard cascade하지 않는다.
- soft-deleted Customer의 Policy 원본은 유지하되 기본 목록·합계에서 숨긴다.
- source, migration, 문서는 300줄 전에 책임 단위로 분리한다.
- 실제 고객 데이터와 금지된 민감정보를 source, test, log, screenshot에 넣지 않는다.

## Domain Contract

- 필수: customer, 보험사, 상품명, 월보험료
- 선택: 가입일, 만기일, 보험기간 원문, 납입기간 원문, 고지플랜, 계약 상태
- boolean: 갱신 여부 기본 false, 합계대상 기본 true
- 월보험료는 사용자가 확인한 총 월납입액 한 개이며 특약 breakdown을 두지 않는다.
- Coverage가 없어도 Policy를 생성할 수 있다.
- 고객 월보험료 합계는 해당 활성 고객의 `deletedAt IS NULL AND isIncluded = true`인 활성 Policy만 합산한다.
- 합계는 요청 시 domain service가 계산하고 DB에 파생값으로 저장하지 않는다.

## Implementation Plan

- [x] InsurancePolicy Prisma model과 두 번째 migration 추가
- [x] migration registry/hash와 runtime table·column·index drift 계약 갱신
- [x] Rust InsurancePolicy DTO, 입력 검증, SQLite repository, Tauri commands 구현
- [x] Rust clean/existing DB migration 및 CRUD·합계·soft-delete·부모 숨김 테스트 구현
- [x] TypeScript InsurancePolicy types, Zod schema와 KRW bigint 변환 구현
- [x] 순수 월보험료 합계 service와 application/repository port 구현
- [x] Browser localStorage와 Tauri IPC repository adapter 구현
- [x] Customer 상세 route와 계약 목록·요약·생성·수정·삭제 UI 구현
- [x] loading, empty, validation, adapter error, responsive·keyboard 접근성 상태 구현
- [x] unit/adapter tests와 실제 Browser 회귀 수행
- [x] release-mode 실제 앱 두 프로세스 E2E에 계약 persistence·합계·제외·soft-delete 추가
- [x] 전체 QA와 production boundary 재검증
- [x] QA 이후 독립 리뷰 findings 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`, `npm run typecheck`, `npm run test:unit`
- `npm run prisma:validate`, `npm run database:contract`
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml --all-features`
- `npm run qa`
- in-app Browser에서 Customer 상세 진입, 계약 생성·수정, 합계 포함/제외, 삭제, reload, 390px와 console을 확인
- `npm run verify`로 release-mode 실제 `BODAM.app`을 두 프로세스로 실행해 SQLite persistence를 확인
- E2E용 WebDriver·DB override가 production bundle/capability에 포함되지 않는지 재검사
- `npm audit`, `git diff --check`, 민감정보·SQLite/temp artifact 잔존 검사를 수행

## Acceptance Scenarios

1. 합성 Customer를 만들고 상세 화면으로 이동한다.
2. 필수값 누락, 음수·소수 보험료, 잘못된 날짜가 저장되지 않고 필드 오류로 표시된다.
3. 월보험료가 서로 다른 두 Policy를 만들면 합계가 정확한 KRW 문자열로 표시된다.
4. 한 Policy의 `합계대상`을 끄면 원본은 남고 합계에서만 제외된다.
5. Policy를 수정하면 목록과 합계가 즉시 갱신된다.
6. renderer reload와 앱 재시작 뒤 Policy, 합계대상, 합계가 유지된다.
7. Policy를 soft delete하면 기본 목록과 합계에서 제외되며 DB 행은 남는다.
8. Customer를 soft delete하면 연결 Policy 행은 남지만 기본 조회와 합계에서 숨겨진다.
9. 키보드로 상세 진입·대화상자 제출·Escape 닫기·호출 버튼 초점 복귀가 가능하다.

## Review Plan

QA PASS 뒤 독립 `review_judge`가 다음을 확인한다.

- 승인 필드 외의 보험·민감정보를 저장하지 않는지
- 금액 변환에서 부동소수점, 정밀도 손실, locale 의존이 없는지
- 월보험료 합계가 UI나 repository가 아닌 domain/application 경계에 있는지
- soft-deleted Customer/Policy와 `isIncluded=false`가 목록·합계에서 정확히 제외되는지
- direct IPC가 unknown/missing field, invalid UUID, oversized text, invalid money/date를 거부하는지
- migration history와 runtime schema drift 검사가 기존 DB와 새 DB 모두를 보호하는지
- 오류 문자열, log, fixture, screenshot에 고객·계약 행 값이 노출되지 않는지
- 실제 Browser와 release app 증거가 renderer-only test와 구분되는지

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 `/goal`과 승인 운영 프로필을 plan-003 승인 근거로 기록 | 작은 후속 계획을 연속 진행하라는 승인 범위 안의 핵심 MVP 기능 |
| 2026-08-06 | Customer 목록에서 상세 route로 진입해 Policy를 관리 | 고객과의 FK 및 고객별 합계라는 사용자 질문을 한 화면에 묶기 위함 |
| 2026-08-06 | 금액 IPC를 decimal string으로 고정 | JSON number 정밀도 손실과 부동소수점 계산을 방지하기 위함 |
| 2026-08-06 | 만기일과 가입일의 순서 제약을 추가하지 않음 | 승인 프로필에 해당 재해석 규칙이 없으며 원본 입력을 보존해야 함 |
| 2026-08-06 | 고객 soft delete 시 Policy를 cascade 삭제하지 않음 | 승인 프로필의 부모 원본 유지·기본 조회 숨김 규칙 준수 |
| 2026-08-06 | Browser adapter도 CustomerRepository 조회 port로 활성 부모를 확인 | localStorage 직접 결합 없이 native adapter와 같은 부모 숨김 계약을 보장하기 위함 |
| 2026-08-06 | macOS native E2E는 GUI 권한 경계에서 실행 | sandboxed 재기동은 AppKit 앱 등록 전에 SIGABRT했으나 동일 bundle 직접 실행과 GUI 권한 E2E는 정상 동작함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-002를 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | plan_keeper | plan-003 전용 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | 두 번째 Prisma migration, Rust registry/schema drift와 InsurancePolicy IPC·repository를 구현했다. |
| 2026-08-06 | privacy_guard | decimal-string 금액, strict 입력, active parent, soft-delete와 오류 redaction 경계를 검토했다. |
| 2026-08-06 | quality_runner | Browser와 release BODAM.app 두 프로세스에서 합성 Customer·Policy 흐름을 실행했다. |
| 2026-08-06 | quality_runner | 표준 production bundle을 재빌드·실행해 E2E plugin·DB override·listener 부재를 확인했다. |
| 2026-08-06 | review_judge | route 전환 stale-state P1을 발견하고 수정·회귀 테스트 뒤 최종 PASS를 확인했다. |
| 2026-08-06 | privacy_guard | 저장 필드·오류 redaction·금액·production capability 경계를 독립 검토하고 PASS했다. |
| 2026-08-06 | doc_gardener | completed plan과 동일 번호 review mirror에 QA·심사·잔여 위험을 동기화했다. |

## QA Evidence

- command: 수정 후 `npm run qa`
- result: PASS — lint, strict typecheck, Vitest 7 files / 20 tests, Prisma validate/diff, Rust 32 tests, Vite build, Tauri check와 harness
- command: `cargo test --manifest-path src-tauri/Cargo.toml --all-features`
- result: PASS — 32/32, clean DB와 기존 Customer DB upgrade, registry/history/schema/FK drift, strict IPC, CRUD·soft-delete·부모 숨김
- command: `cargo fmt --check`와 all-targets/all-features clippy `-D warnings`
- result: PASS
- command: `npm audit`, `git diff --check`, Python harness negative/database controls
- result: PASS — npm vulnerability 0건, line/sensitive artifact/migration registry gate 통과
- migration: `20260806010000_add_insurance_policy`, SHA-256 `df3f753cb3b34dfb11363df16946683bc946f82a87fb4893087dbe3ce91dc733`
- in-app Browser: 음수 보험료 거부, 두 Policy 합계 150,000원, 한 건 35,000원 수정·합계 제외 후 120,000원, reload, 포함 Policy 삭제 후 0원, Customer 삭제 후 숨김을 합성 데이터로 확인
- Browser accessibility/layout: dialog 이름·insurer autofocus·Escape·호출 버튼 초점 복귀, 390×844 Policy card와 mobile drawer를 확인
- native E2E process 1: Customer 생성·수정, Policy 두 건 생성, 150,000원 합계, 35,000원 수정·합계 제외, 120,000원과 renderer reload persistence PASS
- native E2E process 2: 새 앱 프로세스에서 두 Policy와 120,000원 재조회, 포함 Policy soft-delete 후 0원, Customer soft-delete 후 active read 숨김 PASS
- 수정 후 native E2E 재실행: `npm run test:e2e` PASS — process 1은 3.8초, process 2는 2.3초에 완료
- transient 기록: 직전 `npm run verify`의 비-GUI QA는 PASS했으나 첫 WDIO session이 상세 단계 없이 Jasmine 60초 timeout으로 한 차례 종료됐다. 새 임시 DB·동일 release bundle 재실행에서 즉시 2/2 PASS했고 재현되지 않았다.
- production boundary: 표준 `BODAM.app` 재빌드·실행, `BODAM_E2E_DB_PATH` override 파일·TCP 4445·WDIO 문자열과 Cargo plugin 없음, app-data migration count 2
- cleanup: E2E temp directory·SQLite/WAL/SHM, workspace SQLite와 listener 잔존 0건

## Review Findings

- 1차 verdict: changes-required
- P1: 같은 Vue detail component에서 Customer route A→B 전환이 실패하면 A의 Customer·Policy·합계가 남아 현재 B route와 섞일 수 있었다.
- resolution: route load 시작 시 Customer·Policy·dialog 상태를 비우고, in-flight list/save/delete가 다른 Customer route를 덮지 않도록 expected Customer guard를 추가했다.
- regression: `customer-insurance-page.test.ts`가 A 성공 뒤 B 실패 시 이전 고객명·상품·합계가 노출되지 않음을 검증한다.
- 개인정보·데이터 경계 독립 리뷰: PASS, 신규 P0–P3 finding 없음.
- 최종 독립 재리뷰: PASS, 해결되지 않은 P0–P3 finding 없음.

## Completion Notes

- 활성 Customer 상세에서 InsurancePolicy 생성·조회·수정·soft-delete와 합계 포함 여부를 사용할 수 있다.
- 월보험료는 SQLite integer, IPC decimal string, TypeScript bigint로 끝까지 정밀도를 유지하며 파생 합계는 저장하지 않는다.
- 기존 Customer DB를 보존하는 두 번째 migration과 history·runtime schema·FK drift gate를 추가했다.
- in-app Browser와 release-mode macOS `BODAM.app` 두 프로세스에서 합성 계약·합계·reload·restart·soft-delete를 실제 조작했다.
- Windows NSIS/offline VM, 로컬 DB 암호화와 Coverage·Family·상담·Dashboard·Calendar·Import/Export·Backup은 후속 계획 범위다.
