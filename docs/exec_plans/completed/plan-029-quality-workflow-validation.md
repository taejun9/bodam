# plan-029-quality-workflow-validation

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

전체 test와 lint를 깨끗하게 만들고, 합성 fixture만 사용하는 실제 프로젝트 화면에서 기능을 테스트하며, 보험 관리사의 고객·계약·상담·일정 관리 목적에 잘 맞는지 확인한다.

## Approval

- 요청일: 2026-08-09
- 승인일: 2026-08-09
- 승인 근거: 사용자가 `/goal all test and lint clean`과 실제 프로젝트 화면 테스트 및 보험 관리사 목적 적합성 확인을 명시적으로 요청했다.
- 승인 범위: 현재 승인된 제품 요구사항 안의 lint/test/QA 실패와 실제 화면 결함 수정, 브라우저 UI 수동 검증, release-mode Tauri 전체 E2E, 보험설계사 1인 CRM 업무 흐름 적합성 평가
- 승인 프로필: `docs/product/product.md`, `docs/product/requirements.md`, `docs/privacy/principles.md`의 현재 승인 범위

## Goal

- `npm run lint`, 전체 unit/Rust/database/build/harness QA와 release-mode Tauri E2E를 모두 통과한다.
- 실제 프로젝트 화면에서 합성 데이터로 주요 보험설계사 흐름, empty/loading/error/validation 상태와 화면 사용성을 확인한다.
- 제품 정의·요구사항과 관찰된 화면을 대사해 보험설계사 1인 로컬 CRM 적합성, 제한과 잔여 위험을 근거와 함께 보고한다.

## Non-Goals

- `docs/product/open-questions.md`의 미결정 보험 규칙을 추측해 구현하지 않는다.
- 새로운 보험 추천, 규제 준수 판단, 의료·재무 자문 기능을 추가하지 않는다.
- 실제 고객 데이터, 첨부 원본, 원격 서비스, telemetry와 cloud sync를 사용하지 않는다.
- 현재 목표와 무관한 기능 확장이나 디자인 전면 개편을 하지 않는다.

## Context Map

- 제품·개인정보 계약: `docs/product/`, `docs/privacy/principles.md`
- Vue 화면과 application 경계: `src/App.vue`, `src/features/`, `src/shared/`
- 네이티브 저장·IPC: `src-tauri/`, `database/prisma/`
- 자동 검증: `package.json`, `harness/scripts/`, `e2e/`, `wdio.conf.mjs`
- 결과 기록: 이 plan과 `docs/reviews/plan-029-quality-workflow-validation.md`

## Constraints

- `codex/plan-029-quality-workflow-validation`와 `.worktree/plan-029-quality-workflow-validation`에서만 구현한다.
- QA 뒤 독립 리뷰를 수행하고, 리뷰 전 커밋하지 않는다.
- UI가 계산 규칙이나 저장 방식을 직접 소유하지 않게 한다.
- 소스·문서·migration·생성물은 300줄 전에 책임 단위로 분리한다.
- 합성 고객·계약 데이터만 사용하고 화면·로그·문서에 실제 행 값을 남기지 않는다.
- 브라우저 UI는 명시적 합성 preview 저장소이며 SQLite 지속성 주장은 Tauri E2E 증거로만 한다.

## Open Questions

- 없음. 발견된 새 도메인 결정은 구현하지 않고 `docs/product/open-questions.md` 또는 후속 계획 후보로 기록한다.

## Implementation Plan

- [x] baseline lint, unit, database, build, harness와 전체 QA를 실행해 실패를 재현한다.
- [x] 실패를 기존 요구사항·계층·개인정보 경계 안에서 최소 수정하고 집중 검증한다.
- [x] 합성 preview 데이터로 실제 브라우저 화면의 핵심 탐색과 업무 흐름을 수동 검증한다.
- [x] release-mode Tauri 앱의 실제 UI/native/restart/import/export/backup E2E를 실행한다.
- [x] 보험설계사 핵심 질문과 각 화면·기능을 대사하고 적합성·제한·잔여 위험을 기록한다.
- [x] 전체 QA와 verify를 재실행하고 QA evidence를 plan에 기록한다.
- [x] QA 이후 독립 코드·제품·개인정보 리뷰를 수행해 finding을 해결한다.
- [x] plan을 completed로 이동하고 동일 번호 review mirror를 작성한다.

## QA Plan

- `npm run lint`
- `npm run qa`
- `npm run verify`
- `python3 harness/scripts/run_review.py`
- `git diff --check`와 변경 파일 300줄 제한 확인
- 실제 화면: Dashboard, 고객, 가족, 계약·보장, 상담, Calendar·일정, 데이터 관리, 설정·백업의 탐색·표시·validation 확인
- 경계: empty state, 좁은 viewport, keyboard focus, 민감정보 안내, 실제 데이터 비사용

## Acceptance Scenarios

1. lint와 전체 비-GUI QA가 exit 0이다.
2. release-mode Tauri E2E가 합성 SQLite로 실제 앱 화면과 재시작 지속성을 통과한다.
3. 브라우저 실제 화면에서 주요 메뉴·목록·상세·dialog가 열리고 핵심 업무 질문으로 이동할 수 있다.
4. 발견된 기존 요구사항 결함은 수정되고 새 도메인 결정은 범위 밖으로 분리된다.
5. 개인정보 금지 항목이 fixture, log, screenshot과 새 UI 필드에 포함되지 않는다.
6. 독립 리뷰에 해결되지 않은 P0-P2 finding이 없다.

## Review Plan

QA 통과 뒤 independent reviewer가 변경 diff, 자동·실화면 증거, 제품 요구사항 추적, 보험설계사 업무 적합성, 개인정보·로컬 전용 경계를 검토한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-09 | 사용자 요청 자체를 Plan-029 승인으로 기록 | test/lint 정리, 실제 화면 검증과 보험 관리사 적합성 확인 범위가 명시적임 |
| 2026-08-09 | 브라우저 합성 preview와 release-mode Tauri E2E를 함께 사용 | 화면 사용성과 실제 SQLite/native 지속성의 증거 범위를 구분 |
| 2026-08-09 | 새 보험 규칙은 구현하지 않고 제한 또는 후속 후보로 보고 | 승인되지 않은 도메인 추측 방지 |
| 2026-08-09 | pathname이 바뀌는 새 업무 화면만 시작 위치에서 열고 같은 화면 query와 history 위치는 보존 | 긴 화면 간 이동 결함을 고치되 Calendar 내부 탐색과 뒤로가기를 회귀시키지 않음 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-09 | plan_keeper | Plan-029 branch/worktree와 승인된 실행 계획을 만들었다. |
| 2026-08-09 | quality_runner | ESLint, 전체 비-GUI QA, rustfmt와 all-target/all-feature Clippy 기준선을 PASS했다. |
| 2026-08-09 | quality_runner | 실제 브라우저 화면에서 고객·계약·가족 보험료·일정·데이터 관리·설정·반응형 흐름을 검증하고 route scroll 결함을 재현했다. |
| 2026-08-09 | quality_runner | Router 수정 뒤 실제 화면에서 715.5px 위치에서 route 이동해 0px로 열리는 회귀 시나리오를 PASS했다. |
| 2026-08-09 | quality_runner | 최종 `npm run verify`가 전체 비-GUI QA와 release-mode Tauri E2E를 exit 0으로 완료했다. |
| 2026-08-09 | review_judge | P2: 무조건 top reset이 Calendar query와 history 위치를 잃는 범위를 발견해 pathname/query/history 계약으로 수정했다. |
| 2026-08-09 | quality_runner | P2 수정 뒤 frontend 84 files/370 tests와 전체 release-mode Tauri E2E를 포함한 `npm run verify`를 다시 PASS했다. |
| 2026-08-09 | review_judge | 코드 재심, 개인정보·제품범위 심사와 QA evidence 심사에서 잔여 P0–P3 없음으로 승인했다. |
| 2026-08-09 | plan_keeper | completed plan 이동과 동일 번호 review mirror를 작성했다. |

## QA Evidence

- result: PASS — baseline/final `npm run lint`; ESLint error·warning 0건.
- result: PASS — `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
- result: PASS — `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`.
- result: PASS — focused `npm run test:unit -- src/app/router/index.test.ts`.
- result: PASS — final post-review-fix `npm run verify`; frontend 84 files/370 tests, Rust 319 tests, Prisma registry/diff, production Vite build, Tauri check와 full harness.
- result: PASS — release-mode Tauri UI/native flow 6/6과 restart persistence 4/4.
- result: PASS — XLSX/CSV import·persistence·export·independent parser round-trip, transaction rollback과 DB logical assertions.
- result: PASS — Settings, manual backup, mutate, pending restore-before-open, exact restored DB, host-local re-authorization와 exit/idempotency parent contract.
- result: PASS — Browser desktop actual screen: Dashboard→Customer detail, blank Customer validation/focus restore, Family 생성·Customer 연결·123,456원 합산, Schedule 생성·Customer 연결·완료, Data Exchange와 Backup plaintext 안내, light/dark.
- result: PASS — Browser 390×844 responsive Customer card와 mobile navigation; viewport reset 완료.
- result: PASS — actual route regression: Calendar agenda interaction 뒤 `scrollY=715.5`, Data Exchange navigation 뒤 `scrollY=0`; browser console error·warning 0건.
- note: Vite production/e2e build는 단일 main chunk 529.63/532.54 kB 경고를 표시했지만 build와 runtime은 통과했다.
- note: restore와 세 종료형 WDIO reporter의 session-level `FAILED`는 앱 재시작·종료로 의도된 결과이며 successful parent orchestrator가 후속 restored state, snapshot과 cleanup을 검증해 `npm run verify`는 exit 0이다.

## Insurance Manager Workflow Fit

- strong fit — 보험설계사 1명의 Windows/offline/local SQLite 고객·가족·계약·보장·상담·일정 관리가 제품 정의와 실제 화면의 주 흐름이다.
- strong fit — Dashboard가 오늘 연락, 30/60/90일 상령·만기, 보험료, 가족 보험료, 보장 부족, 최근·미상담 질문을 바로 제공한다.
- strong fit — Customer detail에서 계약·보장·상담을 묶고 Family와 Calendar가 가구 보험료·후속 연락을 연결한다.
- strong fit — 21열 Excel/CSV 검증·preview·atomic import/export와 local backup/restore가 기존 파일 중심 업무를 지원한다.
- conditional use — 전용 Windows 계정, OS 전체 디스크 보호와 자동 잠금이 필요하다. DB·backup·export는 평문이고 app lock은 없다.
- gap — 전역 계약 검색, 수동 계약 증권번호, 갱신 주기·다음 갱신일, OS notification, 완전 삭제·보관 정책은 현재 제공되지 않는다.
- out of scope — 팀 협업·동기화, 모집 pipeline·수수료, 동의·준법 감사, 첨부 서류와 공식 적합성 추천은 현재 제품 범위가 아니다.

## Review Findings

- resolved P2 — 무조건 top reset이 Calendar query 탐색과 browser history 위치를 잃을 수 있었다. `savedPosition` 우선, same-path 유지, pathname 변경만 top으로 계약을 좁히고 세 회귀 test와 전체 verify를 통과했다.
- resolved P3 — 첫 verify의 368 test count가 review fix 뒤 370으로 늘어난 완료 증거를 반영하지 못했다. 최종 수치로 교정했다.
- independent code, privacy/product와 QA evidence review: 잔여 P0–P3 finding 없음.

## Completion Notes

- 완료 결과: ESLint, rustfmt, all-target/all-feature Clippy, 전체 QA와 release-mode Tauri E2E가 깨끗하다. 실제 화면에서 발견한 업무 화면 간 scroll 결함을 history와 Calendar 내부 위치를 보존하는 방식으로 해결했다.
- 적합성: 전용 Windows 계정에서 고객·가족·계약·보장·상담·후속 일정과 Excel 중심 업무를 관리하는 보험설계사 1인 CRM에는 높은 적합성이다.
- 잔여 위험: 500 kB main chunk build 경고, 평문 SQLite·backup·export, app lock·완전 삭제 부재와 전역 계약 검색·증권번호·갱신일·OS notification 공백이 남는다.
- 후속 계획: 실데이터 도입 전 OS 전체 디스크 보호·자동 잠금·전용 계정을 확인하고, 새 승인이 있으면 앱 잠금/보존 정책과 전역 계약·갱신 관리 순으로 검토한다.
