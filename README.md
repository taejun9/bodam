# BODAM (보담)

보험설계사 한 명이 고객, 가족, 보험계약, 보장, 상담, 일정과 백업을 인터넷 없이 관리하는 Windows 우선 개인용 데스크톱 CRM입니다.

현재 저장소는 애플리케이션 구현 전 단계의 프로젝트 기반입니다. 제품 요구사항, 아키텍처 경계, 개인정보 보호 규칙, 실행 계획과 QA·리뷰 절차만 준비되어 있으며 Vue/Tauri 애플리케이션 코드는 아직 생성하지 않았습니다.

## 핵심 원칙

- 로컬 우선: 핵심 기능과 SQLite 데이터는 인터넷 연결 없이 동작합니다.
- 단일 사용자: MVP는 보험설계사 한 명의 개인 사용을 대상으로 합니다.
- 계획 우선: 승인된 실행 계획 없이는 구현하지 않습니다.
- 계층 분리: UI는 비즈니스 규칙과 데이터 저장 방식을 직접 알지 않습니다.
- 개인정보 최소화: 주민등록번호, 보험사 로그인 정보, 민감 병력과 상세 병력을 저장하지 않습니다.
- 이식성: SQLite 전용 SQL을 피하고 PostgreSQL 이전 가능성을 서비스·스키마 경계에서 보존합니다.

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

Python 3만 있으면 기반 문서와 작업 규칙을 검사할 수 있습니다.

    python3 harness/scripts/run_qa.py
    python3 harness/scripts/run_review.py

Vue/Tauri 프로젝트가 생성된 뒤 실제 package 명령을 docs/quality/rules.md와 이 README에 함께 추가합니다. 존재하지 않는 명령을 미리 약속하지 않습니다.

## 예정 기술 스택

- Frontend: Vue 3, Vite, TypeScript, Tailwind CSS, Pinia, Vue Router
- Desktop: Tauri
- Database: SQLite
- ORM/Migration: Prisma
- Chart: Apache ECharts
- Validation: Zod
- Date: dayjs

Prisma와 Tauri의 런타임 연결 방식은 아직 결정하지 않았습니다. docs/architecture/decisions/adr-001-prisma-tauri-runtime.md에서 대안을 검토한 후 별도 계획으로 승인합니다.

## 작업 흐름

모든 구현 작업은 다음 순서를 지킵니다.

    계획 작성 및 승인
    → 구현
    → 테스트/QA
    → 리뷰
    → 계획 완료 처리
    → 커밋

main에서 직접 작업하지 않습니다. 작업 브랜치는 codex/plan-NNN-task, worktree는 .worktree/plan-NNN-task 형식을 사용합니다.
