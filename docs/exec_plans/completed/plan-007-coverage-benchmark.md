# plan-007-coverage-benchmark

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
- 승인 범위: 사용자 수정 Coverage Benchmark CRUD, 만 나이·성별 기준의 부족/적정/과다 판정, Settings 진입점, schema migration, Browser와 실제 데스크톱 E2E
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

프로필 밖의 권고금액 seed, 성별 enum·wildcard, 자동 추천, 판정 결과 저장, Dashboard 카드 또는 공식 보험 적합성 주장은 별도 승인 없이 진행하지 않는다.

## Goal

- 사용자가 Settings에서 Category·성별·포함 만 나이 구간·적정하한·과다하한 Benchmark를 생성·조회·수정·soft delete한다.
- 같은 활성 Category와 정확히 같은 성별의 활성 나이 구간이 한 살이라도 겹치면 원자적으로 거부한다.
- 고객 보장 합계에 부족·적정·과다·기준 미설정과 적용 기준을 계산해 표시한다.
- Benchmark가 일치하면 Coverage 0건인 Category도 0원으로 평가해 실제 부족을 누락하지 않는다.
- Browser preview와 Tauri/Rust/SQLite가 validation, active-category, overlap, 정렬과 soft-delete 동작을 동일하게 제공한다.
- 기존 v5 데이터를 보존하는 여섯 번째 migration과 runtime history/schema/FK/index drift 검사를 완성한다.
- 합성 데이터로 실제 Browser 화면과 release-mode 앱 두 프로세스의 Benchmark persistence와 판정을 검증한다.

## Non-Goals

- 권고금액 초기 seed, 자동 추천·자동 보정, 공식 보험 권고 또는 적합성 주장
- 성별 enum·별칭·대소문자/NFC 통합·`전체` wildcard, 겹침 우선순위
- Dashboard의 보장 부족 고객 카드, Family 보장 판정, Calendar·Notification
- 판정·고객 나이·합계 cache 또는 DB 저장
- Category 생성·복원, Benchmark 복원·복사·bulk 변경·import/export
- Settings의 Dashboard 기간·건수, theme 설정 화면, backup 경로와 기타 설정
- 상령 계산, 보험 추천, 민감 병력·상세 병력·보험사 로그인 정보
- 원격 API, telemetry, broad filesystem·shell·network capability
- Windows NSIS·WebView2 미설치 offline VM 검증 완료 주장

## Context Map

- `src/features/coverage-benchmark`: Benchmark domain, strict schema, CRUD application/adapters, 만나이·overlap·판정 service와 Settings UI
- `src/features/coverage`: 활성 Category, Customer별 Coverage 합계와 고객 상세 판정 표시
- `src/features/customer`: Customer birthDate·gender와 활성 부모 계약
- `src/features/settings`: `/settings` page와 Benchmark section orchestration
- `database/prisma`: CoverageBenchmark schema와 여섯 번째 migration
- `src-tauri/src/coverage`: Benchmark strict IPC DTO, repository와 commands
- `src-tauri/src/database`: migration registry와 v6 history/schema/FK/index drift 검사
- `e2e`: release app 두 프로세스의 Benchmark CRUD·classification persistence 시나리오

## Constraints

- `codex/plan-007-coverage-benchmark`와 `.worktree/plan-007-coverage-benchmark`에서만 구현·검증한다.
- 활성 계획 승인 범위 안에서 계획 → 구현 → QA → 독립 리뷰 → 완료 계획/review → commit 순서를 지킨다.
- UI는 나이·합계·판정식을 계산하지 않고 coverage-benchmark application/service 결과만 표시한다.
- Benchmark application은 CoverageCategory와 Customer의 공개 application/repository 계약만 사용하고 다른 feature의 Browser storage나 DB table을 직접 읽지 않는다.
- domain service와 validation은 Vue, Router, Tauri, Prisma와 SQLite에 의존하지 않는다.
- 외부 form과 IPC payload를 TypeScript Zod 및 Rust 경계에서 각각 strict 검증한다.
- 금액은 TS `bigint`, IPC canonical decimal string, SQLite signed 64-bit integer로 다루며 float를 사용하지 않는다.
- cross-field CHECK를 표현하지 못하는 Prisma schema와 별도의 SQLite 전용 수동 규칙을 만들지 않고 strict 경계·transaction repository에서 나이·threshold·overlap을 검증한다.
- 업무 삭제는 `deletedAt` soft delete이고 FK는 hard delete `RESTRICT`, key update `CASCADE`다.
- source, migration, 문서는 300줄 전에 책임 단위로 분리한다.
- 실제 고객·보장 행과 금지된 민감정보를 source, test, log, screenshot에 넣지 않는다.

## Domain Contract

- `CoverageBenchmark`: id, categoryId, gender, minAgeYears, maxAgeYears, adequateMinWon, excessiveMinWon, createdAt, updatedAt, deletedAt
- 모든 입력 필드는 필수다. update는 category를 포함한 전체 입력을 교체할 수 있다.
- `gender`는 trim한 필수 plain text이고 Unicode scalar 100자 이내다. Customer.gender의 trim 저장값과 case-sensitive exact match하며 enum·별칭·wildcard를 적용하지 않는다.
- 나이는 정수 `0 ≤ minAgeYears ≤ maxAgeYears ≤ 150`이고 양끝을 포함한다. 0–150은 비정상 입력·손상을 막는 MVP 기술 경계이며 연령 추천 의미가 아니다.
- `adequateMinWon`과 `excessiveMinWon`은 KRW 원 단위 정수이고 `0 ≤ adequateMinWon < excessiveMinWon ≤ i64::MAX`다.
- 같은 활성 `categoryId + gender`에서 `old.min ≤ new.max && new.min ≤ old.max`이면 overlap이다. `[0,19]`와 `[20,29]`는 허용하고 `[0,19]`와 `[19,29]`는 거부한다.
- create/update의 active Category 확인·자기 ID 제외 overlap 확인·write는 한 repository lock/transaction에서 수행한다.
- list는 활성 Benchmark와 활성 Category만 `categoryId, minAgeYears, maxAgeYears, id` 순서로 반환한다. 문자열 locale sort로 adapter 차이를 만들지 않는다.
- Category soft delete는 Benchmark 원본을 수정하지 않고 list·판정에서 숨긴다. Category 복원 시 개별 삭제되지 않은 Benchmark가 다시 노출될 수 있다.
- create의 비활성 Category는 `COVERAGE_CATEGORY_NOT_FOUND`; 기존 Category가 비활성인 Benchmark의 update/delete는 `COVERAGE_BENCHMARK_NOT_FOUND`; overlap은 `COVERAGE_BENCHMARK_CONFLICT`로 값 없이 실패한다.
- 만나이는 명시적으로 주입한 OS-local `referenceDate` date-only를 기준으로 계산한다. 생일 전에는 1을 빼고 생일 당일부터 증가한다.
- 2월 29일 anniversary는 비윤년 2월 마지막 날로 clamp한다. 미래 birthDate, birthDate/gender 누락 또는 exact 성별·나이 구간 불일치는 `기준 미설정`이다.
- 같은 Customer·Category에서 일치 후보가 0개면 기준 미설정, 1개면 적용, 2개 이상이면 손상 오류이며 임의 우선순위를 선택하지 않는다.
- 판정식은 `amount < adequate` 부족, `adequate ≤ amount < excessive` 적정, `amount ≥ excessive` 과다다. 기준 미설정은 부족으로 세지 않는다.
- 표시 집합은 합계대상 활성 Coverage가 있는 Category와 현재 Customer에게 일치 Benchmark가 있는 Category의 합집합이다. 후자에 Coverage가 없으면 0원·0건으로 판정한다.
- 판정 결과·고객 나이·합계는 저장하지 않고 요청 시 계산한다.
- Settings와 고객 상세에는 사용자 설정 비교 기준이며 공식 보험 권고가 아니라는 안내를 항상 표시한다.

## Implementation Plan

- [x] CoverageBenchmark Prisma model과 v6 migration·FK·index 추가, 권고금액 seed 0건 보장
- [x] migration registry/hash와 runtime v0–v6 object·column·index·FK drift 계약 갱신
- [x] clean DB, v5 upgrade 보존, drifted v5 선차단과 Category visibility migration tests 구현
- [x] Rust Benchmark model·strict validation·CRUD commands와 transaction overlap repository 구현
- [x] canonical UUID, scalar gender, integer age, decimal money, threshold·overlap·값 비노출 tests 구현
- [x] TypeScript Benchmark types, Zod schema, repository port와 Browser/Tauri adapters 구현
- [x] 만나이·2/29 clamp·Benchmark 선택·bigint 판정·0원 합집합 순수 service 구현
- [x] Browser/Tauri active Category, not-found/conflict, 정렬과 soft-delete parity tests 구현
- [x] `/settings` route·sidebar와 보장 기준 loading/error/empty/list CRUD UI 구현
- [x] 공식 권고 아님 안내, stable ID action, first-error·Escape·호출 버튼 focus 복귀 구현
- [x] Customer 보장 합계에 네 상태 chip·기준 trace·설정 링크와 Category 삭제 영향 건수 연결
- [x] Settings table/card, 합계 판정 chip과 form/delete dialog의 390px responsive 구현
- [x] unit/adapter/component tests와 in-app Browser 실제 회귀 수행
- [x] release-mode 두 프로세스 E2E에 Benchmark CRUD·reload·restart·classification·soft-delete 추가
- [x] requirements·open questions·data model·README와 운영 안내 정합성 갱신
- [x] 전체 QA와 standard production capability boundary 재검증
- [x] QA 이후 독립 데이터·UI·privacy 리뷰 findings 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`, `npm run typecheck`, `npm run test:unit`
- `npm run prisma:validate`, `npm run database:contract`
- `cargo fmt --check`, all-targets/all-features clippy `-D warnings`, `cargo test --all-features`
- `npm run qa`와 release-mode 실제 앱 `npm run test:e2e`
- 고정 referenceDate에서 생일 전·당일, 2월 29일 clamp, 미래·누락 birthDate와 성별 exact mismatch를 확인
- age·money·threshold·inclusive overlap 경계와 same ID update, 다른 Category/성별, 삭제행 재사용을 확인
- 부족·적정·과다 exact threshold, 기준 미설정과 Coverage 0건·excluded/deleted row를 확인
- in-app Browser에서 Settings CRUD, 고객 판정, reload, first error·Escape·focus 복귀를 확인
- 390×844 layout·긴 Category/gender wrapping·dialog overflow와 dark mode를 확인
- E2E WebDriver·DB override가 표준 production bundle/capability에 포함되지 않는지 재검사
- `npm audit`, `git diff --check`, 민감정보·SQLite/temp artifact 잔존 검사를 수행

## Acceptance Scenarios

1. 기존 v5 Customer·Policy·Coverage·Category·Family·Consultation 행을 보존하며 v6 Benchmark schema로 upgrade된다.
2. 초기 Benchmark seed는 0건이고 활성 Category를 선택해 Settings에서 기준을 생성·조회·수정·soft delete한다.
3. blank/초과 gender, 음수·소수·151·역전 age, noncanonical money, 같거나 역전된 threshold와 unknown/missing IPC field가 양 경계에서 거부된다.
4. inclusive overlap endpoint, 자기 ID 제외 update, 다른 Category·성별, soft-deleted 구간 재사용이 Browser·SQLite에서 동일하다.
5. 생일 전·당일과 2월 29일 clamp로 만나이가 재현되며 미래·누락 birthDate와 null·불일치 gender는 기준 미설정이다.
6. amount 49/50/99/100과 threshold 50/100에서 부족/적정/적정/과다이며 bigint 합계에 float 변환이 없다.
7. Coverage가 0건이어도 일치 기준은 0원으로 판정하고, Coverage는 있으나 기준이 없으면 기준 미설정이며 부족으로 세지 않는다.
8. excluded/deleted Policy·Coverage, deleted Category·Benchmark는 합계·판정에서 제외되고 Category 원본 자식은 보존된다.
9. 이름이 같은 Category도 ID별 Benchmark·합계·action을 구분하고 rename 뒤 ID 결속이 유지된다.
10. Settings와 고객 상세에서 판정 text·근거·공식 권고 아님 안내, loading/error/empty가 보인다.
11. autofocus·첫 오류 focus·Escape·호출 버튼 복귀·삭제 후 존속 focus와 390×844 layout이 동작한다.
12. renderer reload와 새 앱 프로세스 뒤 Benchmark ID·threshold·고객 판정이 유지되고 soft delete 뒤 기본 목록·판정에서 사라진다.

## Review Plan

QA PASS 뒤 독립 데이터 정확성, UI·접근성 reviewer와 `privacy_guard`가 다음을 확인한다.

- 승인 필드 밖 권고·민감·추론 데이터를 저장하거나 공식 보험 기준으로 표현하지 않는지
- age·money·threshold와 inclusive overlap이 TS/Rust/SQLite에서 같고 transaction 안에서 검사되는지
- exact gender, 2월 29일, 0원 category와 기준 미설정이 승인 계약대로 계산되는지
- Browser/Tauri의 active Category, conflict, 정렬, soft-delete와 safe error parity가 같은지
- Customer 상세가 판정을 자체 계산하지 않고 pure application/service 계약만 표시하는지
- Category rename/delete, duplicate name과 Benchmark ID별 action이 원본을 안전하게 유지하는지
- v5 upgrade와 migration history/runtime schema/FK/index drift가 기존 데이터를 보호하는지
- Settings privacy/적합성 안내, dialog focus, responsive와 실제 Browser/release app 증거가 충분한지
- production artifact에 E2E DB override·WebDriver 기능이 남지 않는지

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 `/goal`과 승인 운영 프로필을 plan-007 승인 근거로 기록 | 작은 후속 계획을 연속 진행하라는 승인 범위 안의 Benchmark 핵심 기능 |
| 2026-08-06 | Settings에 global Benchmark CRUD, 고객 상세에는 판정과 설정 링크만 제공 | 승인 프로필의 Settings 소유권을 지키고 고객별 기준으로 오해하지 않음 |
| 2026-08-06 | gender는 trim 후 exact 자유문자열, wildcard·enum 없음 | 현행 Customer 자유입력 계약을 재해석하지 않고 adapter parity 유지 |
| 2026-08-06 | 만나이 0–150 기술 경계와 2/29→비윤년 2월 말 clamp 고정 | 유한 입력·손상 방지와 승인 프로필의 월말 clamp 방향을 재현 가능한 날짜 service로 명시 |
| 2026-08-06 | 일치 Benchmark Category는 Coverage 0건도 0원으로 판정 | 승인 판정식과 Dashboard의 보장 부족 목적에서 실제 무보장을 누락하지 않음 |
| 2026-08-06 | cross-field DB CHECK 대신 strict 양 경계와 transaction 검증 | Prisma schema와 별도 SQLite 전용 규칙을 만들지 않고 기존 architecture 계약 유지 |
| 2026-08-06 | 권고금액 seed와 판정 저장을 하지 않음 | 사용자가 설정한 기준만 적용하고 원본과 파생 결과를 분리 |
| 2026-08-06 | Browser Category·Benchmark mutation에 고정 origin Web Lock과 storage별 queue 적용 | 여러 repository·tab의 localStorage read-modify-write와 active Category 확인을 같은 경계로 직렬화 |
| 2026-08-06 | gender trim을 ECMAScript 집합으로 통일하고 lone surrogate 거부 | Browser와 Rust의 FEFF·U+0085·Unicode scalar 동작을 같게 유지 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-006을 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | repo_cartographer | 승인 프로필, Coverage/Customer, migration, Settings placeholder와 E2E 경계를 병렬로 매핑했다. |
| 2026-08-06 | plan_keeper | plan-007 전용 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | v6 migration·Rust repository와 strict TS core, Settings·Customer UI 및 release E2E를 구현했다. |
| 2026-08-06 | quality_runner | 표준 QA, 실제 Browser CRUD·판정·반응형, release 앱 재기동 E2E와 production 경계를 검증했다. |
| 2026-08-06 | review_judge | 데이터·UI·접근성 독립 리뷰에서 P2 3건과 P3 2건을 발견했다. |
| 2026-08-06 | harness_builder | 공용 Browser lock, Unicode 정렬, 삭제 stable ID, mobile E2E helper와 긴 이름 wrapping을 수정했다. |
| 2026-08-06 | quality_runner | 수정 후 전체 QA, 390px 긴 이름·삭제 ID 화면, release 4+2 E2E와 production 격리를 다시 통과시켰다. |
| 2026-08-06 | review_judge | 수정 diff와 회귀 증거를 재검토해 미해결 P0–P3 finding이 없음을 확인했다. |
| 2026-08-06 | privacy_guard | 승인 필드·safe error·soft delete·capability와 합성 artifact를 검토해 finding 없음으로 판정했다. |
| 2026-08-06 | plan_keeper | review gate와 최종 판정을 확인하고 completed plan·review mirror를 작성했다. |

## QA Evidence

- 수정 후 최종 `npm run qa` — result: PASS. ESLint, vue-tsc, Vitest 31 files/134 tests, Prisma validate, migration registry/hash, Prisma diff, Rust default 93 tests, Vite production build, Tauri check와 base harness를 포함했다.
- `cargo test --manifest-path src-tauri/Cargo.toml --all-features` — result: PASS, 93 tests.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`와 all-targets/all-features Clippy `-D warnings` — result: PASS.
- `npm audit --audit-level=high` — result: PASS, 0 vulnerabilities.
- in-app Browser `http://127.0.0.1:1421` — result: PASS. 합성 Customer·Policy·암 Coverage 12,000,000원을 UI로 생성하고 기준 미설정→적정(12M/20M)→과다(10M/12M)→부족(12,000,001/20M), inclusive overlap 거부, reload 지속성과 삭제 뒤 기준 미설정을 확인했다.
- Browser 접근성·반응형 — result: PASS. category autofocus, threshold 첫 오류 focus, Escape 호출 버튼 복귀, 390×844 dark mode table→card, body/card/dialog 가로 overflow 없음, console warning/error 0을 확인했다.
- 리뷰 수정 뒤 Browser — result: PASS. 390×844에서 70자 무공백 Category 이름 전체가 `anywhere`로 3줄 wrapping되고 body overflow 0, mobile card 표시, 삭제 확인의 Category ID·Benchmark ID 일치와 console warning/error 0을 확인했다.
- Browser 정리 — result: PASS. Benchmark·Coverage·Policy·Customer를 UI로 soft delete해 활성 목록 0건으로 복귀했다.
- 수정 후 최종 `npm run test:e2e` — result: PASS. 실제 macOS release 앱 1차 쓰기 4 scenarios와 별도 2차 프로세스 persistence 2 scenarios가 모두 통과했고 Benchmark ID·threshold·classification·soft delete를 실제 Tauri IPC/SQLite로 검증했다.
- `npm run tauri -- build --bundles app` — result: PASS. E2E 뒤 standard production 앱을 재생성했다.
- standard binary·`BODAM.app`·`dist`와 default Cargo feature tree E2E marker scan — result: PASS, `BODAM_E2E_DB_PATH`, WDIO plugin/server와 `127.0.0.1:4445` 0 matches.
- E2E 임시 SQLite directory는 runner의 `finally`에서 제거됐고 생성 WebDriver log 3개도 삭제했다. `git diff --check`와 source/doc/migration 300줄 한계 — result: PASS.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P2 | Browser Benchmark lock이 repository 인스턴스에만 있어 다중 repository/tab과 Category 삭제 사이 localStorage RMW가 원자적이지 않음 | 고정 origin Web Lock과 storage identity queue를 공용화하고 Category update/delete 및 Benchmark list/CRUD 전체에 적용; 다중 repository·Category 경합 회귀 추가 |
| P2 | TS `trim`·`Array.from`과 Rust `trim`·`chars`가 FEFF/U+0085·lone surrogate에서 불일치 | ECMAScript trim 집합을 Rust에 명시하고 TS lone surrogate를 거부하며 Customer.gender도 동일 정규화; 양 경계 벡터 테스트 추가 |
| P2 | Benchmark 삭제 확인이 중복 Category 이름에서 stable ID를 보여 주지 않음 | Category ID와 Benchmark ID를 확인창에 함께 표시하고 중복 이름 테스트 추가 |
| P3 | native E2E helper가 390px card를 보지 못하고 삭제 0건을 거짓 통과할 수 있음 | visible row/card를 stable ID로 dedupe하고 삭제 0건은 숨은 representation까지 DOM 0건이어야 통과하도록 수정 |
| P3 | 고객 판정의 긴 Category 이름이 nowrap ellipsis로 잘림 | `white-space: normal`과 `overflow-wrap: anywhere`로 전체 표시하고 긴 무공백 이름 UI·실제 390px 회귀 추가 |

수정 후 데이터, UI·접근성, 개인정보·capability 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding이 없음을 확인했다.

## Completion Notes

- v5 데이터를 보존하는 v6 CoverageBenchmark migration, strict Rust/TypeScript CRUD와 Browser/Tauri adapter parity를 완성했다.
- 사용자 설정 기준의 포함 나이·exact gender·bigint 금액으로 부족·적정·과다·기준 미설정을 계산하고 Settings CRUD와 고객 상세 근거 표시를 완성했다.
- Browser의 Category·Benchmark 경합을 origin Web Lock으로 직렬화하고 ECMAScript trim·Unicode scalar 계약을 TS/Rust/Customer.gender에 통일했다.
- 실제 in-app Browser와 macOS release 앱 두 프로세스에서 CRUD, 경계 판정, reload/restart, soft delete, 접근성·390px 반응형을 합성 데이터로 검증했다.
- 독립 리뷰 P2 3건·P3 2건을 모두 해결했으며 최종 데이터, UI·접근성, privacy·capability 재리뷰에 미해결 P0–P3 finding이 없다.
- 표준 production 앱에서 E2E DB override·WDIO/WebDriver 기능이 없고 임시 SQLite·실행 로그가 남지 않음을 확인했다.
