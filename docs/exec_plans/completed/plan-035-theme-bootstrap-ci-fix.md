# plan-035-theme-bootstrap-ci-fix

## Status

completed

## Owner

project_lead / plan_keeper / quality_runner / review_judge

## User Request

첨부한 GitHub Actions 실패 화면의 버그를 수정하고, 실제 앱을 실행해 다른 버그가 없는지 확인·테스트한다.

## Approval

- 요청일: 2026-08-28
- 승인일: 2026-08-28
- 승인 근거: 사용자가 Windows CI 실패 버그 수정과 실제 앱 실행·추가 버그 점검을 명시적으로 요청했다.
- 승인 범위: Plan-034가 추가한 theme pre-paint production contract test의 Windows timeout을 정확히 진단·수정하고, 현재 문서화된 MVP를 합성 데이터와 release 앱으로 회귀 검증하며 재현되는 저위험 결함을 현재 제품·개인정보 계약 안에서 수정한다.
- 승인 제외: 새 도메인 기능·저장 필드·migration, Google Calendar 구현, 실제 고객 데이터 사용, Windows 전용 결과를 macOS에서 실행했다고 주장하는 것, Windows npm trust graph나 검증 hash의 근거 없는 변경.

## Goal

- GitHub Actions run 33145307390의 실패 단계와 원인을 원문 로그로 확인한다.
- production HTML에서 synchronous same-origin theme bootstrap이 CSS·app module보다 먼저 실행된다는 보장은 유지하면서 Windows CI 5초 timeout 의존을 제거한다.
- macOS 로컬 전체 QA와 release-mode Tauri E2E를 통과한다.
- 실제 release 앱을 열어 Settings의 light·dark·system과 주요 navigation·화면 상태를 직접 확인한다.
- 가능한 경우 동일 Windows hosted workflow를 수정 branch에서 통과시키고 증거 범위를 정확히 기록한다.
- 추가 점검에서 재현되는 결함은 승인된 기존 계약 안의 최소 수정과 회귀 테스트로 해결한다.

## Non-Goals

- timeout 숫자만 임의로 크게 올려 flaky 원인을 숨기기
- theme first-paint 보장 또는 production 산출물 검증 삭제
- Windows NSIS·WebView2 clean offline VM·서명/SmartScreen을 macOS 실행으로 증명
- 사용자 운영 DB·실제 고객 행·첨부 원본·credential을 test, log, screenshot 또는 문서에 사용
- 기능 점검을 이유로 미결정 도메인 규칙이나 원격 capability를 추가

## Context Map

- 실패 test: `src/features/settings/tests/theme-bootstrap-contract.test.ts`
- production bootstrap: `index.html`, `public/theme-bootstrap.js`, `vite.config.ts`
- Windows workflow/trust: `.github/workflows/tauri-e2e-windows.yml`, `harness/scripts/windows_*`
- local actual app: `e2e/`, `wdio.conf.mjs`, release-mode Tauri bundle
- 제품·개인정보 경계: `docs/product`, `docs/architecture`, `docs/quality`, `docs/privacy`

## Constraints

- `codex/plan-035-theme-bootstrap-ci-fix`와 `.worktree/plan-035-theme-bootstrap-ci-fix`에서만 구현·검증한다.
- 순서는 계획·승인 → 구현 → QA → 독립 리뷰 → 완료 plan/review → commit이다.
- package.json과 Windows workflow의 immutable trust 계약은 실제 변경 필요성과 Windows 증거 없이 갱신하지 않는다.
- production build 검증은 test runner 내부의 중첩 full build 시간에 의존하지 않고 결정적 artifact/transform 계약을 사용한다.
- 자동 E2E와 실제 화면 점검의 증거 범위를 구분한다.
- source·문서·생성물은 300줄 전에 책임 단위로 분리한다.

## Implementation Plan

- [x] Plan-035와 직접 사용자 승인, 전용 branch/worktree를 기록한다.
- [x] 실패 GitHub run의 exact log와 local/Windows 차이를 재현·분석한다.
- [x] first-paint production 순서 보장을 유지하는 결정적 cross-platform regression check로 수정한다.
- [x] 집중 test와 full QA를 실행하고 실패·성능 증거를 기록한다.
- [x] release-mode Tauri E2E와 실제 앱 화면에서 주요 MVP·theme 흐름을 점검한다.
- [x] 재현된 추가 결함을 분류하고 P0–P2 결함이 없는지 확인한다.
- [x] QA 뒤 independent code/product/privacy review findings를 해결한다.
- [x] plan을 completed로 이동하고 같은 번호 review mirror를 작성한다.

## QA Plan

- 실패 재현: 해당 Vitest file 반복 실행, clean output 조건, test별 duration 확인
- 집중: theme bootstrap source behavior, production HTML order, Settings/store/shell tests
- 전체: `npm run qa`, `npm run verify`, `cargo fmt --check`, `git diff --check`
- 실제 앱: release-mode macOS Tauri bundle의 Settings 세 모드, OS-resolved DOM, navigation, 주요 empty/error/CRUD 흐름
- hosted: 수정 branch의 `Windows NSIS and installed E2E` workflow와 installed application suite, 실행 가능할 때만 PASS로 기록
- 개인정보: synthetic runtime만 사용하고 screenshot/log/artifact에 업무 행·경로·credential이 없는지 확인

## Acceptance Scenarios

1. Windows CI에서 theme production contract가 기본 5초 timeout에 full nested build 때문에 실패하지 않는다.
2. built production HTML은 bootstrap script를 CSS와 app module보다 앞에 유지한다.
3. cached light·dark·system과 system OS light/dark 해석이 첫 화면과 runtime에서 유지된다.
4. 전체 local QA와 release Tauri E2E가 exit 0으로 완료된다.
5. 실제 앱에서 Settings 세 모드와 주요 navigation에 재현 가능한 새 P0–P2 결함이 없다.
6. hosted Windows를 실행했다면 NSIS·installed E2E 결과를 정확히 기록하고, 실행하지 못했다면 NOT RUN 근거를 남긴다.
7. 실제 고객 데이터·새 원격 기능·broad capability·근거 없는 trust hash 변경이 없다.

## Review Plan

QA 통과 뒤 independent reviewer가 Windows timeout 원인, production 순서 보존, test determinism, cross-platform path/clock 가정, 실제 app 증거, 제품·개인정보 경계와 추가 bug audit 결과를 검토한다.

## Open Questions

- 수정 branch의 hosted Windows workflow를 현재 GitHub 권한으로 dispatch할 수 없으면 main push 뒤 run을 후속 evidence로 남긴다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-28 | 사용자 요청 자체를 Plan-035 승인 근거로 기록 | CI 버그 수정과 실제 앱 테스트를 명시적으로 요청함 |
| 2026-08-28 | screenshot annotation을 증상이 아니라 exact run log로 재확인 | timeout 이전 단계·환경·stack을 빠뜨리지 않기 위함 |
| 2026-08-28 | product 기능 변경 없이 품질 회귀 범위로 제한 | 실패는 Plan-034 production contract test에서 관찰됐고 도메인 선택과 무관함 |
| 2026-08-28 | production HTML 검증을 Vitest 내부 full build에서 Vite build plugin으로 이동 | 실제 build artifact를 매 build에서 검사하면서 unit timeout·중복 build를 제거함 |
| 2026-08-28 | final HTML을 실행·로딩이 비활성화된 semantic DOM으로 파싱하고 `<head>` 직계 요소의 실제 속성·순서를 검사 | 문자열·정규식 파싱이 script text, quoted attribute, `template`·`textarea`·`srcdoc` 같은 inert context를 실행 태그로 오인하지 못하게 함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-28 | plan_keeper | 필수 제품·아키텍처·품질·개인정보 문서를 확인하고 Plan-035 branch/worktree와 승인 범위를 만들었다. |
| 2026-08-28 | quality_runner | GitHub run 33145307390 원문에서 nested `vite.build(write:false)`만 5,985ms로 timeout했고 388개 다른 test는 통과했으며 이후 Windows installer/E2E가 skip된 것을 확인했다. |
| 2026-08-28 | harness_builder | Vitest 내부 nested build를 제거하고 production/e2e Vite build의 final HTML transform 단계에서 bootstrap 개수·blocking 속성·module/CSS 선행 순서를 검증하도록 변경했다. |
| 2026-08-28 | review_judge | 두 차례 parser edge-case 지적을 반영해 contract를 semantic DOM의 direct-head 실행 요소 검사로 보강하고 inert/body/quoted-context 음성 회귀를 추가했다. |
| 2026-08-28 | quality_runner | 격리된 `BODAM E2E` release bundle로 native IPC·SQLite·file 회귀 suite와 실제 UI 점검을 완료했다. 운영 bundle과 운영 DB는 열지 않았다. |
| 2026-08-28 | quality_runner | 첨부된 macOS SIGABRT report는 E2E DB 경로 없이 연 진단용 번들이 path validation을 fail-closed한 setup panic임을 같은 시각·bundle·stack으로 확인했다. 유효 경로 앱은 정상 실행·종료했다. |
| 2026-08-28 | review_judge / privacy_guard | 최종 semantic DOM·asset/order·Window cleanup 보강 뒤 code/product/privacy 재검토에서 남은 P0–P3 finding 없음으로 승인했다. |

## QA Evidence

- result: PASS
- final semantic-parser 집중 theme bootstrap test: 4 tests PASS, 462ms; tests 112ms.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, production final HTML contract plugin 포함, 1.32s.
- `npm run build:e2e`: PASS, e2e final HTML contract plugin 포함, 1.33s.
- sequential `python3 harness/scripts/run_qa.py`: PASS.
- final semantic-parser `npm run qa`: PASS; Vitest 90 files / 389 tests, Rust 321 tests, database contracts, production build, Tauri check와 harness 전부 통과.
- `npm run verify`: exit 0; release `BODAM E2E` bundle에서 고객·계약·보장·가족·상담·대시보드·일정·XLSX/CSV import/export/rollback·backup/restore/exit lifecycle을 실제 IPC와 SQLite로 통과. 복원 재시작·백업 실패 단계의 하위 nonzero는 상위 runner가 의도된 음성 증거를 검증했다.
- actual app: OS temp의 전용 합성 DB로 실행. 초기 light, 저장된 dark, 저장된 system, 현재 OS-dark에서 system의 dark resolve와 reload 뒤 preference 유지를 확인했다. OS-light cold start와 실행 중 OS light↔dark 전환은 자동 test PASS이며 수동 OS 전환은 NOT RUN이다.
- actual navigation: Dashboard, Customers, Families, Calendar, Data Exchange, Settings의 주요 empty state와 오류 alert 부재를 확인. 정상 quit exit 0.
- actual app용 임시 DB·backup directory와 실패한 수동 launch의 빈 임시 directory를 정확한 경로 검증 뒤 모두 제거했다.
- `cargo fmt --check`: PASS.
- `git diff --check`: PASS.
- `python3 -I harness/scripts/windows_npm_preflight.py`: PASS; immutable npm/workflow/E2E trust graph 변경 없음.
- hosted Windows pre-commit: NOT RUN — 수정 branch가 아직 commit/push 전이라 dispatch 가능한 remote ref가 없다. 수정 전 run 33145307390의 installer/E2E skip은 수정본 증거로 사용하지 않는다.

## Acceptance Status

- #1: static cross-platform contract와 local final production build PASS; 수정본 hosted Windows는 pre-commit 시점 NOT RUN.
- #2: production/e2e final HTML에서 exact synchronous bootstrap 1개와 module/CSS 선행 순서 PASS.
- #3: automated system light/dark cold/runtime PASS; actual app current OS-dark resolve와 reload PASS, manual live OS transition NOT RUN.
- #4: local `npm run qa`와 release `npm run verify` PASS.
- #5: actual app 6개 top-level route bounded audit PASS; 상세 CRUD·오류·rollback·restore는 release E2E PASS.
- #6: hosted Windows는 pre-commit 시점 NOT RUN이며 branch push 뒤 dispatch한다.
- #7: 실제 데이터·원격 기능·capability·trust hash 변경 없음.

## Review Findings

- resolved P2 — 첫 checker가 HTML 속성을 정규식 word boundary로 찾으며 `data-src`, `data-type`, `data-rel`, `nomodule`과 주석 태그를 오인했다. 주석을 제거하고 실제 속성명을 토큰화하며 bootstrap exact tag만 허용하도록 수정하고 각 음성 회귀를 추가했다.
- resolved P2 — 토큰화한 문자열 parser도 script body·다른 quoted attribute·`template`·`textarea`·`srcdoc`의 inert text를 실제 tag/attribute로 오인하고 경로 없는 asset tag를 승인할 수 있었다. 로딩과 실행을 비활성화한 semantic DOM에서 `<head>` 직계 `/assets/*.js|css` 요소와 문서 전체 bootstrap 단일성을 검사하고 inert/body/quoted/pathless context의 음성 회귀를 추가했다.
- resolved P2 — generated `/assets/*.js|css` 존재 filter를 순서 비교에도 사용해 bootstrap보다 앞선 local/CDN CSS·module을 놓쳤다. generated asset 존재와 모든 direct-head module/stylesheet의 최초 순서 검사를 분리하고 음성 회귀를 추가했다.
- resolved P3 — detached happy-dom `Window.close()`가 no-op이어서 반복 검사에서 정리가 보장되지 않았다. helper·Vite hook·test를 async로 바꾸고 `await window.happyDOM.close()`로 실제 종료한다.
- resolved P2 evidence scope — 수정 branch hosted Windows 증거가 아직 없었다. commit 전에는 `NOT RUN`과 정적/local 증거 한계를 명시하고 push 뒤 workflow dispatch를 완료 조건으로 유지했다.
- resolved P3 — actual app의 current OS-dark+reload 증거와 자동 test의 OS-light/runtime transition 증거를 분리했다.
- resolved P3 — Plan-034 review의 Google 후속 번호를 특정하지 않도록 고쳐 실제 Plan-035와의 탐색 충돌을 제거했다.
- independent privacy/trust review: P0–P3 없음; 운영 DB fallback, remote capability, 민감정보와 trust graph 변경 없음.
- independent final code re-review: P0–P3 없음; 집중 재실행 4/4 PASS, 244ms.

## Completion Notes

- Windows CI timeout의 원인이던 Vitest 내부 중첩 full Vite build를 제거하고 실제 production/e2e build의 final HTML transform에서 계약을 검증한다.
- semantic DOM 검사는 정확한 parser-blocking bootstrap 1개, generated `/assets` module/CSS 존재, 모든 실제 module/CSS보다 앞선 순서와 inert/가짜 context 거부를 보장한다.
- 최종 local QA와 release native E2E, 실제 앱 Settings·주요 navigation 점검을 통과했고 새 P0–P2 앱 결함은 재현되지 않았다.
- 첨부 crash는 E2E 전용 번들을 필수 합성 DB 경로 없이 실행한 fail-closed 진단 crash이며 운영 앱 경로의 제품 crash가 아니다. 테스트 전용 진단 UX는 P3 잔여 위험이다.
- 수정 branch hosted Windows는 commit/push 뒤 dispatch해 이 완료 기록과 review에 exact run 증거를 후속 추가한다.
