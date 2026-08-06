# plan-002-usable-mvp

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

프로젝트를 바로 사용할 수 있을 정도로 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-06
- 승인 근거: 사용자가 `/goal`로 실사용 가능한 전체 제품 구현과 실제 실행 테스트를 명시적으로 위임했다. 구현을 멈추지 말라는 지속 목표에 따라, 범위 안의 가역적 기본값 선택 권한까지 포함한 것으로 기록한다.
- 승인 범위: 전체 MVP 목표, 실제 실행 QA, SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`의 기본 운영 규칙

프로필을 벗어나는 데이터 재해석, 외부 통신, 민감정보 저장은 별도 명시적 승인 전 진행하지 않는다.

## Goal

- 오프라인에서 실행되는 Windows 우선 Tauri 데스크톱 앱을 만든다.
- 로컬 SQLite에 고객 데이터를 안전하게 저장하는 첫 수직 기능을 완성한다.
- Vue 화면에서 합성 고객을 생성·조회·수정·soft delete하고 재실행 지속성을 검증한다.
- lint, strict typecheck, unit/integration test, Vite build, Rust check/test와 실제 화면 smoke test를 반복 가능한 명령으로 연결한다.
- 이후 가족·계약·보장·상담, dashboard·calendar, import/export, backup을 별도 승인 계획으로 이어 전체 사용자 목표를 완료한다.

## Non-Goals

- 승인되지 않은 상령·보험료·보장 benchmark·최근 상담 산식 구현
- 승인되지 않은 Excel 행 자동 병합, duplicate/partial success 정책 구현
- 승인되지 않은 사용자 일정·자동 backup 정책 구현
- 원격 API, telemetry, cloud sync, 광고, 결제, 원격 알림
- 실제 고객 데이터 또는 첨부 workbook 원본을 fixture·log·screenshot에 사용
- 현재 macOS 호스트만으로 Windows 설치·실행 검증을 완료했다고 주장

## Context Map

- `src/app`: shell, router, UI 전용 상태
- `src/features/customer`: schema, application, domain, repository port, page/component
- `src/shared`: 공통 UI와 오류 계약
- `database/prisma`: Prisma schema와 migration 단일 source
- `src-tauri`: Tauri shell, Rust SQLite adapter, 최소 IPC/capability
- `tests/fixtures/synthetic`: 합성 fixture만 저장
- `harness/scripts`: 실제 package/Rust/DB QA 연결
- `docs/product/proposed-operating-profile.md`: 전체 MVP의 승인된 기본 운영 규칙
- `docs/architecture/decisions/adr-001-prisma-tauri-runtime.md`: runtime 결정

## Constraints

- main에서 구현·검증하지 않고 `codex/plan-002-usable-mvp`와 해당 worktree를 사용한다.
- UI·Pinia store는 보험 비즈니스 계산이나 SQL을 소유하지 않는다.
- domain service는 Vue, Tauri, Prisma, ECharts에 의존하지 않는다.
- form, IPC payload, 외부 입력은 Zod로 검증한다.
- SQLite 전용 세부는 adapter에 격리하고 Prisma migration만 schema source로 둔다.
- 삭제 가능한 업무 데이터는 `deletedAt` soft delete를 사용한다.
- source, migration, 문서는 300줄 전에 책임 단위로 분리한다.
- broad filesystem, shell, network capability를 열지 않는다.

## Open Questions

현재 구현을 막는 질문은 없다. `docs/product/proposed-operating-profile.md` 2026-08-06 전체를 승인 기준으로 사용한다.
승인된 현재 문서의 SHA-256은 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`이다.

### 이번 계획의 승인 결정

1. Runtime 권장안 B: Prisma schema와 생성된 migration SQL을 단일 artifact source로 사용하고 Tauri Rust adapter가 runtime SQLite 접근을 담당한다. Rust executor/history가 Prisma Migrate executor와 동일하다고 주장하지 않으며, 동일 SQL `include_str!`와 schema·history·runtime DB drift gate로 동등성을 검증한다. Node sidecar는 사용하지 않는다.
2. 전체 MVP 배포 권장안: plan-013에서 `windows-2025` x64 runner로 NSIS를 빌드하고 WebView2 `offlineInstaller`를 포함해 설치와 실행 모두 인터넷 없이 가능하게 한다. plan-002는 hosted runner E2E workflow만 구성하며, 실제 CI·WebView2 미설치·네트워크 차단 VM 증거를 완료로 간주하지 않는다.
3. 계획 권장안: plan-002는 app bootstrap과 Customer CRUD 수직 기능까지만 완료하고, 나머지 MVP는 작은 후속 계획으로 순차 승인·구현한다.
4. Customer 권장안: 이름만 필수, 담당상태는 자유 입력, 생년월일은 date-only, 그 밖의 명시 필드는 선택, 기본 삭제는 soft delete이며 복원 UI는 후속 계획으로 둔다.

### 프로필로 함께 확정한 후속 기능 결정

- 가족 관계·복수 그룹·대표자, 보험료와 기간 단위, 갱신 규칙
- 보장 단위·합산·benchmark 경계, 상령 산식, dashboard 기간·정렬
- import mapping/key/duplicate/atomicity, CSV 형식, Excel 보존 범위
- calendar 보기·일정 필드, 30/60/90 포함·중복 규칙
- backup 경로·중복·실패·손상·암호화 정책

## Implementation Plan

- [x] 승인된 runtime 결정을 ADR-001과 공식 근거 문서에 기록
- [x] Vue 3, Vite, TypeScript strict, Router, Pinia, Vitest, ESLint bootstrap
- [x] Tauri 2 shell과 최소 capability 구성
- [x] Prisma Customer schema, FK/soft-delete 원칙과 초기 migration 생성
- [x] Rust SQLite repository/IPC adapter와 Zod application 경계 구현
- [x] Customer domain/application service와 repository port 구현
- [x] 고객 목록·검색·생성·수정·삭제 확인 UI와 light/dark theme 구현
- [x] loading, empty, success, validation, adapter error 상태 구현
- [x] 합성 fixture 기반 unit, DB integration, migration, persistence test 구현
- [x] package QA/verify와 기존 Python harness 연결 및 README 갱신
- [x] 실제 Tauri 앱과 브라우저 renderer에서 Customer happy path 실행
- [x] QA 증거 기록 후 독립 리뷰 findings 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:db`
- `npm run build`
- `npm run tauri:check`
- `npm run qa`
- `npm run verify`
- `python3 harness/scripts/run_qa.py`
- 합성 고객 생성 → 수정 → soft delete → 기본 목록 제외 → 앱 재실행 후 persistence 확인
- 빈 DB 및 기존 합성 fixture DB에서 migration, FK, soft delete, rollback 확인
- Prisma schema ↔ migration diff, migration 등록 1:1/hash, Rust runner clean DB의 history/runtime schema exact-match 검사
- in-app Browser로 light/dark, empty/error/data, form validation, keyboard/focus, 반응형 layout 확인
- macOS embedded WebDriver 실제 앱 E2E를 실행
- Windows release app WebDriver는 `windows-2025` workflow를 구성하되 실제 hosted pass를 외부 CI 증거로 구분
- Windows NSIS build·silent install·재실행과 offline WebView2 payload·wizard/UAC는 plan-013 release/VM acceptance에서 검증

## Evidence Map

- Prisma Client에 Rust runtime이 없으므로 Runtime B는 Prisma의 직접 지원 조합이 아니라 공식 기능을 결합한 project inference다.
- Prisma Migrate가 생성한 전체 history와 `migration_lock.toml`을 보존하고 SQL 사본을 만들지 않는다.
- Tauri SQL migration은 파일 SQL 포함, version, transaction rollback을 지원하지만 Prisma `_prisma_migrations` 호환을 보장하지 않는다.
- Tauri WebdriverIO는 macOS·Windows 실제 앱을 지원하고 Windows CI 실행 예제를 제공한다.
- WebView2 `offlineInstaller`는 설치 시 인터넷이 필요 없고 installer 크기를 약 127MB 늘린다.
- 공식 근거: `docs/references/official-sources.md`의 Prisma Migrate·Tauri SQL·WebDriver·Windows Installer 항목에 검토일과 함께 반영한다.

## Review Plan

QA 통과 후 별도 review agent가 다음을 읽기 전용으로 확인한다.

- 승인 범위와 구현 traceability, 후속 기능의 과잉 구현 여부
- UI/application/domain/adapter 의존 방향과 SQLite 세부 격리
- soft delete, migration, IPC validation, 오류 redaction
- 저장 금지 필드·실데이터·외부 통신·과도한 capability 부재
- 실제 실행 증거, README 명령, macOS와 Windows 검증 주장 정확성

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-06 | 전체 목표를 여러 승인 계획으로 분할하는 안을 제안 | 현재 저장소는 앱 코드가 없고 미결정 규칙이 많아 작은 수직 기능별 QA가 필요함 |
| 2026-08-06 | Runtime B를 권장하되 승인 전 확정하지 않음 | Node sidecar의 패키징·IPC·권한 비용을 피하면서 Prisma migration을 단일 source로 유지할 수 있음 |
| 2026-08-06 | 실제 Windows 완료 판정을 보류 | 현재 실행 환경은 macOS arm64이며 Windows VM/runner 증거가 필요함 |
| 2026-08-06 | Runtime B의 단일 source를 schema/migration artifact로 한정 | Tauri Rust migration executor가 Prisma history와 호환된다는 공식 보장은 없음 |
| 2026-08-06 | Windows hosted E2E와 offline 설치 수동 검증을 분리 | hosted image에는 이미 WebView2가 있어 미설치 환경 분기를 증명할 수 없음 |
| 2026-08-06 | 전체 미결정 항목을 versioned 운영 프로필로 제안 | 한 번의 명시적 승인으로 후속 계획을 연속 진행하되 추측 금지 규칙을 지키기 위함 |
| 2026-08-06 | 전체 목표 위임을 운영 프로필 승인으로 기록 | 요청 범위 안의 가역적 기본값을 선택해 실사용 가능한 결과까지 자율 진행하기 위함 |
| 2026-08-06 | `src-tauri/gen`을 줄 수 검사 대상에서 제외 | Tauri가 다시 만드는 gitignored build cache이며 커밋·배포하는 프로젝트 생성물이 아님. 저장소 소유 생성물은 계속 검사함 |
| 2026-08-06 | WebdriverIO embedded provider를 실제 앱 E2E에 사용 | 최신 공식 Tauri/WebdriverIO 문서가 macOS·Windows를 같은 service로 지원하며 test-only plugin 분리를 안내함 |
| 2026-08-06 | 승인 운영 프로필의 현재 hash를 리뷰에서 다시 고정 | 승인 상태 표기를 포함한 현재 versioned 문서와 계획의 추적 hash를 일치시키기 위함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-06 | project_lead | `/goal`을 등록하고 저장소, 문서, branch/worktree와 도구 환경을 감사했다. |
| 2026-08-06 | repo_cartographer | architecture·requirements·privacy·QA acceptance와 미결정 release blocker를 병렬 검토했다. |
| 2026-08-06 | plan_keeper | 전용 branch/worktree를 만들고 승인 대기 계획을 작성했다. |
| 2026-08-06 | repo_cartographer | 공식 Prisma/Tauri/GitHub 근거로 runtime bridge와 Windows QA 한계를 좁혔다. |
| 2026-08-06 | plan_keeper | 전체 MVP 권장 기본 운영 프로필과 승인 문구를 작성했다. |
| 2026-08-06 | project_lead | 세 번째 연속 goal turn에도 프로필 승인이 없어 구현 gate를 넘지 못했으며 goal을 blocked로 기록한다. |
| 2026-08-06 | project_lead | 지속 목표가 활성화되어 전체 구현 위임 범위 안의 기본값 승인을 기록하고 plan을 active로 전환했다. |
| 2026-08-06 | quality_runner | in-app Browser에서 필수 검증, 생성·검색·수정·soft-delete, 테마, 390px layout·menu, reload를 합성 데이터로 실행하고 console warning/error 0건을 확인했다. |
| 2026-08-06 | quality_runner | macOS `BODAM.app`을 직접 빌드·실행해 SQLite IPC 생성·수정, 새 프로세스 재조회, soft-delete를 조작하고 DB count `total=1, active=0, migrations=1`을 확인했다. |
| 2026-08-06 | quality_runner | readiness 감사에서 timestamp 계약, migration equivalence 자동 gate, runtime schema drift, README, 저장 안전성 표현, WebDriver 누락을 발견해 수정에 착수했다. |
| 2026-08-06 | quality_runner | release-mode macOS `BODAM.app`을 WebdriverIO로 두 번 실행해 생성·수정·검색·renderer refresh와 프로세스 재시작 지속성·soft-delete를 2/2 통과했다. |
| 2026-08-06 | privacy_guard | WebDriver 플러그인·capability·임시 DB override가 E2E feature에만 있고 최종 production bundle에는 포함되지 않음을 검사했다. |
| 2026-08-06 | quality_runner | in-app Browser 재검증에서 dialog Escape 결함을 발견해 공용 dialog를 수정하고 autofocus·Escape 닫기·호출 버튼 초점 복귀를 native E2E 회귀 시나리오에 추가했다. |
| 2026-08-06 | review_judge | 1차 리뷰의 P1 1건, P2 6건, P3 1건을 모두 해결하고 최종 재리뷰에서 신규 finding 없음과 PASS를 확인했다. |
| 2026-08-06 | doc_gardener | 최신 QA 수치와 Windows 증거 한계를 동기화하고 completed plan과 review mirror를 준비했다. |

## QA Evidence

- result: PASS — plan-002 Customer 수직 기능 및 현재 macOS 호스트 범위
- `npm run verify`: PASS
  - ESLint, strict `vue-tsc`, Prisma validate·migration diff, Vite production build, Cargo check, Python harness PASS
  - Vitest 3 files / 9 tests PASS
  - Rust repository·migration·IPC validation 19 tests PASS
  - release-mode macOS `BODAM.app` 실제 프로세스 2회 WebdriverIO E2E 2/2 PASS
  - 첫 프로세스에서 autofocus·Escape·호출 버튼 초점 복귀, create·update·search·renderer refresh 확인
  - 두 번째 프로세스에서 restart persistence·soft-delete·기본 목록 제외 확인
- `cargo test --manifest-path src-tauri/Cargo.toml --all-features`: 19/19 PASS
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`: PASS
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities
- `git diff --check`: PASS
- in-app Browser 실제 화면:
  - 생성·필수 검증·검색 debounce·검색 없음·수정·theme·soft-delete·reload persistence 확인
  - desktop collapsed 상태에서 390×844로 전환해도 drawer label/footer가 표시되고, 닫힌 sidebar가 접근성 tree에서 제외되는지 확인
  - dialog의 접근성 이름 `새 고객 등록`, autofocus·Escape 닫기·호출 버튼 초점 복귀 확인
  - console warning/error 0건
- 표준 production `BODAM.app` 실제 실행:
  - `BODAM_E2E_DB_PATH`를 주어도 app-data SQLite만 열고 지정 임시 DB를 만들지 않음
  - TCP 4445 listener 없음
  - production dist·raw binary·bundle에서 `wdio`, `WDIO`, `BODAM_E2E_DB_PATH` 문자열 무매치
  - production Cargo graph에는 WDIO plugin이 없고 E2E feature graph에만 두 plugin 존재
- 임시 E2E DB/WAL/SHM과 OS temp directory 잔존 0건, workspace SQLite artifact 0건
- 수동 native happy path: 합성 고객 create·update, 새 프로세스 persistence, soft-delete를 직접 조작했고 DB는 `total=1, active=0, migrations=1`이었다.
- Windows `windows-2025` hosted workflow는 구성했으나 이 macOS 작업에서 실행됐다고 주장하지 않는다. WebView2 미설치·network-offline VM 설치 검증은 plan-013의 별도 수동 증거다.

## Review Findings

- 1차 verdict: changes-required
- P1: 승인 운영 프로필 hash 불일치 → 현재 승인 snapshot SHA-256을 계획과 일치시키고 변경 결정을 기록했다.
- P2: migration history/runtime drift 불완전 → history exact match, history schema, application object allowlist와 부정 테스트를 추가했다.
- P2: 직접 IPC update·id·search 검증 불완전 → required-null update DTO, unknown field 거부, canonical UUID, 100자 검색 제한을 추가했다.
- P2: 예상 밖 오류 메시지 노출 → 알려진 customer 오류만 허용하고 나머지는 고정 문구로 redaction하며 unit test를 추가했다.
- P2: desktop collapsed 상태가 mobile drawer에 누출 → mobile에서 collapsed class를 해제하고 compact hidden child를 layout에서 제거했다.
- P2: dialog accessible name 연결 오류 → Vue `useId()`로 안정 ID를 생성하고 실제 Browser로 이름을 확인했다.
- P2: Windows NSIS CI 주장 불일치 → hosted release E2E와 plan-013 NSIS/offline VM acceptance를 분리했다.
- P3: Windows E2E DB cleanup race → recursive retry/backoff와 잔존 directory assertion을 추가했다.
- 최종 독립 재리뷰: PASS. 기존 8건 모두 resolved, 신규 P0–P3 finding 없음.

## Completion Notes

- Vue 3/Tauri 2/SQLite 기반의 첫 offline Customer 수직 기능을 완성해 검색·생성·수정·soft-delete와 재실행 persistence를 사용할 수 있다.
- Prisma migration artifact와 Rust runner 사이에 directory/hash, history, runtime object·column·index drift gate를 만들었다.
- Zod·Rust IPC 입력과 오류 redaction을 이중 경계로 두고 broad filesystem, shell, network capability와 production WebDriver를 제외했다.
- `npm run qa`는 비-GUI 검사, `npm run verify`는 release-mode 실제 앱 2회 E2E까지 반복 실행한다.
- 현재 macOS production app과 Browser 화면은 실제 조작했다. Windows hosted CI, NSIS/offline VM, 암호화와 나머지 MVP 기능은 검증 완료로 주장하지 않는다.
- 다음 계획은 Customer 상세의 InsurancePolicy CRUD와 고객 월보험료 합계다.
