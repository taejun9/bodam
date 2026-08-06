# plan-008-dashboard

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
- 승인 범위: 승인된 8개 Dashboard 카드의 요청 시 read model, `/dashboard` 시작 화면, 기존 공개 feature 계약 조합, Browser와 실제 데스크톱 실행 테스트
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

승인 프로필 밖의 Dashboard 설정 저장, Calendar·Notification, 원격 기능, 공식 보험 권고와 새 원본 필드는 별도 승인 없이 진행하지 않는다. 요구사항이 계획에서 정하도록 한 카드 count·tie·포함 경계는 아래 Domain Contract와 Decision Log에 재현 가능하게 고정한다.

## Goal

- `/dashboard`를 앱의 기본 시작 화면으로 제공하고 sidebar에서 실제 이동할 수 있게 한다.
- 오늘 연락, 상령 예정, 만기 예정, 보험료 TOP, 가족 보험료, 보장 부족, 최근 상담, 최근 미상담의 8개 카드를 제공한다.
- 카드별 전체 건수와 안정 정렬된 최대 10개 detail을 표시하고 고객 상세 또는 가족 관리로 이동할 수 있게 한다.
- Dashboard는 기존 Customer·Insurance·Family·Coverage·Benchmark·Consultation application의 공개 결과만 조합하고 원본이나 계산 결과를 저장하지 않는다.
- 명시한 기준일과 local timezone으로 날짜 경계를 재현하고 앱 진입·resume·local date 변경 시 다시 계산한다.
- 합성 데이터로 실제 Browser 화면과 release-mode Tauri/SQLite 두 프로세스에서 8개 카드와 persistence를 검증한다.

## Non-Goals

- Calendar 월 보기, 사용자 일정 CRUD, OS notification 또는 background push
- Dashboard 기간·건수 사용자 설정, 카드 재배치·숨김, chart, export
- Dashboard cache/table, 계산 결과·상령·부족 count 저장, 새 schema·migration·Rust command
- 전역 batch SQL, cross-feature DB join, 대규모 dataset 최적화
- 완료된 연락 표시, 상담별 task 상태, 오래된 다음 연락일 복원·수정
- Policy status 자유문자열 해석, 갱신주기·다음 갱신일 계산
- 가족 전체를 중복 제거해 재합산하거나 가족 보장 판정 생성
- Benchmark seed·자동 추천·공식 보험 적합성 주장
- 원격 API, telemetry, cloud sync, broad filesystem·shell·network capability
- 실제 고객 데이터·첨부 원본·민감 병력·보험사 로그인 정보 사용

## Context Map

- `src/features/dashboard`: Dashboard date service, read-model service, application, page와 components
- `src/app/composition`: 기존 6개 feature application을 Dashboard에 주입
- `src/app/router`, `src/app/shell`: `/dashboard` route, 기본 redirect와 sidebar 진입점
- `src/features/customer`: 활성 Customer와 `isManaged` 원본
- `src/features/insurance`: Customer별 활성 Policy와 합계대상 월보험료
- `src/features/family`: 활성 Family membership과 월보험료 summary
- `src/features/coverage`, `src/features/coverage-benchmark`: 활성 보장 합계와 부족 판정
- `src/features/consultation`: Customer별 활성 상담 최신순 계약
- `e2e`: 기존 합성 write/persistence 흐름 뒤 Dashboard read 시나리오

## Constraints

- `codex/plan-008-dashboard`와 `.worktree/plan-008-dashboard`에서만 구현·검증한다.
- 계획 → 구현 → QA → 독립 리뷰 → 완료 계획/review → commit 순서를 지킨다.
- UI는 날짜, 보험료, bucket, 부족 판정 또는 정렬을 계산하지 않고 Dashboard application 결과만 표시한다.
- Dashboard는 다른 feature의 repository·Browser storage·Tauri command·DB table을 직접 읽지 않는다.
- 날짜와 grouping service는 Vue, Router, Tauri, Prisma와 SQLite에 의존하지 않는다.
- 금액은 끝까지 TypeScript `bigint`이며 float로 바꾸지 않는다.
- 입력 원본과 계산 결과를 수정·저장하지 않고 매 load 때 새 read model을 만든다.
- 한 source reader라도 실패하면 이전 값을 섞은 부분 성공을 표시하지 않고 safe error와 retry를 제공한다.
- source·문서·migration은 300줄 전에 책임 단위로 분리한다.
- 실제 고객 행과 금지된 민감정보를 source, test, log, screenshot에 넣지 않는다.

## Domain Contract

- Dashboard query는 `referenceDate` date-only, 같은 local 날짜의 `referenceInstant` UTC instant, OS의 유효한 IANA `timeZone`, 기본 `limit=10`을 명시적으로 받는다.
- `referenceDate`는 `YYYY-MM-DD`의 실재 날짜다. date-only 차이는 timezone과 DST 길이가 아니라 local 달력 날짜 ordinal로 계산한다.
- UTC `consultedAt` instant만 명시한 IANA timezone의 local 날짜로 변환한다. 미래 상담 instant는 최근 상담·미상담 기준에서 사용하지 않는다.
- 활성 Customer 중 `isManaged=true`만 7개 Customer 기반 카드에 포함한다. Family 보험료는 Family 공개 summary 계약을 그대로 사용하며 Customer 관리대상 여부를 새로 해석하지 않는다.
- 각 카드는 필터 이전이 아닌 전체 일치 `totalCount`, 정렬 뒤 최대 limit의 `items`, `totalCount > items.length`인 `isTruncated`를 반환한다.
- 문자열 동점은 현재 값에 locale 의미를 더하지 않고 code-unit ascending, 마지막 tie는 stable UUID/id ascending이다.
- Customer 이름·Family 이름·Category 이름이 같아도 stable id로 구분한다.

### 오늘 연락

- Customer별 활성 상담을 `consultedAt DESC, id ASC`로 본 최신 1건만 현재 상담 상태로 사용한다.
- 최신 상담의 `nextContactOn`이 있고 `nextContactOn ≤ referenceDate`이면 고객 1행을 포함한다. 더 오래된 상담의 다음 연락일은 최신 상담이 supersede한다.
- `nextContactOn ASC`, Customer name ASC, Customer id ASC로 오래 연체된 고객부터 정렬한다.

### 상령 예정

- 유효 birthDate를 가진 관리대상 Customer별 다음 상령 증가일을 1행으로 계산한다.
- 연간 상령일은 그 해의 생일에 6 calendar months를 더하고 존재하지 않는 날짜는 대상 월 마지막 날로 clamp한다.
- 상령일 당일부터 만 나이에 1을 더한 보험 나이를 사용하며 원본 생년월일은 바꾸지 않는다.
- 다음 상령일의 `daysUntil`이 0–90일이면 포함한다. 0–30, 31–60, 61–90 bucket은 양끝 포함이고 중복되지 않는다.
- Event date ASC, Customer name ASC, Customer id ASC로 정렬한다.

### 만기 예정

- 관리대상 Customer의 활성 Policy 중 `maturesOn`이 있고 `daysUntil` 0–90인 계약을 Policy 1건당 1행으로 포함한다.
- `isIncluded=false`와 자유입력 status도 만기 원본을 숨기지 않는다. 삭제된 Policy와 Customer는 기존 공개 계약에서 제외한다.
- 상령과 같은 3개 bucket을 사용하고 maturity date ASC, Customer name ASC, Policy id ASC로 정렬한다.

### 보험료 TOP·가족 보험료

- 보험료 TOP은 Customer별 활성 `isIncluded=true` Policy의 월보험료를 공개 `InsuranceApplication.total()`로 합산하고 0원 초과 Customer만 포함한다.
- Amount DESC, Customer name ASC, Customer id ASC로 정렬한다.
- 가족 보험료는 공개 `FamilyApplication.list("")` summary를 그대로 사용하며 0원 초과 Family만 포함한다.
- 같은 Customer가 여러 Family에 속하면 각 Family summary에 포함하되 가족 전체 재합계는 만들지 않는다.
- Amount DESC, Family name ASC, Family id ASC로 정렬한다.

### 보장 부족 고객

- 공개 Benchmark assessment가 `insufficient`인 Category가 하나 이상인 관리대상 Customer를 Customer 1행으로 포함한다.
- `unconfigured`는 부족으로 세지 않고, 일치 Benchmark가 있으나 Coverage가 없어서 0원으로 부족 판정된 Category는 포함한다.
- 부족 Category count DESC, Customer name ASC, Customer id ASC로 정렬하고 Category는 name ASC, category id ASC로 표시한다.
- 서로 다른 Category의 부족액을 합산하지 않고 공식 권고로 표현하지 않는다.

### 최근 상담·미상담

- Customer별 기준일 이하의 최신 활성 상담 1건을 사용한다.
- 최근 상담은 latest local date가 `[referenceDate-29, referenceDate]`인 오늘 포함 최근 30 calendar days이며 latest instant DESC, Customer name ASC, Customer id ASC로 정렬한다.
- 미상담은 latest local date가 `≤ referenceDate-90`이거나 기준일 이하 상담이 한 번도 없는 관리대상 Customer다. 정확히 90일을 포함한다.
- 상담 없음 Customer를 먼저 name ASC, id ASC로 정렬하고, 그 뒤 날짜가 있는 Customer를 latest local date ASC, name ASC, id ASC로 정렬한다.

### Refresh·표시

- page mount, route 재진입, document가 hidden에서 visible로 resume, window focus, local date 변경 시 전체 read model을 다시 계산한다.
- local date 변경은 다음 local midnight timer와 resume/focus 시 현재 date 비교로 감지한다. 이전 요청보다 늦게 끝난 stale 응답은 버린다.
- 각 카드는 고유 heading의 `<section>`, canonical `<time datetime>`, 색에 의존하지 않는 이유 text/chip, stable ID data attribute를 제공한다.
- Customer item은 `/customers/:customerId`, Family item은 `/families`로 실제 이동한다.
- loading, empty, error, retry, truncated 안내와 화면의 기준일을 제공한다.

## Implementation Plan

- [x] Plan 승인 상태와 harness gate 확인
- [x] Dashboard date-only 검증·ordinal·timezone 변환·month-end clamp·상령·bucket pure service와 boundary tests 구현
- [x] 8개 card row/read model 타입과 filter/group/sort/limit pure service 및 tests 구현
- [x] 기존 6개 application 공개 reader를 병렬 조합하는 Dashboard application과 partial failure/call-count tests 구현
- [x] Dashboard composition singleton, `/dashboard` route, `/` redirect와 sidebar link 구현
- [x] 8개 semantic card, loading/error/empty/retry, reason, total/truncated, stable link UI와 component tests 구현
- [x] mount/resume/focus/local-midnight refresh와 stale response 방지 구현
- [x] desktop, 390px single-column, dark theme, 긴 이름 wrapping CSS 구현
- [x] 기존 native E2E 합성 fixture를 재사용하는 Dashboard write/restart scenario 구현
- [x] product·architecture·quality 문서와 README의 실제 상태 갱신
- [x] 전체 QA와 실제 in-app Browser 8개 카드·reload·반응형 수행
- [x] 실제 release 앱 두 프로세스 Dashboard persistence와 standard production capability 격리 검증
- [x] QA 이후 독립 domain/data, UI/accessibility, privacy/capability 리뷰와 finding 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`, `npm run typecheck`, `npm run test:unit`
- `npm run prisma:validate`, `npm run database:contract`, Rust default/all-features tests
- Rust fmt와 all-targets/all-features Clippy `-D warnings`
- `npm run qa`, release-mode 실제 앱 `npm run test:e2e`
- 날짜 0/30/31/60/61/90/91, 월말·연말·윤년·2월 29일 clamp, KST 자정 전후 UTC 상담을 확인
- 오늘/연체·exact 30일·exact 90일·미래 상담·상담 없음·다중 상담 supersede를 확인
- 관리대상/비관리, deleted 부모·자식, excluded Policy의 보험료 제외와 만기 포함을 확인
- bigint 보험료, 0원 제외, 금액 동점, 부족/기준 미설정/0 Coverage, 중복 이름·ID tie와 limit 10을 확인
- Browser에서 8개 카드, total/detail, 실제 링크, reload, retry와 console warning/error 0을 확인
- Browser 390×844 single-column, 가로 overflow 0, 긴 무공백 이름, dark mode를 확인
- release 앱 첫 프로세스와 두 번째 프로세스에서 동일 stable ID·금액·날짜·count를 확인
- native E2E 뒤 standard production 앱을 재생성하고 E2E clock/DB override·WDIO/WebDriver marker 0건을 확인
- `npm audit`, `git diff --check`, 300줄·민감정보·SQLite/temp artifact 잔존 검사를 수행

## Acceptance Scenarios

1. `/`와 sidebar Dashboard가 `/dashboard`로 이동하고 8개 semantic 카드·기준일·loading/error/empty가 보인다.
2. 최신 상담의 nextContactOn이 오늘 또는 과거인 관리대상 Customer만 오늘 연락에 오래 연체된 순으로 보인다.
3. 상령과 만기가 정확히 0/30/31/60/61/90일에 비중복 bucket으로 들어가고 91일·과거는 빠진다.
4. 월말·윤년 birthDate의 생일+6개월 clamp와 표시 보험 나이가 고정 기준일에서 재현된다.
5. Customer·Family 월보험료가 합계대상 활성 Policy만 bigint로 합산되고 0원은 TOP에서 빠진다.
6. excluded Policy는 보험료에는 빠지지만 유효 만기일이 있으면 만기 카드에 보인다.
7. 부족 Category가 1개 이상인 관리대상 Customer만 보이며 기준 미설정은 부족으로 세지 않고 0 Coverage 부족은 누락하지 않는다.
8. 최근 30일 exact 시작일은 포함되고 미래 상담은 빠지며 최신 상담 instant 순으로 보인다.
9. 정확히 90일 지난 Customer와 상담 없음 Customer가 미상담에 포함되고 89일은 빠진다.
10. 비관리·soft-deleted Customer와 deleted 자식은 Customer 카드에서 숨고 Family 공개 summary는 기존 활성 계약을 보존한다.
11. 카드 전체 count는 limit 전 값이고 detail은 최대 10개이며 날짜·금액·이름 동점에서도 ID로 순서가 재현된다.
12. resume/focus/local date 변경은 재계산하고 겹친 요청의 오래된 응답은 새 화면을 덮지 않는다.
13. 390×844에서 한 열, 전체 이름, keyboard 링크와 색 외 이유가 보이며 overflow·console error가 없다.
14. Browser reload와 release 앱 별도 두 프로세스에서 합성 8개 카드 값이 유지되고 원본 삭제 뒤 다시 계산된다.

## Review Plan

QA PASS 뒤 독립 domain/data, UI/accessibility reviewer와 `privacy_guard`가 다음을 확인한다.

- 승인된 8개 카드와 날짜·count·tie 범위를 벗어나 새 업무 의미를 추론하지 않는지
- Dashboard가 다른 feature 저장소/DB를 직접 읽거나 원본·파생 결과를 저장하지 않는지
- 6개 공개 application의 active/soft-delete/합계/판정 계약을 재사용하는지
- explicit reference date·timezone, month-end clamp, 30/90일·0–90 bucket과 미래 상담이 정확한지
- latest consultation grouping, managed filter, Policy count, 0원·excluded Policy, never-consulted 결정이 일관적인지
- bigint 합계와 Benchmark 부족·기준 미설정·0 Coverage 결과가 UI에서 재계산되지 않는지
- sort·limit·total count, duplicate names와 stable IDs가 Browser/Tauri에서 같은지
- refresh/stale request, error/retry, semantic headings·time·reason·links와 390px layout이 안전한지
- 실제 Browser/release 앱 증거와 production E2E capability 격리가 충분한지
- 실제 고객·민감정보·원격 의존·broad capability가 추가되지 않았는지

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 `/goal`과 승인 운영 프로필을 plan-008 승인 근거로 기록 | 작은 후속 계획을 연속 진행하라는 승인 범위 안의 Dashboard 필수 기능 |
| 2026-08-06 | 8개 카드를 하나의 저장 없는 read-model vertical로 구현 | 동일 기준일과 기존 원본을 공유하며 새 schema 없이 end-to-end 사용 가치를 제공 |
| 2026-08-06 | Customer 기반 7개 카드는 관리대상만, Family는 공개 summary 그대로 사용 | Dashboard 업무 큐의 담당 의미와 Family 기존 원본 계약을 구분 |
| 2026-08-06 | 오늘 연락은 최신 상담의 다음 연락일이 오래된 상담을 supersede | 완료 상태가 없는 과거 follow-up이 영구 연체로 남는 것을 피함 |
| 2026-08-06 | 최근 30일은 오늘 포함 30개 날짜, 미상담 exact 90일과 상담 없음 포함 | 승인 30/90일을 off-by-one 없이 재현하고 미접촉 고객을 누락하지 않음 |
| 2026-08-06 | 만기는 Policy 1행, excluded Policy도 포함 | 만기 원본은 계약 합계대상 boolean과 별개이고 여러 계약 이벤트를 보존 |
| 2026-08-06 | 보험료 0원 제외, 부족은 Category count로 정렬하고 부족액 합산 없음 | TOP의 의미를 유지하고 서로 다른 보장 단위에 새 합산 의미를 만들지 않음 |
| 2026-08-06 | 새 DB·migration·batch command 없이 공개 application을 조합 | feature 원본 소유권과 Browser/Tauri parity를 지키는 최소 수직 기능 |
| 2026-08-06 | 기준일과 같은 local 날짜의 미래 상담도 제외하도록 `referenceInstant`를 함께 주입 | 오늘 중 아직 발생하지 않은 상담이 최신 상담·후속 연락 상태를 덮지 않게 함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-007을 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | repo_cartographer | 제품 규칙, 공개 application 계약, Browser/native QA와 성능 경계를 병렬로 매핑했다. |
| 2026-08-06 | plan_keeper | plan-008 전용 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | 저장 없는 8개 read card, explicit date/timezone service, route·refresh·responsive UI와 native E2E 시나리오를 구현했다. |
| 2026-08-06 | quality_runner | Dashboard 6 files/29 tests, 전체 37 files/163 tests, lint·typecheck·build·harness를 통과시켰다. |
| 2026-08-06 | quality_runner | 실제 Browser UI에서 8개 카드, reload, 링크, 기준 삭제 재계산, 390px·dark/light·긴 이름과 정리를 확인했다. |
| 2026-08-06 | quality_runner | 같은 날 미래 instant 제외와 read-model 관리대상 방어 필터를 보완하고 전체 QA를 다시 통과시켰다. |
| 2026-08-06 | quality_runner | release Tauri 실제 작성 5건과 재시작 3건, standard production 번들과 E2E capability 격리를 통과시켰다. |
| 2026-08-06 | review_judge | domain/data 무발견, UI P2 1건, privacy/docs P3 1건을 기록하고 두 finding 수정 뒤 독립 재리뷰에서 미해결 finding 0건을 확인했다. |

## QA Evidence

- Dashboard targeted Vitest — result: PASS, 6 files/29 tests. 같은 local 날짜의 미래 instant, read-model 관리대상 경계와 light/dark 4.5:1 contrast를 포함했다.
- 전체 `npm run test:unit` — result: PASS, 37 files/163 tests.
- 최종 `npm run qa` — result: PASS. lint, typecheck, 163 unit tests, Prisma validate·registry/hash·diff, Rust 93 tests, production build, Tauri check, harness를 포함했다.
- Rust `cargo fmt --check`, default/all-features 93 tests, all-targets/all-features Clippy `-D warnings` — result: PASS.
- in-app Browser `http://127.0.0.1:1421` — result: PASS. UI로 합성 Customer 2, Policy 3, Coverage 1, Benchmark 1, Consultation 1, Family 2와 membership 3을 만들고 8개 card count `1/1/1/2/2/1/1/1`을 확인했다.
- Browser boundary — result: PASS. excluded Policy 만기, 합계대상 보험료, 1원 보장 부족, 상령 9일, 연락 2일 연체, 최근 상담 1일, 상담 없음과 stable link를 확인했다.
- Browser reload·mutation — result: PASS. reload 뒤 ID·date·amount·count가 유지되고 Benchmark 삭제 뒤 부족만 0건으로 재계산됐다.
- Browser responsive/accessibility — result: PASS. 390×844 one-column, body overflow 0, 긴 이름 42px wrapping, dark/light 전환, 모바일 menu, console warning/error 0을 확인했다.
- Browser 정리 — result: PASS. 합성 Benchmark·Family·Customer를 UI에서 soft delete해 8개 active card가 모두 0건으로 복귀했다.
- release native E2E — result: PASS. 실제 Tauri IPC write 5/5와 별도 앱 프로세스 restart persistence 3/3을 통과했고 8개 card 값·stable ID·날짜·금액을 재구성했다. macOS AppKit GUI 등록이 Codex sandbox에서 차단되어 동일 명령을 승인된 비샌드박스 실행으로 검증했다.
- standard production bundle — result: PASS. E2E 빌드 뒤 기본 feature로 `.app`을 재생성했고 `BODAM_E2E_DB_PATH`, WDIO/WebDriver, `127.0.0.1:4445`, E2E reference clock marker는 bundled app·binary·dist에서 0건이었다.
- 공급망·artifact — result: PASS. `npm audit --audit-level=high` 0 vulnerabilities, `git diff --check`, 300줄 제한, 임시 SQLite와 WDIO log 정리를 확인했다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P2 | light theme의 Dashboard 보조 문구가 `--text-muted`를 사용해 white/subtle/app 배경에서 일반 text 4.5:1 명암비를 충족하지 못함 | Dashboard 보조 문구 전체를 `--text-secondary`로 바꾸고 light/dark의 app/surface/subtle/muted 네 표면 모두 4.5:1 이상인 자동 contrast 회귀를 추가 |
| P3 | `open-questions.md`가 Dashboard를 후속 구현이라 쓰고 8개 카드 전체를 관리대상 Customer 기반처럼 설명 | 요청 시 계산 완료 상태로 고치고 관리대상 Customer 기반 7개와 기존 Family summary 기반 1개로 명시 |

수정 후 UI·접근성 및 privacy·capability 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding이 없음을 확인했다. domain/data 리뷰는 최초부터 finding이 없었다.

## Completion Notes

- `/dashboard`를 기본 시작 화면으로 연결하고 오늘 연락, 상령, 만기, 보험료, 가족 보험료, 보장 부족, 최근 상담, 미상담의 저장 없는 8개 read card를 완성했다.
- explicit reference date·instant·timezone, bigint, stable tie·ID·count·limit, managed/soft-delete와 공개 feature application 경계를 unit·Browser·release Tauri에서 검증했다.
- 실제 Browser에서 8개 카드 `1/1/1/2/2/1/1/1`, reload·mutation·390px·dark/light·긴 이름·실제 링크를 확인하고 합성 원본을 soft delete로 정리했다.
- 실제 macOS release 앱 write 5/5와 새 프로세스 persistence 3/3을 통과했고 standard production bundle에서 E2E DB·clock·WDIO/WebDriver 표식이 0건임을 확인했다.
- 독립 리뷰 P2 1건과 P3 1건을 모두 해결했으며 최종 미해결 actionable P0–P3 finding은 없다.
- 잔여 위험은 대규모 고객 수에서 공개 application fan-out 성능, Windows native 재검증, 로컬 DB 무암호화와 system clock/timezone 정확도 의존이다.
- 후속 계획은 승인 프로필의 월 Calendar와 사용자 일정 CRUD를 작은 수직 계획으로 진행한다.
