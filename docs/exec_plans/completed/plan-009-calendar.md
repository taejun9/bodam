# plan-009-calendar

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
- 승인 범위: 승인된 월 Calendar, 로컬 사용자 Schedule CRUD, 기존 공개 feature 계약 조합, Browser와 실제 데스크톱 실행 테스트
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

승인 프로필 밖의 주·일 보기, 반복·우선순위·drag and drop, OS/background notification, 원격 기능과 새 민감정보 필드는 별도 승인 없이 진행하지 않는다. 프로필이 기술 경계로 남긴 문자열 길이, 시간 정밀도, 정렬과 월 UI 동작은 아래 Domain Contract와 Decision Log에 고정한다.

## Goal

- `/calendar` 월 보기에서 상담일, 다음 연락일, 상령일, 계약 만기일과 사용자 일정을 날짜별로 함께 확인한다.
- 제목·날짜 필수, 시간·메모·고객 연결 선택, 완료 boolean인 로컬 일정을 생성·수정·완료·soft delete한다.
- Calendar는 기존 Customer·Insurance·Consultation과 새 Schedule application의 공개 결과만 조합하고 source나 계산 결과를 복제·저장하지 않는다.
- 명시한 월과 local timezone으로 날짜 귀속을 재현하고 앱 진입·resume·local date 변경 시 다시 계산한다.
- 합성 데이터로 Browser 화면과 release-mode Tauri/SQLite 두 프로세스에서 5개 event kind와 일정 persistence를 검증한다.

## Non-Goals

- 주·일 보기, 반복 일정, 우선순위, drag and drop, 일정 색상 사용자 설정
- OS notification, background push, 하루 1회 상태 저장, 원격 API·sync·telemetry
- 계약·상담 전용 상세 anchor, 일정 복원 UI, 완료 일정 자동 숨김 또는 알림 억제
- Calendar cache/table, 계산된 상령일·local 상담일·event DTO 저장
- Dashboard 30/60/90 bucket 또는 최신 상담 supersede 규칙을 Calendar에 적용
- 전역 batch SQL, cross-feature DB join, 대규모 dataset 최적화
- 실제 고객 데이터·첨부 원본·주민등록번호·보험사 로그인·민감 병력·상세 병력 사용

## Context Map

- `src/features/schedule`: Schedule schema, repository, application, form/delete UI
- `src/features/calendar`: 월 read model, application, runtime, page와 components
- `src/shared/calendar-date.ts`: date-only, month, timezone 변환 공용 pure primitives
- `src/features/dashboard`: 공용 날짜 primitive를 사용하도록 기존 date service 경계 정리
- `src/app/composition`, `src/app/router`, `src/app/shell`: singleton, `/calendar`, sidebar 진입점
- `src-tauri/src/schedule`: strict command DTO, validation, repository와 soft delete
- `database/prisma`, `database/migrations`, `src-tauri/src/database`: Schedule v7 schema·migration·검증
- `e2e`: 기존 합성 고객·계약·상담 뒤 Schedule write와 Calendar restart scenario

## Constraints

- `codex/plan-009-calendar`와 `.worktree/plan-009-calendar`에서만 구현·검증한다.
- 계획 → 구현 → QA → 독립 리뷰 → 완료 계획/review → commit 순서를 지킨다.
- UI는 날짜 귀속, 상령, event 생성·필터·정렬을 계산하지 않고 Calendar application DTO만 표시한다.
- Calendar는 다른 feature repository·Browser storage·Tauri command·DB table을 직접 읽지 않는다.
- 공유 날짜 service는 Vue, Router, Tauri, Prisma와 SQLite에 의존하지 않는다.
- 한 source reader라도 실패하면 이전 값이나 부분 성공을 표시하지 않고 safe error와 retry를 제공한다.
- Schedule과 Customer mutation은 Browser origin lock을 공유하고, Rust linked Schedule mutation은 부모 검사·mutation·응답 조회를 하나의 immediate transaction으로 직렬화한다.
- source·문서·migration은 300줄 전에 책임 단위로 분리한다.
- 새 filesystem·shell·process·network·SQL capability를 production에 추가하지 않는다.
- 일정 title·memo나 고객 행 값을 error, log, test output에 노출하지 않는다.

## Schedule Contract

- `ScheduleInput`은 `title`, `scheduledOn`, `scheduledTime`, `memo`, `customerId`, `isCompleted`의 strict object다.
- `title`은 trim 뒤 필수 1–200 Unicode scalar, `memo`는 빈 값→null이고 최대 4,000 Unicode scalar다.
- `scheduledOn`은 실재 `YYYY-MM-DD`이고 Calendar에서 계속 접근 가능하도록 `9998-12-31` 이하다. `scheduledTime`은 null 또는 local wall-clock `HH:mm`이며 `00:00`–`23:59`만 허용한다.
- `customerId`는 null 또는 canonical UUID이고 생성·수정 시 활성 Customer만 연결한다. 수정 시 연결 변경과 해제를 허용한다.
- `isCompleted`는 boolean이며 생성 기본 UI 값은 false다. 완료 일정도 Calendar에 남기고 chip·텍스트로 상태를 표현한다.
- 중복 일정은 허용하고 id ASC까지 정렬 tie를 해소한다. 별도 optimistic-lock 필드는 만들지 않고 기존 last-writer-wins 정책을 따른다.
- 삭제는 `deletedAt` soft delete다. 일정 복원 UI는 없고 삭제 후 기본 list·Calendar에서 숨긴다.
- 고객에 연결된 일정은 Customer soft delete 시 원본을 유지하되 숨고, Customer 복원 시 자체 삭제되지 않은 일정만 다시 보인다. 연결 없는 일정은 계속 보인다.
- 공개 application 계약은 `[startOn, endBefore)` 범위 list와 create, update, setCompleted, remove다.

## Persistence Contract

- Prisma `Schedule`/SQLite `schedules`는 id, nullable customer FK, title, scheduled date/time, memo, completed, created/updated/deleted timestamp를 가진다.
- Customer FK는 hard delete `RESTRICT`, update `CASCADE`이고 hard cascade를 사용하지 않는다.
- 범위 조회 index는 `(scheduled_on, deleted_at)`, 부모 visibility index는 `(customer_id, deleted_at)` 순서와 이름을 migration/schema verifier에 고정한다.
- v7 migration `20260806060000_add_schedule`을 registry/checksum에 등록하고 clean install, v6 upgrade 보존, idempotence와 drift-before-mutation을 검증한다.
- Rust list는 date range와 `deleted_at IS NULL`을 적용하고 linked 일정은 활성 Customer join을 만족할 때만 반환한다.
- Browser repository도 같은 visibility·정렬·validation을 적용하며 손상된 저장 응답은 safe repository error로 거부한다.

## Calendar Contract

- query는 `month`의 canonical `YYYY-MM`과 유효한 IANA `timeZone`을 명시한다. 월 범위는 첫날 포함, 다음 달 첫날 제외다.
- 모든 활성 Customer를 포함하며 `isManaged`로 제한하지 않는다. soft-deleted Customer와 그 Policy·Consultation·linked Schedule은 숨긴다.
- 활성 Policy의 `maturesOn`은 `isIncluded`와 자유입력 status에 관계없이 Policy 1건당 만기 event를 만든다.
- 활성 Consultation 한 건은 local timezone으로 변환한 `consultedAt` event와, 값이 있으면 date-only `nextContactOn` event를 각각 만든다. Dashboard의 최신 상담 supersede를 적용하지 않는다.
- birthDate가 유효한 활성 Customer는 표시 월에 해당하는 승인된 생일+6개월 clamp 상령일 event를 만든다. 원본과 계산 결과를 저장하지 않는다.
- Schedule date/time은 timezone 변환하지 않고 승인된 local date와 wall time 그대로 표시한다.
- event kind는 `consultation`, `next-contact`, `insurance-age`, `policy-maturity`, `schedule` 다섯 가지다.
- stable id는 각각 `consultation:<id>:consulted`, `consultation:<id>:next-contact`, `customer:<id>:insurance-age:<date>`, `policy:<id>:maturity`, `schedule:<id>`다.
- DTO는 event id/kind/date/time/title/reason, 관련 customer id/name, source id, schedule 완료 여부의 표시 최소값만 포함한다. 상담 내용·결과는 복제하지 않는다.
- 정렬은 date ASC, all-day 먼저, time ASC, kind code ASC, title code-unit ASC, event id ASC다.
- application은 Customer를 한 번 읽고 Customer별 Insurance·Consultation과 Schedule range를 공개 application으로 조합한다. source 실패는 전체 safe failure다.

## Month UI Contract

- 일요일 시작 7열 월 grid 안에 요일 header row와 6개 week row·각 7개 gridcell을 두고, 현재일·선택일, 날짜별 전체 event count와 desktop 최대 3개 chip/`+N`을 제공한다.
- 월 밖 칸은 비활성 blank로 두고 월 query 밖 event를 읽지 않는다. 이전·다음 달 이동 시 선택 day를 대상 월 마지막 날로 clamp한다.
- URL `/calendar?month=YYYY-MM&date=YYYY-MM-DD`에 월과 선택일을 보존한다. 지원 view 월은 배타적 월 끝·상령 계산이 유효하도록 `0001-01`–`9998-12`이며, 범위 밖·잘못된 값이나 month 밖 date는 현재 local 월·일로 canonical replace한다.
- 지원 범위 양끝에서 이전·다음 control은 disabled이고 keyboard·programmatic 이동은 경계를 넘지 않는 no-op/clamp다.
- 이전·다음·오늘, 날짜 선택, source 고객 상세 링크, 선택일 agenda, 일정 생성·수정·완료/되돌리기·삭제를 제공한다.
- source chip과 agenda는 `/customers/:customerId`로 이동한다. Schedule은 edit 동작과 별도의 연결 고객 link를 제공한다.
- desktop grid는 전체 제목을 가능한 범위에서 보여주고 390px에서는 날짜·event count를 유지하며 선택일 agenda에 전체 제목을 표시한다. 전체 문서는 가로 overflow가 없어야 한다.
- composite grid의 roving tab stop은 선택 날짜 button 하나뿐이다. cell event chip은 pointer preview이고 keyboard event 링크·일정 동작은 선택일 agenda에서 제공한다.
- dialog는 autofocus, label, `aria-invalid`, 첫 오류 focus, Escape, trigger focus return과 일정 메모의 민감정보 금지 안내를 제공한다.
- mount, route month/date 변경, hidden→visible, window focus, local midnight에 reload하고 request sequence로 stale response를 버린다.

## Implementation Plan

- [x] Plan 승인 상태와 범위·repository·UI·native QA 지도 확인
- [x] 공용 date-only/month/timezone pure service를 추출하고 Dashboard 회귀 유지
- [x] Prisma Schedule v7 migration, registry, exact runtime schema와 upgrade/drift tests 구현
- [x] Rust Schedule model·validation·repository·commands와 strict/safe/soft-delete tests 구현
- [x] TypeScript Schedule types·schema·Browser/Tauri repositories·application과 parity tests 구현
- [x] Calendar event/date service, stable mapping/sort와 boundary tests 구현
- [x] 공개 application fan-out Calendar application, full-failure/stale-safe tests 구현
- [x] composition singleton, `/calendar` query contract와 sidebar link 구현
- [x] semantic month grid, toolbar, agenda, Schedule dialogs와 responsive CSS 구현
- [x] refresh/runtime, error/retry, focus·keyboard·URL normalization tests 구현
- [x] native E2E Schedule write/restart와 5-kind Calendar scenario 구현
- [x] product·architecture·privacy·quality 문서와 README의 실제 상태 갱신
- [x] 전체 QA와 실제 in-app Browser CRUD·reload·반응형 수행
- [x] 실제 release 앱 두 프로세스 persistence와 standard production capability 격리 검증
- [x] QA 이후 독립 domain/data, UI/accessibility, privacy/capability 리뷰와 finding 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`, `npm run typecheck`, targeted/전체 Vitest, `npm run build`
- Prisma validate, migration registry/hash/diff, database contract와 Rust DB tests
- Rust default/all-features tests, fmt, all-targets/all-features Clippy `-D warnings`
- `npm run qa`, release-mode 실제 앱 `npm run test:e2e`
- month 1일/말일, Dec↔Jan, 28/29/30/31일, 월말·윤년 상령 clamp를 확인한다.
- KST와 DST timezone의 UTC 상담 월 귀속, date-only·Schedule wall time의 timezone 불변을 확인한다.
- 비관리 Customer 포함, excluded Policy 만기 포함, 각 Consultation의 2개 event, deleted parent/child와 linked/unlinked Schedule을 확인한다.
- strict/Unicode/trim/date/time/null/boolean, Browser concurrent writes, Rust atomic mutation과 safe error를 확인한다.
- Browser에서 5 kind, stable id/order, 월 이동·오늘·URL reload, CRUD·완료·삭제, 실제 고객 링크를 확인한다.
- Browser 390×844, 긴 제목, keyboard/Escape/focus, dark/light, overflow와 console warning/error 0을 확인한다.
- release 앱 첫 프로세스와 두 번째 프로세스에서 같은 stable id·날짜·시간·완료·연결을 확인한다.
- E2E 뒤 standard app을 재생성하고 DB override·clock·WDIO/WebDriver marker 0건을 확인한다.
- `npm audit`, `git diff --check`, 300줄·민감정보·SQLite/temp artifact 잔존 검사를 수행한다.

## Acceptance Scenarios

1. sidebar와 `/calendar`가 월 grid, 요일, 현재일·선택일, loading/error/empty와 선택일 agenda를 표시한다.
2. 상담일·다음 연락일·상령일·excluded Policy 만기·일정의 5 kind가 정확한 날짜와 stable id로 보인다.
3. KST 자정 경계 consultation은 local 월에 속하고 date-only·Schedule wall time은 timezone을 바꿔도 이동하지 않는다.
4. 비관리 활성 Customer도 보이고 soft-deleted Customer와 자식·linked 일정은 숨으며 unlinked 일정은 유지된다.
5. 상담별 nextContactOn은 최신 상담으로 합치지 않고 각각 보이며 한 상담이 두 event를 만들 수 있다.
6. title/date 필수와 optional time/memo/customer, 완료 boolean을 UI에서 생성·수정·연결 변경/해제한다.
7. 완료/되돌리기는 일정을 숨기지 않고 상태를 갱신하며 삭제는 UI에서 사라져도 DB 원본을 보존한다.
8. 이전·다음 월은 day를 clamp하고 오늘은 현재 local date로 돌아오며 URL reload도 같은 월·선택일을 복원한다.
9. 빠른 월 이동과 focus/resume/local date 변경에서 stale 요청이 새 화면을 덮지 않는다.
10. 동일 날짜·시간·제목에서도 kind와 stable id로 Browser/Tauri 순서가 재현된다.
11. 390×844에서 grid count와 agenda 전체 제목, keyboard·focus·Escape, dark/light가 overflow·console error 없이 동작한다.
12. release 앱 별도 두 프로세스에서 Schedule ID·필드·완료·연결과 5-kind Calendar가 유지된다.

## Review Plan

QA PASS 뒤 독립 domain/data, UI/accessibility reviewer와 `privacy_guard`가 다음을 확인한다.

- 승인된 Schedule 필드와 월 보기 밖의 업무 의미를 추론하거나 민감 필드를 추가하지 않는지
- Calendar가 다른 feature 저장소/DB를 직접 읽거나 원본·event 계산 결과를 저장하지 않는지
- 모든 활성 Customer, 각 Consultation의 두 날짜, excluded Policy 만기와 parent visibility가 일관적인지
- explicit month/timezone, UTC local conversion, date-only/wall-time 불변, 상령 clamp가 정확한지
- strict input, Unicode 한도, optional 연결, 완료 표시, soft delete와 Browser/Rust parity가 안전한지
- stable id/sort, source full failure, refresh/stale request와 URL normalization이 재현되는지
- semantic headings·links·dialogs·focus·reason과 390px layout이 접근 가능한지
- 실제 Browser/release 앱 증거, migration upgrade/drift와 production E2E capability 격리가 충분한지
- 일정 title/memo·고객 행이 log/error/test output에 노출되지 않고 원격/broad capability가 없는지

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 `/goal`과 승인 운영 프로필을 plan-009 승인 근거로 기록 | 월 Calendar와 승인된 Schedule은 바로 쓰는 MVP의 다음 필수 수직 기능 |
| 2026-08-06 | 새 UI library 없이 일요일 시작 자체 월 grid 사용 | 이미 승인된 월 범위에 필요한 기능만 구현하고 dependency·bundle·접근성 표면을 제한 |
| 2026-08-06 | Calendar는 관리 여부와 무관한 모든 활성 Customer를 포함 | 관리대상 필터는 Dashboard 업무 큐 계약이고 Calendar 원본 조회에는 승인되지 않음 |
| 2026-08-06 | 각 Consultation의 상담일·다음 연락일을 각각 보존 | Calendar는 source 날짜 보기이며 Dashboard의 최신 연락 supersede 의미를 확장하지 않음 |
| 2026-08-06 | Schedule time은 분 정밀도 local `HH:mm`, title 200·memo 4,000자로 제한 | 승인된 선택 시간·메모를 최소 정밀도와 기존 상담 메모 한도에 맞춰 양 adapter에서 재현 |
| 2026-08-06 | 완료 일정도 표시하고 연결 Customer 삭제 시 linked 일정 전체를 숨김 | 완료 숨김은 미승인이고 soft-deleted parent의 child를 Calendar에서 숨기는 공통 승인 규칙 준수 |
| 2026-08-06 | date ASC, all-day 우선 뒤 time/kind/title/id 정렬 | 색이나 adapter 반환 순서에 의존하지 않는 날짜별 안정 순서 제공 |
| 2026-08-06 | URL에 month/date를 보존하고 월 밖 날짜는 canonicalize | reload·deep link·실행 테스트를 재현하면서 선택 상태를 명시적으로 유지 |
| 2026-08-06 | Calendar view 범위를 `0001-01`–`9998-12`로 제한하고 경계 이동을 disabled/no-op 처리 | 다음 달 배타적 끝과 상령 +6개월 계산을 유효한 date-only 범위에 두고 canonical URL에서 예외를 만들지 않음 |
| 2026-08-06 | Schedule 입력도 `9998-12-31` 이하여야 하며 grid cell event action은 tab 순서에서 제외 | 저장 후 조회·수정할 수 없는 9999 일정을 막고 composite grid의 단일 roving tab stop을 보장하되 agenda에 keyboard 동작 유지 |
| 2026-08-06 | Customer와 Schedule Browser mutation은 origin lock을 공유하고 Rust linked mutation은 응답 조회까지 immediate transaction에 포함 | 부모 soft delete와의 경쟁에서 숨겨진 mutation이나 성공 후 false failure를 방지 |
| 2026-08-06 | 월 grid는 header row와 6개 week row가 gridcell을 소유하며 선택 상태는 gridcell에 둠 | 요일·행/열 관계와 선택 상태를 접근성 트리에 유효하게 제공 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-008을 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | repo_cartographer | Schedule domain/persistence, Calendar UI/application, migration/native QA 경계를 병렬로 매핑했다. |
| 2026-08-06 | plan_keeper | plan-009 전용 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | Schedule v7 migration, Rust/TypeScript repository와 Calendar read model·월 UI·native E2E를 구현했다. |
| 2026-08-06 | quality_runner | 전체 자동 QA, 실제 Browser와 release 앱 두 프로세스 검증을 통과하고 합성 데이터를 정리했다. |
| 2026-08-06 | review_judge | QA 통과 뒤 domain/data, UI/accessibility, privacy/capability 독립 리뷰를 시작했다. |
| 2026-08-06 | harness_builder | 리뷰의 부모 mutation 경쟁, Rust 응답 경쟁, grid 계층·tab stop, 삭제 focus와 날짜 상한 finding을 수정하고 parity 회귀를 추가했다. |
| 2026-08-06 | review_judge | 세 독립 재리뷰에서 미해결 P0–P3 finding 0건을 확인했다. |
| 2026-08-06 | quality_runner | 최종 Browser desktop·390px와 release write/restart를 재실행하고 E2E DB·로그·production marker 0건을 확인했다. |
| 2026-08-06 | doc_gardener | plan-009를 completed로 이동하고 동일 번호 review mirror와 최종 증거·잔여 위험을 기록했다. |

## QA Evidence

- result: PASS
- `npm run qa`: PASS. ESLint, `vue-tsc`, Vitest 50 files/225 tests, Prisma validate, migration registry/hash와 diff, Rust default 114 tests, Vite production build, Tauri check, base harness를 통과했다.
- `cargo test --all-features`: 114 tests PASS. `cargo fmt --check`와 all-targets/all-features Clippy `-D warnings`도 PASS했다.
- `npm audit --audit-level=high`: 취약점 0건. `git diff --check`, 300줄 제한, 민감정보·application architecture·capability harness도 PASS했다.
- 실제 Browser에서 비관리 고객, excluded 계약, 상담일·다음 연락일·상령일·만기일과 linked/unlinked Schedule을 합성 데이터로 표시했다. 일정 생성→날짜/시간/메모 수정→완료→되돌리기→soft delete, 이전/다음/오늘, URL reload persistence와 고객 link를 확인했다.
- Browser 390×844에서 `scrollWidth === innerWidth === 390`, 긴 제목의 agenda 전체 표시, dark/light 전환과 console warn/error 0건을 확인했다. 최종 semantic grid는 실제 화면에서도 header+6 week row, 42 gridcell, 선택 cell 1개와 grid tab stop 1개였다. 합성 일정 생성, 삭제 dialog 취소 autofocus·Escape·trigger 복귀, 삭제·reload 뒤 표시 0건을 재확인했다.
- `npm run test:e2e`: macOS release `BODAM.app`을 실제 실행해 최종 write 6/6와 별도 restart process 4/4 PASS. 5 kind stable ID, 두 상담의 09:30→09:31 순서, linked timed/completed Schedule, unlinked all-day Schedule, soft delete와 프로세스 간 Customer/Consultation/Policy/Schedule ID 지속성을 확인했다.
- 네이티브 E2E가 WebdriverIO Promise 우선순위, Tauri WebKit select change와 60초 전역 spec timeout 뒤 미완 Promise 중첩을 발견했다. selector/event fixture를 교정하고 동작별 10초 guard는 유지한 채 전체 spec envelope를 180초로 조정해 write 27.8초, restart 47.4초로 재통과했다.
- E2E output을 임시 DB와 같은 runtime directory로 옮겼다. 실패·성공 경로 모두 `bodam-e2e-*`, 임시 SQLite·state sidecar·WDIO log 잔존 0건이었다.
- `npm run tauri -- build --bundles app`: standard production app 재생성 PASS. `dist`, release binary와 `BODAM.app`에서 `BODAM_E2E_DB_PATH`, `__BODAM_E2E__`, E2E clock/storage, WDIO/WebDriver와 port 4445 marker 0건이며 production permission은 `core:default` 그대로다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P1 | Browser Schedule의 활성 Customer 검사와 Customer soft delete가 서로 다른 lock을 사용해 linked create/update가 부모 삭제와 경쟁 | Customer와 Schedule mutation을 같은 origin lock으로 직렬화하고 create/update 경쟁 회귀 2개 추가 |
| P1 | Rust linked create/update/complete가 autocommit mutation 뒤 별도 response 조회를 해 Customer delete 경쟁 시 mutation 성공 후 false failure 가능 | 부모 검사·mutation·response materialization을 하나의 `BEGIN IMMEDIATE` transaction으로 묶고 세 경쟁 테스트 추가 |
| P2 | 요일 row가 grid 밖이고 week row 없이 gridcell을 직접 소유하며 선택 상태가 일반 button에 있어 ARIA grid 계층이 무효 | grid 안 header row + 6 week row + 각 7 gridcell로 구성하고 선택은 gridcell, 오늘은 `aria-current=date`로 이동 |
| P2 | cell chip/link/+N도 tab stop이라 composite grid의 날짜 roving tab stop 계약을 깨뜨림 | cell action은 `tabindex=-1`, 선택 날짜 button 하나만 tab stop으로 두고 동일 keyboard action을 agenda에 유지 |
| P3 | 삭제 dialog가 안전한 취소에 autofocus하지 않음 | 취소에 `autofocus`를 두고 실제 dialog의 최초 focus·Escape·trigger 복귀 테스트와 Browser 검증 추가 |
| P3 | canonical 0001/9999 URL 이동이 date arithmetic 예외를 만들고 9999 Schedule은 저장 후 접근 경로가 없음 | view와 Schedule 상한을 `9998-12-31`로 통일하고 범위 밖 URL canonicalize, 경계 control disabled/no-op, TS/Rust/UI parity 테스트 추가 |
| P3 | privacy 문서가 title 표시 위치에서 삭제 확인 dialog를 누락 | 삭제 확인 dialog를 허용 표시 위치에 명시해 구현과 문서 정합 |
| P3 | 실제 native 대형 spec이 60초 전역 timeout 뒤 미완 흐름과 다음 spec을 같은 session에서 겹치게 할 수 있음 | 동작별 10초 wait는 유지하고 outer envelope를 180초로 조정, 로그를 임시 runtime에 포함해 전체 write/restart 재통과 |

수정 뒤 domain/data, UI/accessibility, privacy/capability 세 재리뷰에서 신규 또는 미해결 P0–P3 finding은 0건이었다.

## Completion Notes

- 월 Calendar와 Schedule CRUD, SQLite v7 migration, Browser/Tauri parity, 실제 화면·release restart 검증을 승인 범위대로 완료했다.
- source 원본이나 계산 event를 저장하지 않고 기존 공개 application만 조합하며 production capability는 `core:default`로 유지했다.
- 잔여 위험은 대규모 fan-out 성능·single snapshot 부재, Web Locks 미지원 Browser의 same-realm fallback, VoiceOver/axe 미실행, 로컬 SQLite 비암호화와 강제 종료 시 임시 artifact 정리 한계다.
- 다음 작은 계획은 승인 프로필 순서에 따라 Excel/CSV import·export 경계를 구현한다.
