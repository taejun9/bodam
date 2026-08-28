# 시스템 개요

## 상태

이 문서는 구현 중인 목표 아키텍처와 현재 feature 경계를 함께 기록한다.

## 실행 원칙

- Windows 우선 단일 사용자 Desktop Application
- 핵심 기능은 네트워크 없이 동작
- SQLite가 로컬 데이터의 source of truth
- 원격 API, 원격 AI, telemetry, 광고, 결제를 MVP에 포함하지 않음
- 입력, IPC, import 행 경계에서 Zod 검증
- 날짜 계산은 명시적 기준일·timezone을 받는 pure service가 담당
- UI는 저장 방식과 보험 비즈니스 규칙을 직접 호출하거나 계산하지 않음

## 논리 계층

    Vue UI
      → feature application/service 계약
        → domain service와 validation
          → repository / file / clock port
            → Tauri·SQLite·filesystem adapter

### UI

- 화면 렌더링, 사용자 입력 수집, loading/error/empty 상태
- Pinia에는 화면 간 공유되는 선택·필터·UI 상태를 둔다.
- 보험료 합산, 보장 판정, 날짜 대상 계산을 하지 않는다.

### Feature application

- use case 단위 orchestration
- 입력 schema 검증과 domain service 호출
- transaction 경계와 adapter 계약 사용
- UI에 표시할 DTO 반환

### Domain service

- 상령일, 만기 구간, 보험료 합계, 보장 합계·판정, 상담 대상 계산
- 순수 함수 또는 의존성이 명시된 service로 작성
- Vue, Tauri, Prisma, ECharts를 import하지 않음

### Adapter

- SQLite repository
- local filesystem import/export와 backup
- 시스템 clock
- Tauri dialog, capability, IPC

## 목표 소스 구조

    src/
      app/
        router/
        stores/
        shell/
      features/
        customer/
        family/
        insurance/
        coverage/
        consultation/
        dashboard/
        calendar/
        notification/
        data-exchange/
        backup/
        settings/
      shared/
        components/
        composables/
        utils/
        constants/
        contracts/
    database/
      prisma/
      migrations/
    src-tauri/

각 feature는 필요한 범위에서 다음 책임으로 분리한다.

    feature/
      components/
      pages/
      application/
      services/
      repositories/
      schemas/
      types/
      tests/

폴더를 기계적으로 모두 만들지 않는다. 해당 책임이 생기는 승인된 계획에서 필요한 디렉터리만 추가한다.

## Feature 경계

- customer: 고객 기본정보와 담당상태
- family: 가족 그룹, 구성원, 가족 보험료 조회
- insurance: 계약 정보와 계약 수명주기
- coverage: 표준 보장, 계약 보장, 합계, benchmark 판정
- consultation: 상담이력과 다음 연락일
- dashboard: 다른 feature의 read model 조합만 담당
- calendar: 날짜별 read model과 승인된 사용자 일정
- notification: 시작 시 대상 계산과 로컬 표시
- data-exchange: Excel/CSV parsing, validation, mapping, export
- backup: SQLite와 필요한 설정 파일의 백업·복원
- settings: 사용자 수정 가능한 기준과 로컬 환경 설정

`app_settings` singleton은 `light|dark|system` theme 선호, Dashboard 기간·건수와 nullable custom backup 위치를 소유한다. `system`은 UI adapter가 OS 색상 선호를 실제 `light|dark`로 해석하고 실행 중 변경도 반영하며, 저장 선호와 해석 결과를 구분한다. Backup adapter는 설정을 읽되 UI에 전체 path를 반환하지 않는다. live DB backup은 SQLite online backup API로 만들고 restore는 pending artifact를 staging한 뒤 다음 process 시작에서 어떤 feature repository connection도 열기 전에 적용한다.

feature 간 DB 테이블 직접 접근을 허용하지 않는다. 공유 규칙이 필요하면 소유 feature의 공개 application 계약 또는 명시적 shared domain 계약을 사용한다.

## Read model

Dashboard, calendar, notification은 원본을 소유하지 않는다. 고객·계약·보장·상담 데이터에서 계산된 read model을 요청 시 생성하거나 승인된 cache 전략을 사용한다.

ECharts는 service가 계산한 series를 표현할 뿐 합계나 판정을 계산하지 않는다.

## Transaction과 오류

- import, 가족 구성 변경, 계약과 보장 동시 변경은 원자성이 필요한 후보다.
- 정확한 transaction 경계는 use case 계획에서 결정한다.
- adapter 오류를 UI가 Prisma/SQLite/Rust 오류 문자열 그대로 표시하지 않는다.
- 사용자 메시지와 진단 로그를 분리하며 로그에 고객 행 값이나 메모를 남기지 않는다.

## 결정이 필요한 경계

- Prisma Client를 Tauri 앱에서 실행하는 방식
- Excel 처리 라이브러리와 실행 위치
- Windows 오프라인 installer의 WebView2 포함 방식

관련 문서:

- decisions/adr-001-prisma-tauri-runtime.md
- import-export.md
- calendar-notification.md
- backup-restore.md
- docs/product/open-questions.md
