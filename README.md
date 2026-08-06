# BODAM (보담)

보험설계사 한 명이 고객, 가족, 보험계약, 보장, 상담, 일정과 백업을 인터넷 없이 관리하는 Windows 우선 개인용 데스크톱 CRM입니다.

현재 고객·가족·보험계약·계약별 보장·고객별 상담 관리가 동작합니다. Tauri 데스크톱 앱에서 각 원본을 생성·수정·soft delete하고, 고객·가족 월보험료와 고객 카테고리별 보장 합계를 확인할 수 있습니다. 데이터는 앱 전용 SQLite 파일에 저장됩니다. 보장 Benchmark, Dashboard·달력과 데이터 관리는 후속 실행 계획에서 순차 구현합니다.

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
- 가족 그룹 생성·조회·이름 수정·soft delete
- 한 Customer의 복수 가족 소속과 선택 자유입력 관계명 관리
- 활성 구성원의 합계대상 계약을 반영한 가족별 월보험료 합계
- 보험계약별 표준 카테고리 보장 생성·조회·수정·soft delete
- 합계대상 계약의 활성 보장을 카테고리 ID별 금액·건수로 합산
- 합계 제외 계약의 보장 원본은 관리 화면에 유지하고 고객 합계에서만 제외
- 공통 초기 보장 카테고리 10개의 이름 변경과 영향 확인 후 soft delete
- 고객 상세의 상담 이력 생성·조회·수정·soft delete
- UTC로 저장하고 OS local timezone으로 표시하는 상담 일시와 선택 다음 연락일·자유입력 결과
- KRW 원 단위 정수, 가입일·만기일·다음 연락일 date-only와 상담 timestamp 검증
- SQLite migration checksum/history/runtime schema drift 검사
- light/dark 테마, 키보드 접근성, 모바일 반응형 브라우저 화면
- loading, empty, success, validation, adapter error 상태

### 보장 사용 흐름

1. 고객 상세의 보험계약 행이나 카드에서 `보장 관리`를 열고 카테고리와 가입금액을 등록합니다.
2. 같은 계약의 보장 목록에서 금액·카테고리를 수정하거나 확인 후 삭제합니다. 합계 제외 계약도 여기서는 계속 관리할 수 있습니다.
3. 고객 상세의 `고객 보장 합계`에서 합계대상 계약만 반영한 카테고리별 금액과 건수를 확인합니다.
4. `카테고리 관리`에서 공통 이름을 바꾸거나 연결 보장 영향 건수를 확인한 뒤 삭제합니다. 삭제된 카테고리의 연결 행은 보존되지만 목록과 합계에서 숨겨집니다.

### 가족 사용 흐름

1. 왼쪽 `가족`에서 이름만으로 가족을 등록합니다. 같은 이름도 별도 ID로 유지되며 자동 병합하지 않습니다.
2. `구성원 관리`에서 기존 활성 Customer를 선택하고, 필요하면 가족 안에서만 표시할 관계명을 입력합니다. 관계명은 법적 관계나 대표자 의미로 해석하지 않습니다.
3. 가족 목록과 구성원 dialog에서 활성 구성원의 합계대상 계약 월보험료를 확인합니다. `관리대상`과 자유 입력 상태는 가족 합계 제외 조건이 아닙니다.
4. 구성원을 제외해도 Customer·계약과 다른 가족 소속은 남습니다. 같은 Customer를 다시 추가하면 삭제했던 membership을 명시적으로 재활성화합니다.

가족 이름과 관계명에는 주민등록번호, 보험사 로그인 정보, 병력·진단·치료 내용을 입력하지 마세요. 삭제된 Family와 membership 원본은 로컬 DB에 남으며 현재 별도 purge·범용 복원 UI는 제공하지 않습니다.

### 상담 사용 흐름

1. 고객 목록에서 `상세`를 열고 `상담 기록`에서 상담 일시를 입력합니다. 내용·다음 연락일·결과는 선택입니다.
2. 화면에는 OS local 상담 일시가 표시되고 SQLite에는 같은 instant의 UTC timestamp가 저장됩니다. 다음 연락일은 시각 없는 `YYYY-MM-DD` 날짜로 저장됩니다.
3. 상담은 최신 일시 우선으로 표시됩니다. 같은 instant의 상담도 별도 ID로 유지되어 각각 수정하거나 삭제할 수 있습니다.
4. 상담을 삭제하면 기본 목록에서 숨겨지지만 원본은 로컬 DB에 남습니다. Customer를 제외해도 연결 상담 원본은 유지되고 기본 상세 조회에서 숨겨집니다.

상담 내용에는 주민등록번호, 보험사 로그인 정보, 민감 병력·상세 병력이나 진단·치료 상세를 입력하지 마세요. 이 안내는 저장 금지 정보를 기술적으로 탐지하거나 제거한다는 뜻이 아닙니다.

SQLite 파일은 Tauri가 결정한 운영체제별 app-data 디렉터리의 `bodam.sqlite3`에 저장됩니다. 앱을 제거하거나 사용자 프로필을 정리하기 전에 이 파일을 별도로 보관해야 하며, 자동 backup·restore UI는 아직 제공하지 않습니다.

## 현재 제한

- 보장 카테고리는 암, 유사암, 뇌혈관, 심혈관, 질병수술, 상해수술, 후유장해, 입원, 간병, 운전자 10개를 최초 migration에서 한 번만 제공합니다.
- 카테고리 신규 생성과 삭제 복원은 제공하지 않습니다. 이름을 바꾸거나 삭제해도 앱 시작 시 초기값으로 자동 복원하지 않습니다.
- 보장 기준금액, 연령·성별 Benchmark, 부족·적정·과다 판정과 전체 카테고리를 합친 단일 보장 총액은 제공하지 않습니다.
- 보장에는 카테고리와 가입금액만 저장하며 특약명, 피보험자, 보장기간, 메모, 병력·청구 정보는 저장하지 않습니다.
- 가족 대표, 관계 enum·방향성 그래프, 모든 가족을 합친 보험료와 가족 보장 합계는 제공하지 않습니다.
- 전역 상담 목록과 오늘 연락·최근 상담·미상담 판정은 아직 제공하지 않습니다. 다음 연락일은 상담 원본에 저장되지만 Dashboard·Calendar 대상 계산은 후속 범위입니다.
- 상담 복원·purge, 상담 유형·채널·태그·첨부와 외부 전화·메시지 연동은 제공하지 않습니다.

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

네이티브 앱의 고객·가족·보험계약·보장·상담 생성·수정·합계·soft delete와 프로세스 재시작 후 SQLite 지속성만 다시 확인하려면 다음 명령을 사용합니다.

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
