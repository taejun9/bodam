# plan-033-app-quality-audit

## Status

completed

## Owner

project_lead / plan_keeper / quality_runner / review_judge

## User Request

실제 앱을 실행해 모든 기능을 테스트하고, 발견한 버그를 수정하며, 토론을 거쳐 필요한 추가·수정 기능도 구현한다.

## Approval

- 요청일: 2026-08-22
- 승인일: 2026-08-22
- 승인 근거: 사용자가 실제 앱 전 기능 테스트, 재현 버그 수정, 토론을 거친 추가·수정 기능 작업을 명시적으로 요청했다.
- 승인 범위: 문서화된 현재 MVP 기능의 실제 화면·native 경로 재검증, 합성 데이터에서 재현된 결함 수정, 기존 제품 계약과 데이터 모델을 바꾸지 않는 저위험 사용성·접근성 개선
- 승인 제외: 미결정 보험 규칙, 새 저장 필드·migration, 원격 통신, 민감정보 수집, Windows 전용 installer/VM 실기동, 후속 범위로 명시된 새 도메인 기능
- 승인 프로필: `docs/product/product.md`, `docs/product/requirements.md`, `docs/product/open-questions.md`, `docs/architecture/system-overview.md`, `docs/privacy/principles.md`

## Goal

- 현재 문서화된 고객·가족·계약·보장·상담·Dashboard·Calendar·일정·데이터 교환·백업·설정 흐름을 실제 앱에서 검증한다.
- 자동 QA와 실제 화면에서 재현되는 결함을 기존 계층·개인정보 계약 안에서 수정한다.
- 제품·QA·개인정보·사용성 관점의 토론으로 개선 후보를 평가하고, 새 도메인 결정이 필요 없는 명확한 개선만 구현한다.
- 최종 전체 QA와 독립 리뷰를 통과하고 재현 절차·수정·잔여 위험을 기록한다.

## Non-Goals

- 상태 공간 전체를 수학적으로 완전 탐색했다고 주장하지 않는다. `requirements.md`의 현재 MVP와 명시적 오류·경계 상태를 기능 매트릭스로 검증한다.
- `open-questions.md` 또는 현재 제한에 있는 보험료 구성, 갱신 주기, 반복 일정, OS notification, app lock 등의 규칙을 추측하지 않는다.
- 실제 고객 데이터·첨부 원본·운영 DB를 사용하거나 screenshot·log·fixture에 복사하지 않는다.
- 원격 서비스, telemetry, cloud sync, 의료·보험·규제 판단을 추가하지 않는다.
- 현재 macOS 실행 환경에서 Windows installer wizard, UAC, WebView2 없는 offline VM을 실행했다고 주장하지 않는다.

## Context Map

- 제품·요구사항: `docs/product/`, `README.md`
- 구조·경계: `docs/architecture/`, `docs/privacy/principles.md`
- Vue 화면: `src/app/`, `src/features/`, `src/shared/`
- native·SQLite: `src-tauri/`, `database/prisma/`
- 자동·실앱 검증: `package.json`, `e2e/`, `wdio.conf.mjs`, `harness/scripts/`
- 결과 기록: 이 plan과 `docs/reviews/plan-033-app-quality-audit.md`

## Constraints

- `codex/plan-033-app-quality-audit`와 `.worktree/plan-033-app-quality-audit`에서만 구현한다.
- 순서는 계획·승인 → 구현 → QA → 독립 리뷰 → 완료 문서 → 커밋이다.
- UI는 application 계약만 호출하고 비즈니스 계산·저장 규칙을 소유하지 않는다.
- 소스·문서·migration·생성물은 300줄 전에 책임 단위로 분리한다.
- 실제 화면 데이터는 합성 fixture만 사용하고 browser preview와 native SQLite 증거 범위를 구분한다.
- 개선은 관찰 가능한 문제, 기존 요구사항 근거, 회귀 검증을 모두 갖춘 경우에만 구현한다.

## Open Questions

- 실제 검증 중 새 도메인 선택이 필요한 후보는 구현하지 않고 `docs/product/open-questions.md` 또는 후속 계획 후보로 남긴다.
- 저위험 개선의 최종 선택은 기능 매트릭스 결과를 놓고 project_lead·plan_keeper·quality_runner·privacy_guard 관점의 토론과 Decision Log로 확정한다.

## Implementation Plan

- [x] 저장소 상태와 실행 전제를 확인하고 전체 QA 기준선을 실행한다.
- [x] release-mode Tauri E2E와 합성 runtime으로 native SQLite·IPC·재시작·파일 경로를 검증한다.
- [x] 실제 브라우저 preview에서 전체 라우트, 핵심 CRUD dialog, empty/error/validation, keyboard·responsive·theme 상태를 수동 검증한다.
- [x] 요구사항 기반 기능 매트릭스에 각 시나리오의 PASS/FAIL/NOT RUN과 증거 범위를 기록한다.
- [x] 재현된 버그를 최소 단위 테스트와 함께 수정하고 집중 재검증한다.
- [x] 역할별 토론으로 개선 후보를 평가하고 승인 경계 안의 선정 항목을 구현·검증한다.
- [x] 전체 `npm run verify`와 추가 품질 검사를 실행하고 QA evidence를 기록한다.
- [x] QA 통과 뒤 독립 코드·제품·개인정보 리뷰를 수행하고 findings를 해결한다.
- [x] plan을 completed로 이동하고 동일 번호 review mirror를 작성한다.

## QA Plan

- 기준선·최종: `npm run lint`, `npm run qa`, `npm run verify`
- Rust 추가 품질: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- 문서·구조: `python3 harness/scripts/run_qa.py`, QA 뒤 `python3 harness/scripts/run_review.py`, `git diff --check`, 300줄 gate
- 실제 앱: release-mode Tauri E2E의 고객·가족·계약·보장·Benchmark·상담·Dashboard·Calendar·일정·XLSX/CSV·backup/restore·restart 흐름
- 브라우저 preview: 전체 navigation, desktop/mobile viewport, light/dark, dialog focus·취소·validation, empty/loading/error 안내, console error·warning
- 개인정보: fixture·출력·screenshot에 실제 고객 행과 저장 금지 정보가 없는지 검사

## Acceptance Scenarios

1. 문서화된 현재 MVP 기능 매트릭스의 각 항목이 PASS 또는 환경 근거가 있는 NOT RUN으로 기록된다.
2. release-mode Tauri E2E가 합성 SQLite에서 실제 UI/native/restart/import/export/backup 흐름을 통과한다.
3. 실제 화면에서 발견된 재현 버그는 회귀 test와 함께 해결된다.
4. 토론으로 선정한 개선은 기존 도메인·개인정보 계약을 바꾸지 않고 사용성 또는 오류 복구를 관찰 가능하게 높인다.
5. 전체 QA·Clippy·review가 통과하고 해결되지 않은 P0–P2 finding이 없다.
6. 실제 고객 데이터, 저장 금지 필드, 원격 의존성이나 broad filesystem 권한이 추가되지 않는다.

## Review Plan

QA 통과 뒤 independent reviewer가 변경 diff, 기능 매트릭스, 실제 앱 증거, 제품 요구사항 추적, 계층 경계, 개인정보와 미실행 플랫폼 주장의 정확성을 검토한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-22 | 사용자 요청 자체를 Plan-033 승인 근거로 기록 | 전 기능 실제 앱 테스트, 버그 수정, 토론 후 개선 작업을 명시적으로 요청함 |
| 2026-08-22 | 기능 범위를 현재 문서화된 MVP로 정의 | “모든 기능”을 재현 가능한 요구사항 매트릭스로 검증하고 미결정 규칙 추측을 방지함 |
| 2026-08-22 | 브라우저 preview와 release-mode Tauri E2E를 함께 사용 | 시각·상호작용 검증과 native SQLite·IPC·filesystem·restart 증거를 구분함 |
| 2026-08-22 | 새 도메인 결정 없는 저위험 개선만 이번 plan에서 자율 선정 | 사용자의 개선 요청을 수행하면서 후속 범위와 미결정 보험 규칙을 보호함 |
| 2026-08-22 | 역할 토론 결과 관찰된 저위험 UI 결함을 모두 수정 | 제품·사용성·개인정보 검토가 삭제 후 focus, 상세 retry, 두 form 오류 연결, light contrast, 장문 이름 wrapping, 현재 route menu focus와 theme toggle 의미 교정을 기존 계약 안의 일관된 최소 묶음으로 승인함 |
| 2026-08-22 | `nanoid` override 시도를 철회하고 dependency graph를 불변 유지 | 최소 override도 검증된 Windows npm/E2E trust hash를 바꿔 harness가 fail-closed 했고 현재 macOS에서는 그 Windows 증거를 재승인할 수 없음; breaking `--force`와 검증 hash 임의 갱신은 하지 않음 |
| 2026-08-22 | 이미 승인된 운영 규칙을 open question에서 해결 항목으로 이동 | 승인 운영 프로필과 ADR-001에 월납입액·기간·Coverage·runtime 경계가 명시돼 문서 간 상태가 어긋나 있었음 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-22 | plan_keeper | 필수 제품·요구사항·아키텍처·품질·개인정보 문서를 확인하고 Plan-033 branch/worktree를 만들었다. |
| 2026-08-22 | quality_runner | 기준선 `npm run qa`에서 frontend 370개와 Rust 319개를 포함한 689개 test, lint·typecheck·build·database·harness를 PASS했다. |
| 2026-08-22 | quality_runner | baseline release-mode Tauri E2E가 고객·계약·보장·Benchmark·가족·상담·Dashboard·Calendar·XLSX/CSV·backup/restore·restart를 exit 0으로 완료했다. |
| 2026-08-22 | project_lead | 실제 browser preview에서 합성 고객→계약→보장→상담→가족 보험료→Calendar 일정, 설정 validation·theme, data exchange/backup 안내와 390px mobile 흐름을 확인했다. |
| 2026-08-22 | plan_keeper / review_judge / privacy_guard | 일곱 개선 후보의 사용자 영향, 계층·개인정보 경계를 토론해 전 항목을 이번 plan 구현 범위로 확정했다. |
| 2026-08-22 | harness_builder | UI 계층 안에서 focus 복구·retry·오류 설명 연결·contrast·responsive·menu/theme 의미를 수정하고 회귀 test를 추가했다. |
| 2026-08-22 | repo_cartographer | 승인 운영 프로필과 ADR-001에 의해 해결된 항목을 `open-questions.md`에서 정리하고 실제 미결정 항목은 유지했다. |
| 2026-08-22 | quality_runner | dependency override가 Windows npm trust gate를 무효화하는 것을 통합 QA로 발견해 lock 변경을 철회했고, 최종 `npm run qa`와 `npm run verify`를 PASS했다. |
| 2026-08-22 | review_judge | P2 두 건(Calendar reload 실패 focus, placeholder 합성 대비)과 P3 문서 정합성을 발견했다. |
| 2026-08-22 | quality_runner | 세 finding을 수정하고 Browser 재검증과 총 701 tests·release Tauri E2E를 포함한 post-finding `npm run verify`를 PASS했다. |
| 2026-08-22 | review_judge | post-finding 재리뷰에서 기존 세 finding 해결과 잔여 P0–P3 없음으로 승인했다. |

## QA Evidence

- result: PASS — 최종 post-finding `npm run verify`, Browser 재검증, rustfmt·Clippy와 repository gate를 모두 통과했다.
- baseline `npm run qa`: PASS — Vitest 84 files/370 tests, Rust 319 tests, 총 689 tests와 lint·typecheck·Prisma·migration contract·Vite build·Tauri check·13개 harness 검사.
- baseline `npm run test:e2e`: PASS — release-mode macOS Tauri 앱의 native write 6/6, restart 4/4, XLSX/CSV import·export·round-trip·rollback, Settings·backup·restore·exit parent orchestration.
- note: restore와 세 종료형 WDIO session의 reporter `FAILED`는 의도된 app restart/exit이며 후속 검증과 성공한 parent orchestrator가 상태·cleanup을 확인해 전체 exit 0.
- browser actual screen: PASS — 합성 CRUD·합계·Calendar 연결, validation focus와 `aria-describedby`, theme/settings, native-only safe 안내, 390×844 mobile menu 현재 route focus·Escape 복귀·card wrapping, console warning/error 0건을 확인함.
- dependency audit: RESIDUAL — 기준 lock의 production transitive `nanoid@3.3.17` high 1건과 Prisma/WDIO 개발 도구를 포함한 전체 high 17건. `npm audit fix`는 peer ERESOLVE, 최소 override는 Windows trust gate를 무효화해 철회했으며 `--force` 또는 신뢰 hash 임의 갱신은 하지 않는다.
- pre-review `npm run qa`: PASS — Vitest 88 files/380 tests와 Rust 319 tests, 총 699 tests; lint·typecheck·Prisma·migration contract·build·Tauri check·13개 harness 검사.
- final `cargo fmt -- --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `git diff --check`: PASS.
- final post-finding `npm run verify`: PASS (exit 0) — Vitest 89 files/382 tests와 Rust 319 tests, 총 701 tests 뒤 release-mode macOS Tauri 앱을 다시 빌드해 native write 6/6, restart 4/4, XLSX/CSV·rollback·Settings·backup/restore/exit orchestration을 재검증함.
- build note: Vite가 minified production main chunk 532.49 kB로 500 kB warning을 냈다. 기능·보안 실패는 아니며 후속 성능 개선 후보로 남긴다.

## Feature Matrix

| 기능 | 상태 | 실행 증거 |
|---|---|---|
| App shell·전체 route navigation·theme | PASS | browser desktop/mobile, unit tests |
| Dashboard 8개 card·기간 설정 반영 | PASS | release Tauri E2E, browser, unit tests |
| 고객 등록·조회·검색·수정·soft delete | PASS | release Tauri E2E, browser CRUD·validation, unit tests |
| 보험계약 CRUD·포함 계약 월보험료 합계 | PASS | release Tauri E2E, browser, unit tests |
| 보장 CRUD·카테고리별 합계 | PASS | release Tauri E2E, browser, unit tests |
| Coverage Benchmark CRUD·판정 | PASS | release Tauri E2E, browser 생성·validation, unit tests |
| 가족 CRUD·구성원·보험료 합계 | PASS | release Tauri E2E, browser, unit tests |
| 상담 CRUD·다음 연락일 | PASS | release Tauri E2E, browser, unit tests |
| Calendar 5개 event source·월 이동·기본 일정 CRUD/완료 | PASS | release Tauri E2E, browser, unit tests |
| XLSX/CSV preview·선택 import·export·round-trip·rollback | PASS | release Tauri E2E; browser는 native-only 안전 안내 확인 |
| 설정 validation·Dashboard 설정·theme 저장 | PASS | release Tauri E2E, browser, unit tests |
| custom backup·manual/daily·restore·exit·reauthorize | PASS | release Tauri E2E; browser는 native-only 안전 안내 확인 |
| SQLite 지속성·앱 재시작 | PASS | release Tauri E2E restart 4/4 |
| keyboard·dialog focus·390px responsive·AA contrast | PASS | browser 재검증, component/CSS contract tests |
| macOS arm64 release bundle 실행 | PASS | 현재 host release Tauri E2E build/run |
| Windows NSIS wizard·UAC·WebView2 없는 offline VM | NOT RUN | 현재 host가 macOS이며 Plan-033 승인 제외; 기존 hosted evidence를 현재 실기동으로 간주하지 않음 |

## Review Findings

- resolved P2 — 일정 soft delete 뒤 Calendar reload가 실패하면 agenda 등록 버튼이 사라져 focus가 유실됐다. 삭제 뒤 agenda 등록 → Calendar 재시도 → 제목 순 fallback과 별도 reload rejection 회귀 test를 추가했다.
- resolved P2 — `--text-muted`가 AA여도 placeholder의 `opacity: 0.75` 합성 결과는 light/dark 모두 4.5:1 미만이었다. opacity를 1로 고정하고 두 theme·두 form 배경의 alpha 합성 대비 test와 실제 computed-style을 확인했다.
- resolved P3 — Policy와 Coverage의 양방향 선택/필수 관계와 개선 후보 수가 불완전했다. 승인 프로필 계약과 실제 일곱 항목으로 문서를 정정했다.
- independent post-finding review: 잔여 P0–P3 code·제품범위·개인정보·QA evidence finding 없음.

## Completion Notes

- 완료 결과: 문서화된 현재 MVP 기능을 Browser preview와 release-mode macOS Tauri 앱에서 합성 데이터로 검증했고, 전체 기능 매트릭스는 Windows 전용 실기동을 제외해 PASS했다.
- 수정 결과: 삭제 후 focus 복구, 고객 상세 초기 오류 retry, form 오류 IDREF, theme/menu 의미, light/dark text·placeholder 대비, mobile 장문 wrapping을 구현했고 모든 독립 review finding을 해결했다.
- 문서 결과: 승인 운영 프로필과 ADR-001로 이미 결정된 보험기간·총 월납입액·Coverage 관계·Prisma runtime 경계를 open question에서 해결 항목으로 정리했다.
- 개인정보: 실제 고객 행·첨부 원본·저장 금지 정보·원격 기능·새 filesystem 권한을 사용하거나 추가하지 않았다.
- 잔여 위험: npm graph high 17건(`nanoid` 1건 포함), 532.49 kB production chunk warning, 평문 local DB·backup·export와 Windows NSIS wizard/UAC/WebView2 없는 offline VM NOT RUN이 남는다.
- 후속 후보: Windows trust evidence를 함께 갱신할 수 있는 별도 dependency plan, 측정 기반 route code splitting, 실데이터 도입 전 전용 OS 계정·전체 디스크 보호·자동 잠금 확인.
