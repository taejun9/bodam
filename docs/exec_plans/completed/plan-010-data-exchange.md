# plan-010-data-exchange

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-06
- 승인 근거: 사용자가 `/goal`로 전체 MVP 완성과 실제 실행 테스트를 지속 위임했고, plan-002에서 후속 작은 Exec Plan에 적용할 운영 프로필 전체를 승인했다.
- 승인 범위: 승인된 21열 `.xlsx`/`.csv` 계약 가져오기, 명시적 Customer 결정, duplicate skip/update/create, 선택 행 원자 반영, Browser UI와 실제 release Tauri 검증
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

내보내기·backup·restore와 운영 프로필 밖의 새 도메인 의미는 별도 계획으로 남긴다. 파일·행·cell 기술 상한, duplicate 정규화, 원본 보존 수명주기와 update 범위는 아래 계약과 Decision Log에 고정한다.

## Goal

- `/data-exchange`에서 사용자가 고른 계약조회 `.xlsx` 또는 `.csv`를 원본 수정 없이 parse → normalize → validate → preview한다.
- 유효한 각 행에 기존/새 Customer와 create/skip/update/separate-create 결정을 명시적으로 받아 선택 행 전체를 한 transaction으로 반영한다.
- G/H/J/K/N/R/T를 InsurancePolicy로 mapping하고 21개 원본 text/null을 이름 있는 1:1 source record로 보존한다.
- 보험사+증권번호 duplicate를 재현하고 동시 변경 시 조용히 잘못 반영하지 않는다.
- 합성 파일로 Browser 화면과 release-mode Tauri 실제 dialog·SQLite commit·rollback·restart를 검증한다.

## Non-Goals

- Excel/CSV export, `.xls`, PDF, 인쇄·페이지 설정, 파일 원본 수정·덮어쓰기
- Customer 이름 자동 matching/merge, 계약자·피보험자 자동 선택, 승인되지 않은 관계·보장·가족 import
- 정상 행 자동 부분 반영, background import, drag and drop, 여러 파일 동시 처리, remote upload·sync·telemetry
- 수동 생성 Policy의 증권번호 입력 UI, source 수정 UI, soft-deleted source 복원·purge UI
- Browser runtime의 실제 파일/SQLite parity; Browser는 화면 계약을 검증하고 실제 import는 Tauri desktop에서 수행
- 실제 고객 workbook, 실사용 행·경로·계약 식별값을 fixture·문서·log·screenshot에 복사

## Context Map

- `src/features/data-exchange`: 21열 계약, Zod normalize/validate/map, application, preview/decision/result UI, Tauri adapter
- `src/features/customer`, `src/features/insurance`: 활성 Customer 조회와 transaction용 crate-private insert/update helper
- `src/app/router`, `src/app/shell`: `/data-exchange`와 데이터 관리 sidebar 진입점
- `src-tauri/src/data_exchange`: pathless dialog/parse command, strict commit DTO, duplicate query와 transaction coordinator
- `database/prisma`, `database/migrations`, `src-tauri/src/database`: PolicyImportSource v8 schema·migration·검증
- `tests/fixtures/synthetic`, `e2e`: 합성 21열 workbook/CSV와 native write/rollback/restart scenario
- `docs/architecture/import-export.md`, product/open-questions, privacy/quality, README: 승인 상태와 구현 경계 정합화

## Constraints

- `codex/plan-010-data-exchange`와 `.worktree/plan-010-data-exchange`에서만 구현·검증한다.
- 계획 → 구현 → QA → 독립 리뷰 → 완료 plan/review → commit 순서를 지킨다.
- source·문서·migration은 300줄 전에 책임 단위로 분리한다.
- UI는 workbook parsing, 날짜·금액 mapping, duplicate 판단과 transaction을 소유하지 않는다.
- 파일 처리와 DB 작업은 async Tauri command의 blocking worker에서 실행하고 main/UI thread를 막지 않는다.
- Rust dialog가 직접 선택한 파일만 읽고 IPC는 임의 path를 받지 않는다. `fs:*`, shell, process, network capability를 추가하지 않는다.
- parser/preview와 commit 사이 DB 상태를 다시 검사하며 원본 파일을 임시 복사하거나 앱 data에 보관하지 않는다.
- 오류·log에는 format, sheet, source row, field, error code만 두고 전체 경로·cell value·Customer/Policy 식별값은 넣지 않는다.

## File Contract

- Excel은 OOXML `.xlsx`, CSV는 `.csv`만 허용한다. 확장자와 signature/encoding을 함께 검사하고 basename만 UI에 표시한다.
- 파일 byte 상한은 10 MiB다. XLSX archive는 entry 1,000개, 단일 uncompressed entry 20 MiB, 합계 50 MiB를 넘으면 parse 전에 거부한다.
- XLSX shared-string item은 최대 105,021개이고 대상 sheet에서 해석한 문자열 출현의 UTF-8 합계는 header를 포함해 20 MiB 이하여야 한다. ZIP entry 이름은 Calamine과 같은 `\\`→`/`·ASCII lowercase key가 충돌하면 거부하며, shared-string 예약과 논리 text 합계는 소유 preview를 만들기 전에 검사한다.
- data row는 header 뒤 완전히 빈 행을 제외해 최대 5,000개, 각 source cell은 최대 4,000 Unicode scalar다. 초과는 전체 file error다.
- Excel sheet는 NFC 비교로 정확히 `계약조회(엑셀변환)_장기`여야 한다. 다른 sheet는 무시하고 대상 sheet 부재·중복은 거부한다.
- header는 A:U의 `No, 수금반영일, 소속, 담당자, 수금인코드, 계약, 보험사, 상품명, 증권번호, 계약일자, 상태, 최종납월, 납입회차, 납입보험료, 계약자, 피보험자, 보험시기, 보험종기, 수금방법, 납기, 원모집자명` 순서다.
- header는 각 cell을 NFC로 비교하되 표기·순서가 다르거나 A:U 밖에 data가 있으면 거부한다. 추가 workbook sheet 자체는 허용한다.
- 채워진 Excel cell은 string만 허용한다. formula, number, boolean, date/error cell은 source row·field 오류이고 blank는 null이다.
- archive의 모든 worksheet part는 `sheetData` raw cell shape를 먼저 검사한다. shared-string index는 빈 값 또는 checked ASCII decimal, type 없는 value는 numeric, inline text는 `t="inlineStr"`+`is`, formula string은 단일 flat `v`여야 하며 Calamine의 잘못된 문자열 보정·마지막 값 덮어쓰기는 file error다. 다른 sheet의 업무 값은 가져오지 않지만 안전하지 않은 worksheet 구조는 workbook 전체에서 거부한다.
- CSV는 UTF-8 BOM 필수, comma delimiter, CRLF record ending, RFC 4180 quoting과 정확한 21 field count를 요구한다. 잘못된 UTF-8·LF-only·중복 BOM을 거부한다.
- 완전히 빈 data row는 조용히 저장하지 않되 실제 source row number는 이후 오류와 stable order에 유지한다. data row가 없으면 file error다.

## Row and Mapping Contract

- parser DTO는 21개 header별 `string | null`, source row, file format만 가진 strict object다. raw JSON blob이나 위치 기반 array를 feature 경계 밖으로 전달하지 않는다.
- raw source text는 byte decoding 뒤 그대로 보존하고 domain mapping만 ECMAScript trim+NFC를 사용한다. duplicate 비교도 trim+NFC, case-sensitive다.
- G 보험사와 H 상품명은 trim 뒤 필수 1–200자, K 상태와 T 납기는 blank→null이고 최대 200자다.
- J 계약일자와 R 보험종기는 blank→null 또는 실제 `YYYY-MM-DD`다. B 수금반영일과 Q 보험시기도 값이 있으면 같은 날짜 계약을 검증한다.
- L 최종납월은 blank 또는 실제 `YYYYMM`, M 납입회차는 blank 또는 ASCII digit text다.
- N 납입보험료는 필수 ASCII digit text다. 앞자리 0인 raw text는 유지하고 domain 값은 0 이상 SQLite signed 64-bit 범위의 원 단위 bigint로 만든다.
- mapping은 G→insurer, H→productName, J→joinedOn, K→status, N→monthlyPremiumWon, R→maturesOn, T→paymentTerm이다.
- 새 Policy의 미매핑 필드는 `coverageTerm=null`, `disclosurePlan=null`, `renewable=false`, `isIncluded=true`다.
- 행 오류는 source row, header field, stable error code와 안전한 한국어 설명을 제공한다. invalid 행은 선택·commit할 수 없다.

## Source Persistence and Privacy Contract

- v8 `insurance_policy_import_sources`는 Policy와 1:1인 `policy_id` PK/FK, 위 21개 nullable named text column, created/updated timestamp를 가진다. duplicate용 policy number도 이 named column에서 읽는다.
- 21열 보존 목적은 재업로드 duplicate 판정과 plan-011의 같은 열 계약 export이며 분석·검색용 raw lake가 아니다.
- 원본 21열은 pre-commit expandable preview에서만 표시한다. Plan-010은 저장 뒤 별도 source 조회·수정 UI를 만들지 않는다.
- source는 parent Policy 수명 동안 보존하고 Policy soft delete 또는 Customer soft delete 시 기본 조회·duplicate·향후 export에서 숨긴다. 복원 시 그대로 다시 포함한다.
- source는 Policy update import 때 21열 전체를 교체하며 별도 삭제·hard cascade를 제공하지 않는다. 향후 SQLite backup에는 DB와 같은 민감도로 포함한다.
- 실제 workbook bytes·전체 경로는 선택 session memory에서만 읽고 preview 교체·성공·route unmount 때 해제한다.

## Customer and Duplicate Contract

- create/separate-create 행은 활성 기존 Customer ID 또는 page-level 새 Customer definition의 client key를 반드시 고른다.
- 새 Customer definition은 사용자가 1–4,000 Unicode scalar 이름을 직접 입력·확정한다. 계약자/피보험자는 참고로만 표시하고 explicit copy action 전에는 prefill·matching하지 않는다.
- 같은 client key를 여러 행이 고르면 transaction에서 Customer를 한 번만 만든다. 새 Customer는 이름 외 필드 null, `isManaged=true`다.
- duplicate key는 현재 활성 Policy의 trim+NFC insurer와 source의 trim+NFC 증권번호가 모두 같은 경우다. 빈 증권번호, source 없는 수동 Policy, soft-deleted Policy/Customer는 후보가 아니다.
- 비교는 case-sensitive이고 DB unique constraint를 두지 않는다. separate-create와 복원으로 같은 key가 여러 개 존재할 수 있다.
- DB 후보가 있으면 default skip이다. update는 stable Policy ID를 정확히 선택하고 target Customer를 보존하며 7개 mapped field와 source snapshot만 교체한다.
- update는 `coverageTerm`, `disclosurePlan`, `renewable`, `isIncluded`, 기존 Coverage와 Customer 관계를 보존한다. skip은 Customer/source를 만들거나 바꾸지 않는다.
- 한 파일 안 같은 nonblank key는 source row가 가장 작은 행만 initial create이고 뒤 행은 batch duplicate로 default skip한다. 사용자는 뒤 행을 separate-create할 수 있다.
- commit 직전 새 duplicate·삭제·수정이 발견되면 implicit create/update하지 않고 전체 conflict rollback 후 preview refresh를 요구한다.

## Transaction and UI Contract

- preview는 파일 read/parse 뒤 active Customer와 duplicate candidate snapshot을 조합하지만 DB write transaction을 오래 열지 않는다.
- commit request는 selected valid rows, raw 21열, mapped DTO, decision, exact duplicate target, new-Customer definitions를 가진 strict object다.
- Rust는 raw에서 mapping을 다시 만들고 UI supplied mapped 값과 일치하는지, active Customer/target과 duplicate snapshot이 유효한지 검사한다.
- 하나의 `BEGIN IMMEDIATE`에서 새 Customer를 client key별 생성하고 Policy create/update와 source insert/replace를 source row ASC로 수행한다. 어느 한 단계라도 실패하면 모두 rollback한다.
- result는 created/updated/skipped/unselected/invalid count와 source-row별 안전한 outcome을 반환한다. commit 재시도는 duplicate 재조회 뒤 명시적 결정을 다시 요구한다.
- page는 privacy notice, select/cancel/error/loading, valid/invalid summary, row selection, expandable 21열 detail, Customer resolution, duplicate decision, commit confirmation/result를 제공한다.
- commit은 write 행이 하나 이상이고 모든 required decision이 끝나야 활성화한다. stale request가 새 preview/result를 덮지 않고 파일 재선택·route 이탈 시 pending 상태를 폐기한다.
- desktop은 21열 table 내부만 가로 scroll하고 390×844에서는 row card/detail을 사용해 document horizontal overflow를 만들지 않는다.
- field error summary에서 최초 오류로 이동하고 dialog Escape, autofocus, trigger focus return, semantic table/form/fieldset/status와 색 비의존 state를 제공한다.
- Browser runtime은 desktop-only 안내와 동일 page shell을 표시한다. component/application test는 injected synthetic port로 preview·decision 전체 UI를 검증한다.

## Implementation Plan

- [x] 승인된 import 범위와 product/technical/QA repository map을 active plan에 고정
- [x] import-export/open-questions/privacy/quality/README의 승인·구현 상태 정합화
- [x] Rust 1.88 MSRV, calamine/quick-xml/fast-float2/csv/unicode-normalization/dialog과 test-only XLSX writer 의존성 고정·감사
- [x] 21열 constants/types/Zod normalize·validate·mapping·safe error service 구현
- [x] pathless native dialog, XLSX archive preflight와 Excel/CSV parser command 구현
- [x] Prisma v8 source model/migration/registry/schema verifier와 clean/upgrade/drift tests 구현
- [x] Customer/Insurance transaction helper와 shared connection boundary를 분리하고 단건 회귀 유지
- [x] duplicate snapshot과 strict atomic import coordinator, rollback/TOCTOU tests 구현
- [x] Tauri adapter/application, composition singleton, `/data-exchange` route와 sidebar link 구현
- [x] preview/row detail/customer/duplicate/commit/result responsive UI와 accessibility tests 구현
- [x] 합성 XLSX/CSV golden·invalid fixture와 native E2E import/rollback/restart scenario 구현
- [x] 전체 자동 QA와 실제 Browser responsive UI, release app dialog·commit·restart 검증
- [x] QA 뒤 독립 domain/data, UI/accessibility, privacy/capability 리뷰와 finding 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- lint, typecheck, targeted/full Vitest, production build, Prisma validate와 migration registry/hash/diff
- Rust default/all-features tests, fmt, all-targets/all-features Clippy `-D warnings`, dependency audit
- exact/NFD/wrong sheet/header/order/extra column, formula/non-text/blank, dates/YYYYMM/digits/i64와 10 MiB/5,000-row/archive bounds
- forged shared-string `uniqueCount`, 실제 item 105,021개, 반복 참조 logical UTF-8 20 MiB와 case/backslash ZIP name collision bounds
- malformed·negative·overflow shared index, implicit numeric text coercion, inline/type mismatch와 `t="str"` nested/last-value overwrite raw worksheet tests
- CSV BOM/CRLF/RFC 4180 comma·quote·embedded newline와 invalid UTF-8/field count tests
- raw leading zero·long/hyphen identifier 보존, 21 named source persistence와 mapped Policy parity
- existing/new/shared Customer, batch/DB duplicates, skip/update/separate-create, multiple target와 update preservation tests
- invalid selected DTO, mapped tamper, second-row failure, parent delete와 duplicate TOCTOU에서 Customer/Policy/source 전체 rollback
- v7→v8 upgrade data 보존, clean install/idempotence/drift-before-mutation, soft-delete visibility·restore
- Browser desktop/390px dark/light, internal scroll/no document overflow, keyboard/focus/Escape, stale/cancel/error/retry, console warn/error 0
- release app synthetic XLSX와 CSV preview→commit, invalid rollback, 별도 process restart persistence와 default skip 재업로드
- E2E-only path seam이 임시 runtime/합성 파일로 제한되고 standard production binary/capability에 marker가 없는지 검사
- 실제 native open dialog의 filter/cancel/select와 원본 byte 불변을 Computer Use로 확인
- `npm run qa`, `npm run test:e2e`, production bundle, `npm audit`, `git diff --check`, 300줄·민감정보·artifact scan

## Acceptance Scenarios

1. sidebar `/data-exchange`가 privacy 안내와 `.xlsx`/`.csv` native selector를 제공하고 cancel은 DB와 원본을 바꾸지 않는다.
2. 정확한 21열 synthetic Excel/CSV가 raw text/null, source row와 mapped 7개 field를 손상 없이 preview한다.
3. wrong sheet/header, formula/non-text, 날짜·YYYYMM·금액·한도 오류는 row/field/code로 보이고 실제 cell 값은 log에 없다.
4. 기존 Customer와 사용자가 직접 만든 shared Customer definition을 행별로 명시 선택하며 이름으로 자동 병합하지 않는다.
5. 보험사+증권번호 후보는 default skip이고 exact update와 separate-create를 구분하며 blank 번호는 duplicate가 아니다.
6. update는 target Customer·수동 field·Coverage를 유지하고 mapped 7개와 21열 source만 바꾼다.
7. 선택 행 중 하나의 검증·부모·duplicate 상태가 달라지면 새 Customer, Policy, source 모두 0건 rollback한다.
8. 성공 결과 count와 고객 상세 Policy 값이 일치하고 21열 source가 SQLite v8에 이름 있는 column으로 보존된다.
9. release 앱을 종료해 새 process로 열어도 Customer/Policy/source가 유지되고 같은 파일 재업로드는 default skip이다.
10. 390×844, keyboard, focus, dark/light와 file/error/preview/result 상태가 overflow·console error 없이 동작한다.

## Review Plan

QA PASS 뒤 independent domain/data, UI/accessibility와 privacy/capability reviewer가 승인 범위, parser parity, 원자성, duplicate TOCTOU, source 최소 목적·수명, pathless dialog, responsive/focus와 실제 native 증거를 확인한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | plan-010은 안전한 계약 import만 구현하고 export는 plan-011로 분리 | 작은 수직 범위에서 데이터 손실·원자성·실제 파일 검증을 먼저 닫음 |
| 2026-08-06 | 21개 raw text/null을 Policy 1:1 named source table에 보존 | 재업로드 key와 같은 열 export 값을 잃지 않되 목적·표시·수명·backup 경계를 제한 |
| 2026-08-06 | update는 Customer와 수동 field를 보존하고 7개 mapped field/source만 교체 | 이름 자동 관계 변경과 기존 보장·사용자 수정 손실 방지 |
| 2026-08-06 | 새 Customer는 page-level client key와 직접 확정한 이름으로 생성 | O/P 자동 추론 없이 여러 계약이 한 명을 명시적으로 공유 가능 |
| 2026-08-06 | duplicate는 active current insurer + source policy number의 trim/NFC, case-sensitive 비교 | 승인 key를 현재 Policy 상태와 재현하며 separate-create를 unique constraint로 막지 않음 |
| 2026-08-06 | 10 MiB/5,000 rows/4,000 scalar, XLSX archive·shared-string 105,021 item·logical text 20 MiB 상한 적용 | 정상 업무 파일을 수용하면서 desktop memory·zip bomb·반복 참조·IPC 남용을 유한하게 제한 |
| 2026-08-06 | Rust calamine/csv parser와 native Rust dialog를 사용하고 Browser file parity는 제외 | 경로·broad fs capability와 대형 Browser Excel dependency 없이 desktop offline 경계 유지 |
| 2026-08-06 | commit에서 raw mapping과 duplicate를 재검증하고 한 immediate transaction 사용 | WebView payload tamper와 preview 이후 TOCTOU에서 조용한 partial write 방지 |
| 2026-08-06 | E2E feature의 import path와 source-row 실패 seam을 임시 합성 파일·DB로 제한 | 실제 release command·rollback·restart를 자동화하되 표준 binary에는 우회 marker를 포함하지 않음 |
| 2026-08-07 | 모든 worksheet의 `sheetData` raw cell type/payload를 Calamine 전에 검증 | 비숫자 shared index의 0번 alias, implicit numeric 문자열 보정, inline type 혼동과 복수 `t=str` 값 덮어쓰기를 source fidelity 위반으로 fail closed |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-009를 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | repo_cartographer | 승인 product 계약, Rust/SQLite 경계, 실제 Browser/native QA와 fixture 요구를 병렬 조사했다. |
| 2026-08-06 | plan_keeper | plan-010 전용 branch/worktree와 승인된 import-only 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | strict XLSX/CSV parser, v8 named source migration, snapshot/atomic coordinator와 E2E 전용 제한 seam을 구현했다. |
| 2026-08-06 | quality_runner | 합성 XLSX/CSV, 21열 DB exact value, SHA-256 불변, restart와 후속 행 rollback을 release 앱 15개 E2E로 통과했다. |
| 2026-08-06 | quality_runner | 실제 Browser 1280/390 dark/light에서 문서 overflow와 console 오류를 검사하고 모바일 메뉴 Escape 결함을 수정·재검증했다. |
| 2026-08-06 | review_judge | 실제 E2E에서 tagged enum camelCase IPC와 390px global min-width 결함을 발견해 회귀 테스트와 수정으로 닫았다. |
| 2026-08-07 | privacy_guard | ZIP 실제 해제량, shared-string 예약·반복 참조, normalized entry 충돌과 Calamine raw-cell coercion finding을 합성 공격 회귀와 fail-closed preflight로 닫았다. |
| 2026-08-07 | quality_runner | 최종 verify, Rust all-features, standard production bundle과 marker/artifact scan을 재통과하고 QA 뒤 세 독립 재리뷰를 시작했다. |
| 2026-08-07 | review_judge | wrapper XML·IPC 합산·ECMAScript trim과 모바일 route/retry focus finding까지 수정한 뒤 세 재리뷰에서 미해결 P0–P3 0건을 확인했다. |
| 2026-08-07 | doc_gardener | plan-010을 completed로 이동하고 동일 번호 review mirror와 잔여 위험을 기록했다. |

## QA Evidence

- result: PASS
- `npm run verify`: ESLint, `vue-tsc`, Vitest 62 files/280 tests, Prisma validate·migration registry/hash/diff, Rust default 178 tests, production build, Tauri check, base harness와 실제 macOS release E2E를 통과했다.
- `cargo test --locked --all-features`: 188/188 PASS. `cargo fmt --check`, all-targets/all-features Clippy `-D warnings`, `git diff --check`도 PASS했다.
- 실제 Browser 1280×720과 390×844 dark/light에서 `/data-exchange`의 disabled Browser selector, privacy 안내, table/card 전환과 document overflow 0을 확인했다. 모바일 drawer는 첫 link focus·background inert, route 뒤 `MAIN#main-content` focus, `scrollWidth=innerWidth=390`이었다.
- 실제 macOS release 앱의 native Open dialog에서 cancel 뒤 빈 상태 유지와 XLSX 선택을 확인했다. 합성 XLSX preview는 total 3/valid 3/error 0/duplicate 1을 표시했고 원본 SHA-256은 불변이었다.
- release E2E 15/15 PASS: 기존 domain write 6, 별도 process restart 4, XLSX write/restart, quoted multiline CSV write/restart, 후속 source-row 실패 전체 rollback을 실제 Tauri IPC·SQLite에서 확인했다.
- XLSX 합성 공격 회귀는 실제 해제 크기 위조, `usize::MAX` shared-string reserve, 실제 item 105,021 초과, 반복 SST logical text 20 MiB, normalized name 충돌, raw-cell coercion과 wrapper root 전·내 malformed comment 우회를 file error로 종료했다.
- `npm audit --audit-level=moderate`는 취약점 0건이었다. 같은 resolved Rust lock set의 `cargo audit`는 취약점 0건이며 macOS target에 포함되지 않는 허용 warning만 남았다.
- E2E 뒤 최종 보안 수정이 포함된 standard `BODAM.app`을 2026-08-07 01:39:53에 다시 만들었다. app·binary·dist의 E2E env/WDIO/WebDriver/4445 marker 0건, production permission `core:default`, normal Cargo graph WDIO 0건, 임시 `bodam-e2e-*`와 repository SQLite/log artifact 0건을 확인했다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P1 | 같은 update target을 여러 행이 덮어쓸 수 있음 | target set 중복을 commit 전 거부하고 전체 무쓰기 회귀 추가 |
| P1 | ZIP declared size 위조가 실제 해제량 상한을 우회 | 64 KiB 단위 실제 해제량을 entry·total에 합산하고 forged archive 회귀 추가 |
| P1 | shared-string 예약·반복 참조가 preview 전 메모리를 증폭 | item 수와 대상 sheet logical UTF-8 예산을 소유 복사 전 검사 |
| P2 | RFC 4180 quoted field 안 bare CR/LF를 envelope가 거부 | quote-aware record scanner로 record 밖 CRLF만 강제 |
| P2 | TS/Rust trim이 U+0085 등에서 달라 duplicate·Customer 값이 변형 | 공용 ECMAScript trim+NFC를 import와 Customer validation에 적용 |
| P2 | commit 중 Escape/X/backdrop 경계와 enabled X가 불일치 | 모든 dismiss 경로 차단, close disabled, `aria-busy`와 회귀 추가 |
| P2 | light text 대비와 4,000자 reference wrapping 부족 | AA secondary token과 bounded anywhere-wrap 계약 적용 |
| P2 | Calamine shared index·numeric·inline·formula string 보정이 원본을 바꿈 | 모든 worksheet `sheetData` raw type/payload strict preflight 추가 |
| P2 | wrapper root와 malformed comment가 raw-cell preflight를 우회 | Calamine-compatible root discovery 뒤 worksheet strict scan, 중첩 `sheetData` fail-closed |
| P2 | 모바일 drawer가 background focus를 허용하고 route 뒤 focus를 잃음 | 첫 link focus, background inert, Escape trigger·route main focus 추가 |
| P2 | retry cancel·무오류 preview 성공 뒤 focus가 body로 유실 | cancel은 stable selector, 성공은 preview region, 오류는 summary로 focus |
| P2 | IPC summary `u32` 합산 overflow와 sourceRow 상한 불일치 | 개별 5,000 상한, `checked_add`, `sourceRow ≤ i32::MAX` 검증 |
| P3 | E2E path seam이 같은 parent만 검사 | canonical OS temp child·regular file·symlink 차단으로 제한 |
| P3 | 빈 CSV 행이 exact 21 field 검사 전에 생략 | field count를 먼저 검증하고 정확한 blank 21열만 생략 |
| P3 | NUL을 separator로 쓴 duplicate key가 서로 다른 tuple을 충돌 | JSON tuple encoding으로 query·preview schema를 통일 |
| P3 | dialog 설명이 접근성 이름에 연결되지 않음 | 고유 ID와 조건부 `aria-describedby` 추가 |

최종 full QA 뒤 domain/data, UI/accessibility, privacy/capability 세 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding은 0건이었다.

## Completion Notes

- 승인된 21열 XLSX/CSV import, 명시적 Customer·duplicate 결정, v8 named source 보존과 단일 transaction 반영을 완료했다.
- 실제 Browser desktop/390px와 macOS release app의 native dialog, XLSX/CSV write·rollback·restart를 합성 데이터로 검증했다.
- 원본 workbook·전체 경로를 저장하지 않고 production capability를 `core:default`로 유지했다.
- 잔여 위험은 평문 SQLite/WAL과 soft-delete 원문 보존, 제한된 OOXML fuzz corpus, 앱 밖 DB 직접 변경, 실제 VoiceOver/axe 미실행이다.
- 다음 작은 계획은 승인된 export·backup/restore·Settings와 배포 마감을 진행한다.
