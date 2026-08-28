# plan-034-settings-system-theme

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

설정 탭에서 기능 설정을 관리하고, 화면 테마를 라이트·다크·시스템 중 선택할 수 있게 한다. Google Calendar는 설정에서 간단히 연결할 수 있는지 검토하고 필요한 준비물을 안내한다.

## Approval

- 요청일: 2026-08-28
- 승인일: 2026-08-28
- 승인 근거: 사용자가 설정 탭 구현과 라이트·다크·시스템 테마 설정 추가를 명시적으로 요청했다.
- 승인 범위: 기존 Settings 화면과 저장 계약에 `system` 테마 선호를 추가하고 OS 테마 변경을 실시간 반영하며 관련 문서·migration·Browser/native 테스트를 갱신한다.
- 승인 제외: Google OAuth·Calendar API·network capability·token 저장·일정 동기화 구현과 임의의 추가 on/off 기능. 이는 전송 데이터와 동기화 규칙을 사용자와 확정한 별도 Exec Plan에서 다룬다.

## Goal

- 기존 `/settings` 화면에서 라이트·다크·시스템 테마를 선택하고 영구 저장한다.
- `system` 선택 시 OS 색상 선호를 첫 화면부터 적용하고 실행 중 변경도 반영한다.
- 상단 빠른 테마 버튼이 세 가지 저장 선호를 일관되게 순환하고 안전하게 저장한다.
- 기존 대시보드·백업·Coverage Benchmark 설정을 변경하지 않는다.
- Google Calendar 버튼 연동 가능성과 선행 준비물을 공식 근거로 보고한다.

## Non-Goals

- 새 Settings route를 중복 생성하거나 기존 설정 구조를 재작성
- 알림·백업·완료 일정 표시 등 승인되지 않은 boolean 설정 추가
- Google 계정 로그인, OAuth callback, Calendar API 호출, 일정 업로드·다운로드·양방향 동기화
- Google token·고객/일정 데이터를 SQLite, backup, log 또는 문서에 저장
- Windows 외 플랫폼별 새 배포 정책이나 원격 backend 추가

## Context Map

- `src/features/settings`: 테마 입력·검증·저장 UI/application/repository
- `src/app/stores/ui.ts`: 저장된 테마 선호와 실제 적용 light/dark 해석
- `src/app/shell/AppShell.vue`: 상단 빠른 테마 버튼과 OS theme listener 수명주기
- `database/prisma`, `src-tauri/src/settings`, `src-tauri/src/database/schema`: `system` 저장 migration·검증·runtime schema 계약
- `docs/product`, `docs/architecture`, `docs/privacy`: 승인된 Settings 범위와 Google 연동 후속 경계

## Constraints

- `codex/plan-034-settings-system-theme`와 `.worktree/plan-034-settings-system-theme`에서만 구현·검증한다.
- 순서는 계획·승인 → 구현 → QA → 독립 리뷰 → 완료 plan/review → commit이다.
- SQLite가 canonical setting source이고 localStorage는 첫 paint cache로만 사용한다.
- 저장 선호 `light|dark|system`과 실제 적용 색상 `light|dark`를 타입과 DOM에서 구분한다.
- OS theme listener는 중복 등록하지 않고 component/store 수명주기에서 정리한다.
- source·문서·migration·생성물은 300줄 전에 책임 단위로 분리한다.
- 실제 고객 데이터·외부 통신·새 broad capability를 사용하지 않는다.

## Theme Contract

- 저장 가능한 선호는 `light`, `dark`, `system`이며 기존 DB row는 그대로 `light|dark`로 유효하다.
- 기본값은 기존 계약을 보존해 `light`다. migration은 CHECK만 확장하고 현재 값을 바꾸지 않는다.
- `system`의 실제 색상은 `matchMedia('(prefers-color-scheme: dark)')`로 해석한다.
- DOM `data-theme`와 `color-scheme`에는 실제 `light|dark`만 기록하고 localStorage cache에는 저장 선호를 기록한다.
- `system` 선택 중 OS 선호 변경은 저장 write 없이 즉시 다시 적용한다.
- 상단 버튼은 현재 저장 선호에서 라이트 → 다크 → 시스템 → 라이트 순으로 이동하며 다음 동작을 접근 가능한 이름으로 알린다.

## Implementation Plan

- [x] Plan-034와 승인 범위를 기록하고 전용 branch/worktree를 확인한다.
- [x] product/architecture Settings 계약을 `light|dark|system`으로 갱신한다.
- [x] Prisma migration, Rust settings validation/repository/schema registry에 `system`을 추가한다.
- [x] TypeScript schema·store·Settings UI·topbar quick action에 system 선호와 OS 변경 반영을 구현한다.
- [x] 설정·첫 paint·runtime OS 변경·native DB migration 회귀 테스트를 추가한다.
- [x] 집중 테스트와 전체 QA를 실행하고 증거를 기록한다.
- [x] QA 통과 뒤 독립 리뷰 findings를 해결한다.
- [x] plan을 completed로 이동하고 동일 번호 review mirror를 작성한다.

## QA Plan

- 집중: settings schema/application/repository/component/store/shell tests
- DB: migration registry/schema settings/Rust validation·repository tests
- 통합: `npm run qa`, `npm run verify`
- 문서/구조: `python3 harness/scripts/run_qa.py`, QA 뒤 `python3 harness/scripts/run_review.py`, `git diff --check`, 300줄 gate
- 시나리오: 세 모드 저장·재로드, system 첫 paint, OS light↔dark runtime change, topbar 순환·동시 저장 실패 최신 상태 유지, 기존 light/dark DB migration

## Acceptance Scenarios

1. Settings 화면에 라이트·다크·시스템 세 선택지가 있고 저장 후 재실행에도 선호가 유지된다.
2. system 선택 시 현재 OS 모드가 적용되고 OS 모드 변경을 앱 재시작 없이 반영한다.
3. DOM과 CSS에는 해석된 light/dark만 적용되어 기존 theme token 계약이 유지된다.
4. 상단 빠른 버튼은 세 모드를 순환하고 저장 실패 시 더 최신인 Settings 결과를 덮어쓰지 않는다.
5. 기존 Settings·Dashboard·backup·Calendar 기능과 migration/runtime schema 검사가 통과한다.
6. Google 원격 호출·token·network capability는 추가되지 않는다.

## Review Plan

QA 통과 뒤 independent reviewer가 migration 안전성, 저장 선호/실제 테마 분리, listener 수명주기, 접근성, 기존 설정 회귀, 개인정보·원격 경계와 증거를 검토한다.

## Open Questions

- Google Calendar 연동 방향, 전송 일정 종류, 대상 캘린더, 자동화 수준, 충돌·삭제 규칙, token 저장·철회는 사용자 결정 뒤 별도 계획에서 승인한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-28 | 사용자 요청 자체를 system theme 범위의 승인 근거로 기록 | 라이트·다크·시스템 설정을 명시적으로 요청함 |
| 2026-08-28 | 기존 Settings route를 확장하고 중복 탭을 만들지 않음 | `/settings`와 영속 설정·백업·Benchmark UI가 이미 구현·검증됨 |
| 2026-08-28 | Google Calendar 구현은 후속 계획으로 분리 | 외부 전송·OAuth token·동기화 충돌·network 권한이 현재 offline-first 계약을 바꾸며 필수 선택이 남아 있음 |
| 2026-08-28 | 첫 paint는 CSP 허용 same-origin 동기식 script로 적용 | Vue module graph와 CSS 전 화면에서 cache와 OS 선호를 해석해 light flash를 막음 |
| 2026-08-28 | 상단 테마는 저장 성공 뒤 적용 | optimistic rollback이 동시 Settings 저장의 더 최신 canonical 결과를 덮지 않게 함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-28 | plan_keeper | 필수 제품·아키텍처·품질·개인정보 문서와 기존 Settings/Calendar 구현을 확인하고 Plan-034를 작성했다. |
| 2026-08-28 | harness_builder | system 저장 선호와 resolved light/dark를 분리하고 Settings·topbar·OS theme listener와 v10 migration을 구현했다. |
| 2026-08-28 | quality_runner | 수정 전 전체 `npm run verify`와 수정 후 전체 `npm run qa`를 통과했다. 최종 release E2E 재검증을 준비했다. |
| 2026-08-28 | review_judge | 첫 paint 선적용과 동시 설정 저장 실패 복구에 관한 P2 두 건을 보고했다. 동기식 bootstrap과 성공 후 적용 방식으로 수정하고 회귀 테스트를 추가했다. |
| 2026-08-28 | quality_runner | 수정 후 최종 `npm run verify`를 exit 0으로 완료해 release-mode macOS Tauri E2E까지 재검증했다. |
| 2026-08-28 | review_judge / privacy_guard | 두 P2 해소와 새 P0–P3 finding 없음, Google 원격·개인정보 경계 준수로 최종 승인했다. |

## QA Evidence

- result: PASS
- 수정 후 `npm run qa`: PASS — Vitest 90 files/389 tests, Rust 321 tests, lint, typecheck, Prisma validate·migration registry/diff, Vite build, Tauri check와 repository harness.
- 집중 frontend: PASS — pre-paint production build 순서·system cold-start와 Settings/topbar 동시 저장 실패 회귀를 포함한 3 files/11 tests.
- 집중 native: PASS — Settings DB 8 tests, validation/repository/commands 10 tests, database module 48 tests와 v9 backup working-copy migration.
- `cargo fmt --check`, `git diff --check`, 300줄 gate: PASS.
- 최종 `npm run verify`: PASS (exit 0) — QA 재실행 뒤 release-mode macOS Tauri 앱을 다시 빌드해 native write 6/6, restart 4/4, XLSX/CSV import·persistence·export·round-trip·rollback과 Settings·backup/restore/exit parent orchestration을 재검증했다.
- E2E note: restore와 세 exit-oriented WDIO reporter의 `FAILED` 표시는 의도된 앱 재시작·종료이며 후속 상태 검증을 포함한 parent runner가 exit 0으로 완료했다.
- build note: production main chunk 533.56 kB가 500 kB warning을 유지한다. 기능·보안 실패는 아니며 후속 성능 후보다.

## Review Findings

- resolved P2 — Vue/CSS 이후에만 테마를 초기화해 system-dark cold start에서 light 화면이 먼저 보일 수 있었다. `index.html` head의 CSP-compatible same-origin 동기식 bootstrap으로 cache·OS 선호를 먼저 해석하고 production build의 script/CSS 순서 회귀 테스트를 추가했다.
- resolved P2 — Settings 전체 저장과 상단 테마 저장이 겹칠 때 실패 rollback이 더 최신 canonical theme를 덮을 수 있었다. 상단 동작을 저장 성공 후 적용으로 바꾸고 deferred 동시성 회귀 테스트를 추가했다.
- independent post-finding code/product/privacy re-review: 기존 finding 해소, 새 P0–P3 finding 없음, 승인 가능.

## Completion Notes

- 기존 `/settings` 화면에 라이트·다크·시스템 선택을 추가했고 SQLite v10 migration으로 영구 저장한다.
- system 선택은 첫 paint와 실행 중 OS light/dark 변경 모두 반영하며 DOM에는 resolved `light|dark`만 둔다.
- 기존 dashboard·backup·Coverage Benchmark 설정과 v9 backup restore prefix를 보존했다.
- Google Calendar는 원격 전송·OAuth·token 보관 결정을 추측하지 않고 별도 후속 계획으로 남겼으며, 필요한 준비물과 권장 최소 범위를 사용자에게 보고한다.
- 잔여 위험은 533.56 kB production chunk warning과 아직 구현하지 않은 Google Calendar 연동이다.
