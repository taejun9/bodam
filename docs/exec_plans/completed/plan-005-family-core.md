# plan-005-family-core

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
- 승인 범위: Family CRUD, Customer 다대다 membership, 선택 자유입력 관계명, 가족별 월보험료 합계, schema migration, Browser와 실제 데스크톱 E2E
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

프로필을 벗어나는 가족 대표·관계 enum·가족 보장 합계·외부 통신 또는 민감정보 저장은 별도 승인 없이 진행하지 않는다.

## Goal

- 이름이 있는 Family를 생성·조회·수정·soft delete한다.
- 활성 Customer를 여러 Family에 가입시킬 수 있고 같은 Family 안에는 한 번만 가입시킨다.
- membership의 선택 `relationshipName`을 수정하고 membership을 soft delete한 뒤 명시적인 재추가로 같은 행을 재활성화한다.
- Family별 활성 구성원 수와 활성·합계대상 InsurancePolicy 월보험료 합계를 `bigint`로 요청 시 계산한다.
- Browser preview와 Tauri/Rust/SQLite가 같은 validation, active-parent, uniqueness, reactivation과 soft-delete 동작을 제공한다.
- 기존 v3 Customer·Policy·Coverage 데이터를 보존하는 네 번째 migration과 runtime history/schema/FK drift 검사를 완성한다.
- 합성 데이터로 실제 Browser 화면과 release-mode 앱 두 프로세스의 Family persistence를 검증한다.

## Non-Goals

- 가족 대표, 관계명 enum·추천 목록, 고객 간 방향성 관계 그래프
- 가족별 보장 합계·Benchmark 판정, 모든 Family를 합친 전체 보험료 카드
- Family merge·duplicate 탐지, drag and drop, bulk membership 변경
- Family 직접 상세 route와 bookmarkable member view
- Customer 신규 생성·수정·복원, Policy 수정 또는 Coverage 관리의 Family 화면 내 제공
- membership 이력 화면, 범용 soft-delete 복원 화면, purge·보존기간
- Consultation, Dashboard, Calendar, import/export, backup/restore
- 원격 API, telemetry, broad filesystem·shell·network capability
- Windows NSIS·WebView2 미설치 offline VM 검증 완료 주장

## Context Map

- `src/features/family`: Family/membership domain, validation, 합계 service, application, adapter와 UI
- `src/features/customer`: 활성 Customer 조회와 구성원 상세 이동 계약
- `src/features/insurance`: Customer별 활성 Policy 조회와 합계대상 원본 계약
- `database/prisma`: Family/FamilyMembership schema와 네 번째 migration
- `src-tauri/src/family`: strict IPC DTO, SQLite repository와 commands
- `src-tauri/src/database`: migration registry와 v4 history/schema/FK/unique drift 검사
- `src/app/router`, `src/app/shell`: Family 목록 route와 실제 navigation
- `e2e`: release app 두 프로세스의 Family·membership·합계 persistence 시나리오

## Constraints

- `codex/plan-005-family-core`와 `.worktree/plan-005-family-core`에서만 구현·검증한다.
- 활성 계획 승인 범위 안에서 계획 → 구현 → QA → 독립 리뷰 → 완료 계획/review → commit 순서를 지킨다.
- Family UI는 보험료 합계·활성 조건·중복·재활성화 규칙을 계산하지 않고 family application 계약만 호출한다.
- family application은 Customer·Insurance feature의 공개 application 계약을 조합하고 다른 feature의 Browser storage나 DB table을 직접 읽지 않는다.
- domain service는 Vue, Router, Tauri, Prisma와 SQLite에 의존하지 않는다.
- 외부 form과 IPC payload를 TypeScript Zod 및 Rust 경계에서 각각 strict 검증한다.
- 금액은 기존 IPC decimal string과 TypeScript `bigint`를 유지하며 number/float로 변환하지 않는다.
- 업무 삭제는 `deletedAt` soft delete이고 FK는 hard delete `RESTRICT`, key update `CASCADE`다.
- source, migration, 문서는 300줄 전에 책임 단위로 분리한다.
- 실제 고객·계약 행과 금지된 민감정보를 source, test, log, screenshot에 넣지 않는다.

## Domain Contract

- `Family`: id, name, createdAt, updatedAt, deletedAt
- `FamilyMembership`: id, familyId, customerId, relationshipName, createdAt, updatedAt, deletedAt
- Family 이름은 trim 후 Unicode scalar 1–100자다.
- 관계명은 선택 자유입력이고 trim 후 빈 값은 null, 값이 있으면 Unicode scalar 1–100자다.
- Family 이름 중복을 금지하거나 이름만으로 병합하지 않으며, 중복 이름은 안정 ID로 작업 대상을 구분한다.
- Family 검색은 SQLite `NOCASE`와 같이 ASCII 문자만 대소문자를 접고 비ASCII 문자는 정확히 일치시킨다.
- 관계명은 Family 안의 단순 표시 label이며 법적 관계·방향성·성별·대표자 의미를 추론하지 않는다.
- Family와 Customer는 다대다이며 `(familyId, customerId)`는 삭제 이력을 포함해 DB에서 유일하다.
- 이미 활성인 같은 쌍의 추가는 고정 conflict 오류로 거부하고 새 행을 만들지 않는다.
- 제거된 같은 쌍을 사용자가 다시 추가하면 기존 membership의 관계명을 새 입력으로 바꾸고 `deletedAt=null`로 명시적 재활성화한다.
- membership update는 관계명만 바꾸며 Family나 Customer를 다른 ID로 옮기지 않는다.
- 관리 목록·구성원 수는 활성 Family·membership·Customer만 대상으로 한다.
- Family soft delete는 membership 원본을 수정하지 않고 Family와 구성원을 기본 조회·집계에서 숨긴다.
- Customer soft delete는 membership 원본을 유지하되 구성원 조회·집계에서 숨긴다.
- Family 보험료는 활성 구성원의 활성 `isIncluded=true` Policy 월보험료를 모두 합산하며 DB에 저장하지 않는다.
- `Customer.isManaged`와 자유 입력 Customer/Policy status를 합계 제외 조건으로 해석하지 않는다.
- 같은 Customer가 여러 Family에 속하면 각 Family 합계에 각각 한 번 포함하고 전체 Family 합계는 만들지 않는다.
- Family 목록은 name/id, 구성원 목록은 Customer name/id의 안정 순서로 표시한다.

## Implementation Plan

- [x] Family/FamilyMembership Prisma model과 네 번째 migration·FK·unique·index 추가
- [x] migration registry/hash와 v0–v4 runtime object·column·index·FK·unique drift 계약 갱신
- [x] clean DB, v3 upgrade 보존, active-parent·reactivation·drift Rust tests 구현
- [x] Rust Family CRUD와 membership list/add/update/delete repository·commands 구현
- [x] canonical UUID, strict payload, Unicode text와 값 비노출 오류 tests 구현
- [x] TypeScript family/membership types, Zod schema와 repository port 구현
- [x] 활성 Policy 월보험료를 Family별 `bigint`로 합산하는 순수 service 구현
- [x] Customer·Insurance 공개 application 계약을 조합하는 family application 구현
- [x] Browser localStorage adapter와 Tauri IPC adapter parity 구현
- [x] `/families` 목록·검색·CRUD, 중복 이름 ID 구분과 실제 sidebar navigation 구현
- [x] Family 구성원 관리 dialog의 합계·목록·add/edit/remove 구현
- [x] Family·membership·Customer 삭제 영향과 관계명 privacy 안내 구현
- [x] loading, empty, validation, adapter error, route async 격리 구현
- [x] dialog focus/error/Escape/호출 버튼 복귀와 390px responsive 구현
- [x] unit/adapter/component tests와 in-app Browser 실제 회귀 수행
- [x] release-mode 두 프로세스 E2E에 Family 다대다·합계·reload·restart·soft-delete 추가
- [x] README·data model·requirements·open questions 정합성과 운영 안내 갱신
- [x] 전체 QA와 standard production capability boundary 재검증
- [x] QA 이후 독립 정확성·UI·privacy 리뷰 findings 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`, `npm run typecheck`, `npm run test:unit`
- `npm run prisma:validate`, `npm run database:contract`
- `cargo fmt --check`, all-targets/all-features clippy `-D warnings`, `cargo test --all-features`
- `npm run qa`와 release-mode 실제 앱 `npm run test:e2e`
- in-app Browser에서 Family CRUD, 구성원 add/edit/remove/re-add, 여러 Family 소속, Policy 합계 포함/제외, reload를 확인
- keyboard focus·Escape·호출 버튼 focus 복귀, 390×844 layout과 가로 overflow를 확인
- E2E WebDriver·DB override가 표준 production bundle/capability에 포함되지 않는지 재검사
- `npm audit`, `git diff --check`, 민감정보·SQLite/temp artifact 잔존 검사를 수행

## Acceptance Scenarios

1. 기존 v3 DB의 Customer·Policy·Coverage·Category 행을 보존하며 v4 Family schema로 upgrade된다.
2. trim 후 1–100자 이름으로 Family를 생성하고 이름을 수정한다.
3. 빈/초과 이름, 잘못된 UUID와 unknown/missing IPC field가 TypeScript·Rust 경계에서 거부된다.
4. 활성 Customer를 선택 관계명으로 Family에 추가하고 관계명을 수정하며 법적 관계로 해석하지 않는 안내를 확인한다.
5. 한 Customer가 여러 Family에 속하고 각 Family 구성원 목록·합계에 각각 표시된다.
6. 같은 Family·Customer 활성 membership 추가는 거부되고 중복 행이 생기지 않는다.
7. membership soft delete 뒤 목록·합계에서 숨겨지고 재추가하면 기존 ID가 새 관계명으로 재활성화된다.
8. Family 합계는 활성 구성원의 활성 `isIncluded=true` Policy만 `bigint`로 손실 없이 합산한다.
9. Policy 포함 제외·재포함과 Policy soft delete가 Family 합계에 즉시 반영된다.
10. Customer soft delete는 membership 원본을 남기고 Family 구성원·합계에서 숨긴다.
11. Family soft delete는 membership 원본과 Customer·Policy를 남기고 Family 기본 목록에서 숨긴다.
12. renderer reload와 새 앱 프로세스 뒤 Family, membership 관계명과 합계 원본이 유지된다.
13. Family 구성원 dialog 대상 전환/실패가 이전 Family의 구성원·합계를 남기지 않는다.
14. 같은 이름의 Family를 별도 ID로 유지하고 목록·수정·삭제 action에서 정확히 구분한다.
15. form autofocus·첫 오류 focus·Escape·호출 버튼 focus 복귀와 390px layout이 동작한다.

## Review Plan

QA PASS 뒤 독립 `review_judge`, UI/접근성 reviewer와 `privacy_guard`가 다음을 확인한다.

- Family 이름·관계명 밖의 대표·민감·추론 필드를 저장하지 않는지
- 중복 Family 이름을 자동 병합하지 않고 ID별 action·route를 명확히 구분하는지
- membership unique·soft-delete·명시적 reactivation이 모든 adapter에서 같은지
- Family/Customer 삭제 시 membership 원본 유지와 active read 숨김 규칙이 같은지
- 합계에 active Customer·Policy와 `isIncluded`만 적용하고 `bigint`를 유지하는지
- family application이 Customer·Insurance 공개 계약을 사용하고 UI가 합계를 계산하지 않는지
- direct IPC가 unknown/missing field, invalid UUID/text를 거부하고 원문 값을 노출하지 않는지
- v3 upgrade와 migration history/runtime schema/FK/unique drift가 기존 데이터를 보호하는지
- 실제 Browser/release app 증거와 production capability boundary가 정확한지

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 `/goal`과 승인 운영 프로필을 plan-005 승인 근거로 기록 | 작은 후속 계획을 연속 진행하라는 승인 범위 안의 핵심 MVP 기능 |
| 2026-08-06 | Family CRUD·membership·가족 보험료를 한 수직 계획으로 구성 | 가족 grouping만 저장하면 사용자가 요구한 구성원 조회와 보험료 질문에 답할 수 없음 |
| 2026-08-06 | FamilyMembership을 별도 id와 pair unique를 가진 업무 entity로 정의 | 관계명·soft delete·명시적 재추가를 추적하면서 같은 가족 중복을 DB에서도 방지 |
| 2026-08-06 | 제거된 같은 pair 재추가는 기존 행을 명시적으로 재활성화 | soft-delete 원본을 보존하고 pair unique 때문에 영구적으로 재가입이 막히는 문제를 피함 |
| 2026-08-06 | 가족 보험료는 Customer.isManaged와 자유 status를 해석하지 않음 | 승인된 조건은 활성 구성원과 활성·합계대상 Policy임 |
| 2026-08-06 | 가족 보장 합계와 대표자·관계 enum은 Non-Goal로 유지 | 운영 프로필의 Family 승인 범위를 넘는 해석을 피함 |
| 2026-08-06 | Family 이름 중복은 허용하고 안정 ID로만 대상을 구분 | 승인되지 않은 uniqueness·자동 병합을 만들지 않으면서 오조작을 방지 |
| 2026-08-06 | `relationshipName`은 단순 표시 label로 한정 | 별도 인물·법적 관계·방향성·대표자 의미의 무단 추론을 막음 |
| 2026-08-06 | Family는 `/families` 목록과 구성원 관리 dialog로 제공 | 현재 CRUD UX와 일치하고 미승인 상세 route 상태 없이 빠른 관리 흐름을 완성 |
| 2026-08-06 | Family 이름과 관계명은 기존 text 경계와 같은 Unicode scalar 100자로 제한 | 실사용 자유 입력을 유지하면서 renderer·IPC·DB 경계의 일관된 유한 입력 보장 |
| 2026-08-06 | 구성원 dialog는 비동기 loading 해제 뒤 autofocus | 실제 WebKit E2E에서 loading 중 존재하지 않는 목록 버튼으로 포커스를 시도하는 결함을 발견해 렌더 완료 뒤로 이동 |
| 2026-08-06 | Family 검색은 SQLite `NOCASE` 규칙을 Browser에도 명시 적용 | locale-aware Browser 검색과 ASCII-only SQLite 검색의 Unicode 불일치를 없애고 adapter 결과를 고정 |
| 2026-08-06 | 최종 native E2E 뒤 표준 앱을 반드시 다시 빌드 | E2E feature가 포함된 계측 bundle을 배포 산출물로 남기지 않도록 production 경계를 종료 조건으로 고정 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | plan-004를 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-06 | repo_cartographer | 제품 문서, 승인 프로필, schema, route, E2E와 privacy 경계를 병렬로 매핑했다. |
| 2026-08-06 | plan_keeper | plan-005 전용 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-06 | harness_builder | v4 migration, Rust/TypeScript adapter, Family application, `/families` UI와 두 프로세스 E2E를 구현했다. |
| 2026-08-06 | quality_runner | 실제 macOS 앱에서 발견한 dialog focus 결함을 수정하고 회귀 테스트를 추가했다. |
| 2026-08-06 | quality_runner | Browser 실제 화면, 390×844 responsive, release app 재시작 persistence와 전체 QA를 통과시켰다. |
| 2026-08-06 | review_judge | Unicode 검색 parity, 중복 ID 대비, 추가 불가 안내와 삭제 후 focus findings를 제기했다. |
| 2026-08-06 | privacy_guard | 최종 E2E 계측 bundle 잔존을 지적하고 표준 앱 재빌드·무검출을 확인했다. |
| 2026-08-06 | plan_keeper | 모든 finding 해결·재검증 뒤 plan-005를 completed로 이동하고 review mirror를 작성했다. |

## QA Evidence

- command: 최종 수정 후 `npm run qa`
- result: PASS — ESLint, vue-tsc, Prisma validate, migration registry/diff, Vite build, cargo check, harness 포함.
- Vitest: 17 files / 70 tests PASS. Family UI focus·추가 불가 안내·Browser 검색 parity 회귀를 포함한다.
- Rust: 기본 및 `--all-features` 각각 63 tests PASS; `cargo fmt --check`와 all-targets/all-features clippy `-D warnings` PASS.
- v4 migration SHA-256: `d57399a43d17ff5b9a9f22975ab925f1bd217d6e78b950471015084ec692671e`; v3 upgrade 보존·runtime drift·FK·pair unique 검사를 통과했다.
- 실제 release-mode macOS 앱 E2E: write 2/2 PASS(14.4s), 새 프로세스 persistence 2/2 PASS(10.4s). Family CRUD, 중복 이름 ID, 다대다, 120,000원+80,000원 합계, 관계명 변경, active 중복 거부, membership ID 재사용, Policy/Customer/Family soft delete와 restart 복원을 검증했다.
- E2E 최초 실제 WebKit 회귀에서 구성원 dialog autofocus 결함을 발견했다. loading 해제 뒤 focus하도록 수정하고 UI 회귀 테스트를 추가한 뒤 전체 E2E를 재실행해 통과했다.
- in-app Browser 실제 화면: Family 생성, Customer 연결, 123,456원 합계, Escape 호출 버튼 복귀, reload 복원, Family 삭제 PASS.
- 390×844 Browser: mobile card 표시/table 숨김, `bodyScrollWidth=390`, dialog `clientWidth=scrollWidth=358`, console warning/error 0건.
- `npm audit --audit-level=low`: 취약점 0건. `git diff --check`: PASS. 하네스 line/privacy/artifact scan: PASS.
- 표준 `npm run tauri -- build --bundles app`: PASS. production 바이너리에 `BODAM_E2E_DB_PATH`, WDIO permission/plugin, `127.0.0.1:4445` 문자열 없음; default capability는 `core:default`만 보유한다.
- E2E 실행 로그 `.runtime/wdio-logs`는 증거 요약 뒤 삭제했다. 저장소에 SQLite/temp/실사용 행 artifact를 남기지 않았다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P2 | Browser locale lowercase와 SQLite ASCII `NOCASE`가 비ASCII 대소문자 검색에서 불일치 | Browser에 SQLite-compatible ASCII fold를 적용하고 Browser/Rust `Élodie Family` parity 테스트 추가 |
| P2 | 중복 Family/Customer 전체 ID가 light theme에서 3.64:1 저대비 | `--text-secondary`로 보정해 light 5.65:1, dark 8.78:1 확보 |
| P2 | 활성 고객을 모두 연결한 뒤 추가 불가 이유가 disabled button `title`에만 존재 | 항상 보이는 status 문구와 `aria-describedby` 연결, unit/native E2E 추가 |
| P2 | Family 삭제·검색 결과 밖 이름 수정 뒤 호출 행 제거 시 focus가 body로 유실 | 목록 갱신 뒤 존속하는 가족 검색 입력으로 focus 이동, page/native E2E 추가 |
| P1 | 최종 E2E 직후 계측용 WDIO/DB override bundle이 최신 앱 artifact로 남음 | feature 없는 표준 앱을 재빌드하고 binary·Info.plist·dist·default feature tree 무검출 재검사 |

모든 finding 해결 뒤 정확성, UI/접근성, 개인정보 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding 없이 PASS했다.

## Completion Notes

- 기존 v3 데이터를 보존하는 v4 Family/FamilyMembership migration과 strict Rust CRUD·soft-delete·동일 ID 재활성화를 완성했다.
- Browser/Tauri adapter, Customer·Insurance 공개 application 조합, Family별 `bigint` 월보험료와 `/families` 실제 UI를 완성했다.
- 실제 in-app Browser와 release-mode macOS 앱 두 프로세스에서 CRUD, 다대다, 합계, reload/restart, active-parent visibility, 390px와 keyboard 흐름을 합성 데이터로 검증했다.
- 최종 QA와 세 독립 관점 리뷰를 통과했고, 표준 production 앱에서 E2E DB override·WebDriver 기능이 없음을 다시 확인했다.
