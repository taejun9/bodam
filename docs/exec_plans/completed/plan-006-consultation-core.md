# plan-006-consultation-core

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
- 승인 범위: Customer별 Consultation CRUD, 상담 일시·내용·다음 연락일·자유입력 결과, schema migration, Browser와 실제 데스크톱 E2E
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

프로필을 벗어나는 상담 결과 enum, 민감·상세 병력, 첨부, Dashboard 판정, Calendar 일정 또는 외부 통신은 별도 승인 없이 진행하지 않는다.

## Goal

- 활성 Customer 상세에서 Consultation을 생성·조회·수정·soft delete한다.
- Customer와 상담 일시는 필수, 상담 내용·다음 연락일·결과는 선택으로 저장한다.
- 상담 결과는 enum을 만들지 않고 선택 자유입력으로 유지한다.
- 상담 일시는 UTC timestamp로 저장해 OS local timezone에서 입력·표시하고, 다음 연락일은 `YYYY-MM-DD` date-only로 저장한다.
- Browser preview와 Tauri/Rust/SQLite가 같은 validation, active-parent, 정렬과 soft-delete 동작을 제공한다.
- 기존 v4 데이터를 보존하는 다섯 번째 migration과 runtime history/schema/FK/index drift 검사를 완성한다.
- 합성 데이터로 실제 Browser 화면과 release-mode 앱 두 프로세스의 Consultation persistence를 검증한다.

## Non-Goals

- 상담 결과 enum·추천값, 상담 유형·채널·담당자·참여자, 태그
- 통화 시작·종료 시각과 소요 시간, 원래 입력 timezone·offset 보존
- 주민등록번호, 보험사 로그인 정보, 민감 병력, 상세 병력 또는 이를 위한 입력 필드
- rich text, 첨부파일, 음성·영상, 외부 메시지·전화 연동
- 최근 상담 30일·미상담 90일·오늘 연락 대상의 Dashboard 또는 알림 판정
- Calendar 월 보기, 사용자 Schedule, 반복·완료·drag and drop
- 전역 Consultation 목록·검색, Customer 간 Consultation 이동, bulk 변경
- Consultation 복원·purge·보존기간 UI와 Customer 복원 UI
- Coverage Benchmark, Dashboard, import/export, backup/restore
- 원격 API, telemetry, broad filesystem·shell·network capability
- Windows NSIS·WebView2 미설치 offline VM 검증 완료 주장

## Context Map

- `src/features/consultation`: Consultation domain, validation, application, adapters와 customer-scoped UI
- `src/features/customer`: 활성 Customer 조회와 상세 화면 계약
- `src/features/insurance/pages/CustomerInsurancePage.vue`: 현재 Customer 상세 orchestration과 Consultation section 통합 지점
- `database/prisma`: Consultation schema와 다섯 번째 migration
- `src-tauri/src/consultation`: strict IPC DTO, SQLite repository와 commands
- `src-tauri/src/database`: migration registry와 v5 history/schema/FK/index drift 검사
- `e2e`: release app 두 프로세스의 Consultation persistence 시나리오

## Constraints

- `codex/plan-006-consultation-core`와 `.worktree/plan-006-consultation-core`에서만 구현·검증한다.
- 활성 계획 승인 범위 안에서 계획 → 구현 → QA → 독립 리뷰 → 완료 계획/review → commit 순서를 지킨다.
- Consultation UI는 날짜 대상 판정이나 저장 변환 규칙을 임의 계산하지 않고 consultation application/component helper 계약만 호출한다.
- consultation application은 Customer 공개 application/repository 계약으로 활성 부모를 확인하고 다른 feature의 Browser storage나 DB table을 직접 읽지 않는다.
- domain service와 validation은 Vue, Router, Tauri, Prisma와 SQLite에 의존하지 않는다.
- 외부 form과 IPC payload를 TypeScript Zod 및 Rust 경계에서 각각 strict 검증한다.
- date-only와 UTC timestamp를 locale 문자열로 저장하지 않는다.
- 업무 삭제는 `deletedAt` soft delete이고 FK는 hard delete `RESTRICT`, key update `CASCADE`다.
- source, migration, 문서는 300줄 전에 책임 단위로 분리한다.
- 실제 고객·상담 행과 금지된 민감정보를 source, test, log, screenshot에 넣지 않는다.

## Domain Contract

- `Consultation`: id, customerId, consultedAt, content, nextContactOn, result, createdAt, updatedAt, deletedAt
- `customerId`와 `consultedAt`은 필수다. 생성 뒤 update로 다른 Customer에 옮기지 않는다.
- `consultedAt`은 offset이 있는 RFC 3339 입력만 받고 UTC millisecond `Z` timestamp로 정규화한다.
- form의 `datetime-local` 값은 OS local timezone의 실제 instant로 변환하고, UTC 값을 다시 local form 값으로 바꿀 때 local date/time 구성요소를 사용한다.
- `nextContactOn`은 선택 date-only이며 실제 달력 날짜인 `YYYY-MM-DD`만 허용한다. 시각·timezone을 붙이지 않는다.
- `content`는 선택 multiline plain text다. trim 후 빈 값은 null이고 Unicode scalar 4,000자 이내다.
- `result`는 선택 자유입력 plain text다. trim 후 빈 값은 null이고 Unicode scalar 200자 이내다.
- 상담 내용에는 민감 병력·상세 병력을 저장하지 말라는 항상 보이는 안내를 연결한다. 문자열 감지로 의료 의미를 판정하거나 저장 내용을 로그에 복사하지 않는다.
- 같은 Customer, 같은 상담 instant의 여러 Consultation을 허용하고 자동 병합하지 않는다.
- 활성 Customer의 활성 Consultation만 기본 조회하며 `consultedAt DESC, id ASC`로 안정 정렬한다.
- Customer soft delete는 Consultation 원본을 수정하지 않고 기본 조회에서 숨긴다.
- Consultation soft delete는 기본 조회에서 숨기고 다른 Customer·Policy·Coverage·Family 원본을 수정하지 않는다.
- 비활성·없는 Customer의 list/create는 `CUSTOMER_NOT_FOUND`, 비가시·없는 Consultation의 update/delete는 `CONSULTATION_NOT_FOUND`로 값 없이 실패한다.
- DB index는 현재 Customer별 최신 이력 조회인 `(customerId, deletedAt, consultedAt)`만 지원한다. 전역 후속 연락 index는 실제 Dashboard query 계획에서 추가한다.

## Implementation Plan

- [x] Consultation Prisma model과 다섯 번째 migration·FK·index 추가
- [x] migration registry/hash와 runtime v0–v5 object·column·index·FK drift 계약 갱신
- [x] clean DB, v4 upgrade 보존, active-parent·soft-delete·drift Rust tests 구현
- [x] Rust Consultation CRUD repository·commands와 strict DTO 구현
- [x] canonical UUID, timestamp/date-only, text bound와 값 비노출 오류 tests 구현
- [x] TypeScript Consultation types, Zod schema, local datetime 변환 helper와 repository port 구현
- [x] Browser localStorage adapter와 Tauri IPC adapter parity 구현
- [x] consultation application과 Customer 상세 orchestration 연결
- [x] Customer 상세의 Consultation loading/error/empty/list와 생성·수정·삭제 UI 구현
- [x] privacy 안내, stable duplicate action, keyboard focus·Escape·호출 버튼 복귀 구현
- [x] 390px responsive table/card와 긴 plain text wrapping 구현
- [x] unit/adapter/component tests와 in-app Browser 실제 회귀 수행
- [x] release-mode 두 프로세스 E2E에 Consultation CRUD·reload·restart·soft-delete 추가
- [x] README·data model·requirements·open questions 정합성과 운영 안내 갱신
- [x] 전체 QA와 standard production capability boundary 재검증
- [x] QA 이후 독립 정확성·UI·privacy 리뷰 findings 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`, `npm run typecheck`, `npm run test:unit`
- `npm run prisma:validate`, `npm run database:contract`
- `cargo fmt --check`, all-targets/all-features clippy `-D warnings`, `cargo test --all-features`
- `npm run qa`와 release-mode 실제 앱 `npm run test:e2e`
- in-app Browser에서 Consultation 생성·수정·삭제, 다음 연락일, 자유 결과, reload를 확인
- local datetime↔UTC round trip, DST/잘못된 local time, date-only와 같은 instant duplicate를 확인
- keyboard focus·첫 오류·Escape·호출 버튼 focus 복귀, 390×844 layout·긴 내용 wrapping·가로 overflow를 확인
- E2E WebDriver·DB override가 표준 production bundle/capability에 포함되지 않는지 재검사
- `npm audit`, `git diff --check`, 민감정보·SQLite/temp artifact 잔존 검사를 수행

## Acceptance Scenarios

1. 기존 v4 DB의 Customer·Policy·Coverage·Category·Family·Membership 행을 보존하며 v5 Consultation schema로 upgrade된다.
2. 활성 Customer 상세에서 local 상담 일시만으로 Consultation을 생성할 수 있다.
3. 상담 내용·다음 연락일·자유입력 결과를 함께 저장하고 수정한다.
4. 빈/초과 text, 잘못된 UUID·timestamp·date, unknown field와 누락된 필수 IPC field가 TypeScript·Rust 경계에서 거부된다.
5. local datetime input은 UTC `Z` timestamp로 저장되고 같은 instant를 OS local timezone에서 재표시한다.
6. 같은 Customer와 같은 상담 instant의 두 행을 별도 ID로 유지하고 정확한 행을 수정·삭제한다.
7. 목록은 최신 상담 우선과 ID tie-breaker로 Browser·SQLite에서 동일하게 정렬된다.
8. Consultation soft delete 뒤 기본 목록에서 숨겨지고 DB 원본은 남는다.
9. Customer soft delete 뒤 Consultation 원본은 남지만 기본 조회와 상세 화면에서 숨겨진다.
10. renderer reload와 새 앱 프로세스 뒤 상담 일시·내용·다음 연락일·결과가 유지된다.
11. route Customer A→B 전환 또는 조회 실패가 A의 Consultation을 남기지 않는다.
12. 상담 내용 입력에 민감·상세 병력 금지 안내가 항상 보이고 저장값·거부값이 오류·로그에 노출되지 않는다.
13. form autofocus·첫 오류 focus·Escape·호출 버튼 focus 복귀와 삭제 뒤 존속 focus가 동작한다.
14. 390×844에서 Consultation card와 dialog가 가로 overflow 없이 동작하고 긴 plain text가 경계를 벗어나지 않는다.

## Review Plan

QA PASS 뒤 독립 `review_judge`, UI/접근성 reviewer와 `privacy_guard`가 다음을 확인한다.

- 승인 필드 밖의 상담 분류·민감·추론 필드를 저장하지 않는지
- local datetime↔UTC 변환과 다음 연락일의 date-only 의미가 timezone·locale 저장 문자열에 오염되지 않는지
- Browser/Tauri의 validation, 정렬, active-parent와 soft-delete가 같은지
- Customer 삭제 시 Consultation 원본 유지와 active read 숨김 규칙이 같은지
- UI가 상담 대상·최근/미상담 판정을 임의 계산하지 않는지
- duplicate instant를 ID별 action으로 정확히 구분하는지
- direct IPC가 unknown field·누락된 필수 field와 invalid UUID/text/date/timestamp를 거부하고 원문 값을 노출하지 않는지
- v4 upgrade와 migration history/runtime schema/FK/index drift가 기존 데이터를 보호하는지
- privacy 안내, dialog focus, 긴 text, responsive와 실제 Browser/release app 증거가 충분한지
- production artifact에 E2E DB override·WebDriver 기능이 남지 않는지

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 `/goal`과 승인 운영 프로필을 plan-006 승인 근거로 기록 | 작은 후속 계획을 연속 진행하라는 승인 범위 안의 핵심 MVP 기능 |
| 2026-08-06 | Consultation을 Customer 상세에 통합 | Customer FK와 연속된 보험·보장·상담 업무 맥락을 유지하고 미승인 전역 query를 만들지 않음 |
| 2026-08-06 | 상담일은 local `datetime-local` UI와 UTC timestamp 저장으로 구현 | 개념 모델이 상담을 시간 의미의 값으로 명시하고 승인 프로필이 timestamp를 UTC 저장·OS local 표시로 확정; 화면 용어는 상담 일시로 명료화 |
| 2026-08-06 | 다음 연락일은 date-only로 저장 | Dashboard의 `다음 연락일 ≤ 오늘` 규칙이 시각·timezone에 흔들리지 않도록 함 |
| 2026-08-06 | 결과는 자유입력이고 같은 instant 중복을 허용 | 승인 프로필 밖 enum·uniqueness·자동 병합을 만들지 않음 |
| 2026-08-06 | 내용 4,000자, 결과 200자 기술 경계를 둠 | multiline 상담 기록을 허용하면서 renderer·IPC·DB 경계에 유한 입력을 보장 |
| 2026-08-06 | 최근/미상담·오늘 연락 판정은 Non-Goal | 원본 CRUD를 먼저 완성하고 Dashboard read model은 별도 수직 계획에서 검증 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-005를 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | repo_cartographer | 제품·승인 프로필·Consultation 모델·Customer 상세·migration·E2E 경계를 병렬로 매핑했다. |
| 2026-08-06 | plan_keeper | plan-006 전용 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | v5 migration, Rust/TypeScript adapter, Customer 상세 Consultation UI와 두 프로세스 E2E를 구현했다. |
| 2026-08-06 | quality_runner | in-app Browser에서 CRUD·reload·UTC 변환·keyboard·privacy와 390×844 responsive를 실제 검증했다. |
| 2026-08-06 | quality_runner | 모바일 small dialog 폭 우선순위 결함을 발견해 공용 AppDialog selector를 수정하고 390px 전체 폭·overflow 0을 재검증했다. |
| 2026-08-06 | quality_runner | release-mode macOS 앱의 첫 실행과 새 프로세스 persistence, 전체 QA와 표준 production bundle 격리를 통과시켰다. |
| 2026-08-06 | plan_keeper | QA 증거를 기록하고 계획을 review 상태로 전환했다. |
| 2026-08-06 | review_judge | 데이터 정합성과 UI·접근성을 독립 검토해 미해결 P0–P3 finding이 없음을 확인했다. |
| 2026-08-06 | privacy_guard | capability·합성 fixture·artifact·production 격리를 검토해 미해결 P0–P3 finding이 없음을 확인했다. |
| 2026-08-06 | plan_keeper | review gate와 세 최종 판정을 확인하고 completed plan·review mirror를 작성했다. |

## QA Evidence

- command: 최종 수정 후 `npm run qa`
- result: PASS — ESLint, vue-tsc, Prisma validate, migration registry/diff, Vite production build, cargo check와 harness 포함.
- Vitest: 23 files / 97 tests PASS. Consultation schema/service, Browser/Tauri adapter, form과 Customer section 회귀를 포함한다.
- Rust: 기본 및 `--all-features` 각각 77/77 PASS; `cargo fmt --check`와 all-targets/all-features clippy `-D warnings` PASS.
- v5 migration SHA-256: `48601ed0c5561661fd165634a44dcbd575474c3cb4f85b873fa190b9e0a41254`; clean DB, v4 upgrade 보존, history/runtime schema/index/FK drift를 통과했다.
- 실제 release-mode macOS 앱 E2E: 첫 프로세스 write 3/3 PASS(1m 42.7s), 새 프로세스 persistence 2/2 PASS(11s). Consultation의 같은 instant 두 ID, 수정, reload, restart, soft delete와 삭제 후 focus를 실제 Tauri IPC·SQLite로 검증했다.
- in-app Browser 실제 화면: 생성·수정·reload·삭제, local `2026-08-05T09:30` ↔ UTC `2026-08-05T00:30:00.000Z`, date-only, privacy `aria-describedby`, autofocus·Escape·호출 버튼 복귀 PASS. 합성 Consultation은 검증 뒤 삭제했다.
- 390×844 Browser: table 숨김/card 표시, `bodyScrollWidth=390`, card 내부 overflow 0, dialog `clientWidth=scrollWidth=390`, console warning/error 0건. 실제 점검에서 small dialog가 358px로 왼쪽 정렬되던 CSS specificity 결함을 수정하고 재검증했다.
- `npm audit --audit-level=low`: 취약점 0건. `git diff --check`, line/privacy harness와 workspace SQLite/temp artifact 잔존 검사 PASS.
- 표준 `npm run tauri -- build --bundles app`: PASS. production binary·`BODAM.app`·dist에서 `BODAM_E2E_DB_PATH`, WDIO/WebDriver plugin/permission, `127.0.0.1:4445` 표식 0건.
- E2E 실행 로그 `.runtime/wdio-logs`는 증거 요약 뒤 삭제했다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P2 | 첫 리뷰 시도에서 계획 상태와 QA Evidence가 실제 완료 상태를 반영하지 않아 `run_review.py`가 차단 | 실제 명령·화면·앱 증거를 먼저 기록하고 status를 `review`로 전환해 gate PASS 후 세 독립 리뷰를 다시 수행 |

최종 정확성, UI·접근성, 개인정보·릴리스 리뷰에서 신규 또는 미해결 P0–P3 finding 없이 PASS했다.

## Completion Notes

- 기존 v4 데이터를 보존하는 v5 Consultation migration과 strict Rust CRUD·soft-delete·active-parent visibility를 완성했다.
- Browser/Tauri adapter, UTC timestamp·date-only·Unicode scalar 계약과 Customer 상세의 상담 생성·수정·삭제 UI를 완성했다.
- 실제 in-app Browser와 release-mode macOS 앱 두 프로세스에서 CRUD, 같은 instant 중복 ID, reload/restart, responsive와 keyboard 흐름을 합성 데이터로 검증했다.
- 실제 모바일 점검에서 발견한 공용 small dialog 폭 결함을 수정했고, 표준 production 앱에서 E2E DB override·WebDriver 기능이 없음을 재확인했다.
- 세 독립 관점 리뷰를 통과했으며 잔여 위험은 review mirror에 기록했다.
