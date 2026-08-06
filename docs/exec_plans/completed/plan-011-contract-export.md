# plan-011-contract-export

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-06
- 승인 근거: 사용자가 `/goal`로 전체 MVP 완성과 실제 실행 테스트를 지속 위임했고, plan-002에서 작은 후속 Exec Plan에 적용할 운영 프로필 전체를 승인했다.
- 승인 범위: 원본 21열 source가 현재 domain 값과 일치하는 활성 계약의 `.xlsx`/`.csv` 내보내기, native 저장·취소·덮어쓰기 경계, Browser UI와 실제 release Tauri 검증
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

수동 생성 Policy의 21열 합성, import 뒤 수정된 domain/source 충돌의 자동 해석, backup·restore·Settings와 release 배포는 이 계획에서 승인하지 않는다. 그런 행은 조용히 변환하지 않고 제외 사유와 건수만 표시한다.

## Goal

- `/data-exchange`에서 사용자가 활성 계약의 보존된 21열 source를 같은 양식 XLSX 또는 CSV로 저장한다.
- source raw text/null과 현재 Policy의 7개 mapped field가 같은 행만 내보내 원본과 현재 상태의 의미 충돌을 숨기지 않는다.
- XLSX의 sheet/header/text/blank/크기/border 계약과 CSV의 BOM/CRLF/RFC 4180 계약을 재현한다.
- 민감 파일 안내, native 취소·덮어쓰기 확인, 실패 시 기존 파일 보존과 안전한 결과 요약을 제공한다.
- 합성 데이터로 Browser 화면, 실제 release app의 native save, 생성 파일 재가져오기와 원본 SQLite 무변경을 검증한다.

## Non-Goals

- source 없는 수동 Policy의 21열 합성, source 수정 UI, domain 값을 source에 자동 덮어쓰기
- 삭제된 Customer·Policy/source, 선택 고객·기간 filter, 사용자 정의 열·정렬·sheet, PDF·인쇄·페이지 설정
- export 파일 암호화, cloud·email·remote 전송, background export, 여러 파일 동시 생성
- backup·restore, backup 경로, Dashboard 기간·건수, Windows offline VM acceptance, code signing·배포 채널
- 실제 고객 데이터나 실제 파일 경로를 fixture·문서·log·screenshot에 기록

## Context Map

- `src/features/data-exchange`: export summary/application/adapter/UI와 safe error boundary
- `src-tauri/src/data_exchange`: 활성 source query, domain parity, XLSX/CSV writer와 native save command
- `src/features/customer`, `src/features/insurance`: 현재 활성 parent와 Policy mapping 계약
- `tests/fixtures/synthetic`, `e2e`: 합성 source-backed/manual/conflict/deleted 계약과 release save/reparse scenario
- `docs/architecture/import-export.md`, product/open-questions, privacy/quality, README: 승인 상태와 운영 안내

## Constraints

- `codex/plan-011-contract-export`와 `.worktree/plan-011-contract-export`에서만 구현·검증한다.
- 계획 → 구현 → QA → 독립 리뷰 → 완료 plan/review → commit 순서를 지킨다.
- source·문서·migration·생성물은 300줄 전에 책임 단위로 분리한다.
- UI는 DB query, source/domain parity, 정렬, file serialization과 atomic replace를 소유하지 않는다.
- file/DB 작업은 async Tauri command의 blocking worker에서 실행하고 UI thread를 막지 않는다.
- native save dialog가 반환한 path만 쓰고 `fs:*`, shell, process, network capability를 추가하지 않는다.
- export 성공 전 기존 target을 손상하지 않고, 임시 파일과 부분 결과를 성공·실패·취소 뒤 남기지 않는다.
- 오류·log에는 format, stage, count와 safe code만 두고 전체 path·row value·Customer/Policy 식별값은 넣지 않는다.

## Export Contract

- 대상은 `isManaged`·`isIncluded` 계산 flag와 무관하게 active Customer에 속한 active Policy 중 1:1 import source가 있고 source를 현재 mapping 규칙으로 해석한 7개 값이 현재 Policy와 정확히 같은 행이다.
- source 없는 수동 Policy와 parity가 깨진 Policy는 각각 `원본 없음`, `현재 값과 원본 불일치`로 집계하고 export에서 제외한다.
- 안정 정렬은 source의 계약일자 J, 연결 Customer 이름, Policy id 오름차순이며 blank date는 마지막이다.
- XLSX sheet는 `계약조회(엑셀변환)_장기`, A:U header와 순서는 문서 계약 그대로다. 모든 채워진 cell은 text이고 null은 빈 cell이다.
- XLSX는 문서화된 열 너비, header/data 행 높이, header·첫 data·나머지 body border와 alignment를 재현하고 인쇄·페이지 설정은 만들지 않는다.
- CSV는 UTF-8 BOM, comma, CRLF, RFC 4180 quoting과 각 record의 정확한 21 field를 사용한다.
- CSV에서 trim 전후 첫 문자가 `=`, `+`, `-`, `@`, tab 또는 CR인 nonblank cell이 있으면 값을 바꾸지 않고 전체 CSV export를 거부하며 XLSX 사용을 안내한다. XLSX는 반드시 formula가 아닌 string cell로 쓴다.
- 다시 가져올 수 있는 단일 파일 경계를 유지하기 위해 data row는 최대 5,000개, 생성 파일은 최대 10 MiB다. 대상 0건 또는 상한 초과는 save dialog 전에 거부한다.
- 기본 파일명은 local timestamp를 포함한 `BODAM-contracts-YYYYMMDD-HHmmss`이고 사용자가 native dialog에서 위치와 이름을 최종 결정한다.
- 기존 파일 교체는 native dialog에서 사용자가 명시적으로 승인한 경우에만 진행한다. cancel은 파일과 DB를 바꾸지 않는다.
- 같은 directory의 예측 불가능한 임시 파일에 쓰고 close·flush·재parse 검증 뒤 원자 교체한다. 검증 실패 시 기존 target을 보존한다.
- export 결과는 format, exported count, 두 제외 count와 basename만 반환하며 전체 경로와 source 값은 반환·기록하지 않는다.

## Implementation Plan

- [x] 승인된 export-only 범위와 open question 잔여를 product/architecture 문서에 고정
- [x] Rust active source query, domain parity와 안정 정렬 service 구현
- [x] strict CSV writer와 same-format reparse 검증 구현
- [x] strict XLSX writer, style contract와 same-format reparse 검증 구현
- [x] pathless native save command, atomic replace·cancel·safe result 구현
- [x] TypeScript schema/repository/application과 `/data-exchange` export UI 구현
- [x] 합성 fixtures와 unit/integration/release E2E save·reparse·DB immutability scenario 구현
- [x] 전체 자동 QA와 실제 Browser responsive UI, release app native dialog·생성 파일 검증
- [x] QA 뒤 독립 domain/data, UI/accessibility, privacy/capability 리뷰와 finding 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- lint, typecheck, targeted/full Vitest, production build, Prisma validate와 migration registry/hash/diff
- Rust default/all-features tests, fmt, all-targets/all-features Clippy `-D warnings`, dependency audit
- active/manual/conflict/deleted parent·Policy query, blank date와 date/name/id stable order tests
- 21 raw text/null, 앞자리 0, 긴 문자열, 하이픈, NFC, comma·quote·CRLF/newline exact parity tests
- XLSX sheet/header/cell type/blank/width/height/border/alignment와 CSV BOM/CRLF/21-field tests
- cancel, overwrite decline/accept, write/flush/reparse/rename failure와 existing target SHA-256 보존 tests
- Browser desktop/390px dark/light, no document overflow, keyboard/focus/status와 console warn/error 0
- release app synthetic export, native save cancel/overwrite, generated XLSX/CSV parser round-trip와 전체 업무 row logical snapshot 불변
- production capability·bundle marker, temp/repository artifact, sensitive-value/log scan
- `npm run qa`, `npm run test:e2e`, production bundle, `npm audit`, `git diff --check`, 300줄 검사

## Acceptance Scenarios

1. `/data-exchange`가 XLSX/CSV 내보내기, 대상·제외 건수와 평문 민감 파일 안내를 제공한다.
2. active source-backed parity 행만 계약일자·Customer 이름·Policy id 순으로 내보내고 manual/conflict/deleted 행을 정확히 제외한다.
3. XLSX는 정확한 sheet/A:U/text/blank/style 계약이며 CSV는 BOM/CRLF/RFC 4180/21 field 계약이다.
4. 앞자리 0, 긴 식별자, 하이픈, 한글, 쉼표·따옴표·줄바꿈이 생성 파일 재parse 뒤 source와 같다.
5. native save cancel과 overwrite decline은 파일·DB를 바꾸지 않고, write/reparse 실패는 기존 target을 보존한다.
6. 성공 결과는 basename과 exported/manual/conflict count를 표시하고 전체 path나 row value를 log에 남기지 않는다.
7. 실제 release app으로 XLSX와 CSV를 저장해 다시 import preview하고 동일 행·cell과 SQLite 무변경을 확인한다.
8. 390×844, keyboard, focus, dark/light에서 overflow·console error 없이 동작한다.

## Review Plan

QA PASS 뒤 independent domain/data, UI/accessibility와 privacy/capability reviewer가 source-only 의미, domain parity, stable order, format fidelity, atomic replace, pathless native boundary, 민감 파일 안내와 실제 save/reparse 증거를 확인한다.

## Open Questions

- source 없는 수동 Policy를 향후 같은 양식에 합성할지와 각 미매핑 열의 값
- import 뒤 사용자가 수정한 domain 값을 source에 반영할지, source를 우선할지, conflict UI를 제공할지
- 전체 export 외 고객·기간·계약 선택 filter와 사용자 지정 정렬 필요 여부

위 항목은 원본 재해석 또는 새 UX 의미이므로 이 계획에서 추측하지 않고 후속 승인 대상으로 유지한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | plan-011은 21열 export만 구현하고 backup·Settings는 plan-012로 분리 | 파일 쓰기·형식 parity와 데이터 보호 수명주기를 작은 수직 계획으로 각각 검증 |
| 2026-08-07 | source/domain parity가 확인된 active 행만 export | 수동·수정 값을 승인 없이 21열 의미로 재해석하거나 과거 source를 현재값처럼 표시하지 않음 |
| 2026-08-07 | native save 뒤 temp write·reparse·atomic replace | cancel과 실패에서 기존 파일을 보존하고 broad filesystem capability를 열지 않음 |
| 2026-08-07 | CSV formula trigger는 변형하지 않고 전체 CSV 저장을 거부 | source fidelity를 유지하면서 spreadsheet formula injection을 fail closed |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | plan-010을 `9ddf896`로 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-07 | repo_cartographer | product, export와 release/backup 잔여 범위를 병렬 조사하고 plan-011을 export-only로 제한했다. |
| 2026-08-07 | plan_keeper | plan-011 전용 branch/worktree와 standing approval 기반 실행 계획을 만들었다. |
| 2026-08-07 | harness_builder | source/domain parity query, strict XLSX·CSV 생성과 재parse, same-directory atomic replace와 pathless native command를 구현했다. |
| 2026-08-07 | harness_builder | 전용 `dist-e2e`, bundle identifier와 Cargo target으로 production/E2E 앱·산출물을 물리적으로 분리했다. |
| 2026-08-07 | quality_runner | 실제 Browser desktop/mobile dark/light와 macOS native 저장창 cancel·XLSX·CSV 저장을 합성 데이터로 검증했다. |
| 2026-08-07 | quality_runner | 격리 release E2E에서 두 형식 생성·strict 재parse·production parser round-trip·SQLite 불변을 통과했다. |
| 2026-08-07 | review_judge | QA 뒤 domain/data와 UI/accessibility finding을 수정하고 전체 자동 QA와 재리뷰를 통과했다. |
| 2026-08-07 | privacy_guard | production/E2E 격리와 문서 현재상태 finding을 닫고 production marker·bundle identifier를 재검증했다. |
| 2026-08-07 | doc_gardener | plan-011을 completed로 이동하고 동일 번호 review와 잔여 위험을 기록했다. |

## QA Evidence

- result: PASS
- 최종 `npm run qa`: ESLint, `vue-tsc`, Vitest 67 files/317 tests, Prisma validate·migration registry/hash/diff, Rust default 195 tests, production Vite build, Tauri check와 base harness를 통과했다.
- `cargo test --all-features`: 206/206 PASS. `cargo fmt --check`, all-targets/all-features Clippy `-D warnings`, `git diff --check`도 PASS했다.
- `npm run test:e2e`: 격리된 `BODAM E2E.app`과 임시 합성 DB에서 기존 import/write/restart/rollback에 더해 XLSX·CSV export, 독립 strict 검사, production parser round-trip와 전체 업무 row logical snapshot 불변을 통과했다.
- XLSX는 21열·text/blank·width/height/border/alignment와 formula error 0, CSV는 BOM·CRLF·RFC 4180·21 field 및 quoted lone CR/LF를 독립 검사했다. literal SpreadsheetML escape도 production parser와 독립 검사기가 같은 원문으로 복원했다.
- 실제 Browser 1280×900과 390×844 dark/light에서 대상·제외 요약, Browser-only disabled 저장 버튼, 민감 파일 안내, document horizontal overflow 0과 console warning/error 0을 확인했다.
- 실제 macOS release 앱은 합성 DB에서 대상 1·원본 없음 1·충돌 1을 표시했다. NSSavePanel cancel 뒤 무변경, XLSX와 CSV 실제 저장, 성공 요약 1/1/1과 생성 파일 재parse를 확인했다.
- 생성 XLSX는 artifact-tool import/render로 21열과 formula error 0을 재확인했고, 두 형식 저장 전후 SQLite logical snapshot은 같았다.
- `npm audit --audit-level=high`: 취약점 0건. production `dist`, `BODAM.app`, binary의 E2E marker 0건이고 표준 release bundle에는 `BODAM.app`만 남았다.
- E2E app은 `app.bodam.desktop.e2e`, production app은 `app.bodam.desktop`이며 `dist-e2e`와 `src-tauri/target/e2e` 밖 실행을 WDIO가 거부한다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P1 | E2E build가 production 이름·identifier·target을 공유해 표준 앱을 오염할 수 있음 | 전용 app identity, `dist-e2e`, exact Cargo target과 WDIO fail-closed 검사를 적용 |
| P2 | README가 미구현 backup을 현재 기능처럼 설명 | 현재 export/import와 후속 backup 범위를 분리해 수정 |
| P2 | 정렬 전용 Customer/Policy 식별 문자열이 export logical budget과 retained row를 증폭 | portable SQL에서 blank-last 안정 정렬하고 21 source cell만 소유·예산 계산 |
| P3 | import CSV validator가 quoted field 내부 lone CR/LF를 거부 | record 밖 CRLF만 강제하는 quote-aware scanner와 회귀 추가 |
| P2 | summary refresh 실패 뒤 stale 대상과 저장 버튼이 남음 | application/UI cache를 함께 무효화하고 오류 동안 저장 비활성화 |
| P2 | import/export 상호 busy에서 refresh·retry가 다시 실행될 수 있음 | composable guard와 버튼 disabled 계약·호출 횟수 회귀 추가 |
| P2 | native logical-text/path 오류가 일반 오류로 잘못 표시 | safe code별 한도·위치/확장자 메시지 mapping 추가 |
| P2 | summary/save retry 뒤 keyboard focus가 유실 | panel-scoped stable target과 status fallback으로 복구 |

최종 full QA 뒤 domain/data, UI/accessibility, privacy/capability 세 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding은 0건이었다.

## Completion Notes

- 활성 source-backed parity 행만 보존된 21열과 같은 의미로 XLSX/CSV에 내보내고, 수동·충돌 행은 조용히 합성하지 않고 건수로 설명한다.
- 실제 Browser와 macOS native 저장창, 격리 release E2E, 생성 파일 독립 검사와 DB 불변까지 합성 데이터로 검증했다.
- 기존 target은 같은 directory의 random temp에 완성·flush·sync·재parse한 뒤 교체하며 cancel·검증 실패에는 target을 보존한다.
- production에는 E2E 경로·표식·별도 앱이 없고 broad filesystem, shell, process, network capability를 추가하지 않았다.
- 잔여 위험은 process/power abort 직후 임시 파일이 남을 가능성, symlink/network filesystem의 platform별 atomic semantics, write·flush·fsync failure injection 공백이다.
- macOS 실제 save/cancel은 확인했지만 system overwrite-decline 자동화와 Windows native dialog·`MoveFileEx` 실제 파일시스템 검증은 plan-013 release acceptance에서 수행한다.
- 다음 작은 계획은 backup/restore와 Settings를 구현·검증한다.
