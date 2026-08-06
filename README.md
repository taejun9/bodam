# BODAM (보담)

보험설계사 한 명이 고객, 가족, 보험계약, 보장, 상담, 일정과 백업을 인터넷 없이 관리하는 Windows 우선 개인용 데스크톱 CRM입니다.

현재 고객 관리와 고객별 보험계약 관리가 동작합니다. Tauri 데스크톱 앱에서 고객과 계약을 생성·수정·soft delete하고, 합계대상 계약의 월보험료를 확인할 수 있습니다. 데이터는 앱 전용 SQLite 파일에 저장됩니다. 가족·보장·상담·달력·데이터 관리는 후속 실행 계획에서 순차 구현합니다.

## 핵심 원칙

- 로컬 우선: 핵심 기능과 SQLite 데이터는 인터넷 연결 없이 동작합니다.
- 단일 사용자: MVP는 보험설계사 한 명의 개인 사용을 대상으로 합니다.
- 계획 우선: 승인된 실행 계획 없이는 구현하지 않습니다.
- 계층 분리: UI는 비즈니스 규칙과 데이터 저장 방식을 직접 알지 않습니다.
- 개인정보 최소화: 주민등록번호, 보험사 로그인 정보, 민감 병력과 상세 병력을 저장하지 않습니다.
- 이식성: SQLite 전용 SQL을 피하고 PostgreSQL 이전 가능성을 서비스·스키마 경계에서 보존합니다.

로컬 저장은 암호화를 뜻하지 않습니다. 현재 데이터 보호는 운영체제 사용자 계정과 디스크 접근 통제에 의존하므로, 공유 PC에서는 사용하지 말고 운영체제 전체 디스크 암호화를 권장합니다.

## 바로 실행하기

필수 환경은 Node.js 24, npm, 최신 stable Rust와 대상 운영체제용 Tauri 2 빌드 도구입니다.

    npm install
    npm run tauri:dev

브라우저에서 UI만 빠르게 확인하려면 다음 명령을 사용합니다.

    npm run dev

브라우저 실행은 Tauri IPC 대신 `localStorage`의 명시적인 합성 미리보기 저장소를 사용합니다. 실제 고객 데이터와 SQLite 지속성 검증은 반드시 Tauri 앱에서 수행합니다.

macOS 디버그 앱 번들은 다음 명령으로 만들 수 있습니다.

    npm run tauri -- build --debug --bundles app

Windows 배포 대상은 WebView2 offline installer를 포함하도록 구성되어 있지만, Windows 설치·실행 완료 여부는 Windows CI와 깨끗한 VM 증거가 있기 전에는 주장하지 않습니다.

## 현재 기능

- 고객 목록과 이름·연락처·담당 상태 검색
- 이름 필수 고객 등록과 입력 검증
- 고객 정보 및 관리 대상 여부 수정
- 확인 대화상자를 거친 `deletedAt` soft delete
- 고객 상세의 보험계약 생성·조회·수정·soft delete
- 합계 포함 여부를 반영한 고객별 월보험료 합계
- KRW 원 단위 정수와 가입일·만기일 date-only 검증
- SQLite migration checksum/history/runtime schema drift 검사
- light/dark 테마, 키보드 접근성, 모바일 반응형 브라우저 화면
- loading, empty, success, validation, adapter error 상태

SQLite 파일은 Tauri가 결정한 운영체제별 app-data 디렉터리의 `bodam.sqlite3`에 저장됩니다. 앱을 제거하거나 사용자 프로필을 정리하기 전에 이 파일을 별도로 보관해야 하며, 자동 backup·restore UI는 아직 제공하지 않습니다.

## 시작 위치

- 제품 범위: docs/product/product.md
- 상세 요구사항: docs/product/requirements.md
- 미결정 질문: docs/product/open-questions.md
- 시스템 구조: docs/architecture/system-overview.md
- 데이터 원칙: docs/architecture/data-model.md
- Excel/CSV 계약: docs/architecture/import-export.md
- 달력·알림 계약: docs/architecture/calendar-notification.md
- 품질 규칙: docs/quality/rules.md
- 개인정보 규칙: docs/privacy/principles.md
- 공식 자료: docs/references/official-sources.md
- 현재 계획: docs/exec_plans/active/

## 현재 실행 가능한 검증

전체 제품 QA와 동일 검증의 최종 재실행:

    npm run qa
    npm run verify

`qa`는 일상적으로 실행 가능한 비-GUI 검사입니다. `verify`는 `qa` 다음에 release-mode Tauri 앱을 실제로 두 번 실행하는 WebdriverIO E2E까지 수행합니다. E2E는 별도의 합성 고객과 임시 SQLite만 사용하며 종료 시 DB 파일을 삭제합니다.

네이티브 앱의 고객·보험계약 생성·수정·합계·soft delete와 프로세스 재시작 후 SQLite 지속성만 다시 확인하려면 다음 명령을 사용합니다.

    npm run test:e2e

Windows hosted runner도 같은 embedded WebDriver 방식을 사용합니다. 다만 hosted 성공은 WebView2가 없는 offline VM의 installer 실행을 대신 증명하지 않으므로 증거 범위는 [Windows E2E 증거 기준](docs/quality/windows-e2e-evidence.md)을 따릅니다.

개별 검증:

    npm run lint
    npm run typecheck
    npm run test:unit
    npm run prisma:validate
    npm run test:db
    npm run build
    npm run tauri:check

저장소 구조·계획·개인정보·아키텍처 하네스:

    python3 harness/scripts/run_qa.py
    python3 harness/scripts/run_review.py

## 기술 스택

- Frontend: Vue 3, Vite, strict TypeScript, Pinia, Vue Router
- Desktop: Tauri 2 + Rust
- Database runtime: bundled SQLite via `rusqlite`
- Schema/migration artifact source: Prisma
- Validation: Zod와 Rust command validation
- Test/quality: Vitest, WebdriverIO embedded Tauri WebDriver, ESLint, vue-tsc, Cargo test/clippy, Python harness

Prisma는 schema와 migration artifact의 source이며 runtime ORM으로 사용하지 않습니다. Tauri의 Rust adapter가 같은 migration SQL을 적용하고 SQLite를 접근합니다. 결정과 검증 경계는 `docs/architecture/decisions/adr-001-prisma-tauri-runtime.md`에 기록되어 있습니다.

## 작업 흐름

모든 구현 작업은 다음 순서를 지킵니다.

    계획 작성 및 승인
    → 구현
    → 테스트/QA
    → 리뷰
    → 계획 완료 처리
    → 커밋

main에서 직접 작업하지 않습니다. 작업 브랜치는 codex/plan-NNN-task, worktree는 .worktree/plan-NNN-task 형식을 사용합니다.
