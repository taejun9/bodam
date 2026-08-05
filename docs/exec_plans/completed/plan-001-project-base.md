# plan-001-project-base

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

BODAM의 agent-ready 기본 베이스를 만들고, 첨부 계약조회 Excel 형식과 달력·일정 요구를 제품 및 아키텍처 문서에 반영한다.

## Approval

- 요청일: 2026-08-05
- 승인일: 2026-08-05
- 승인 근거: 사용자가 base 스킬을 명시적으로 호출하고 기본 베이스 생성을 요청했다.
- 승인 범위: 문서, 계획, 하네스, QA·리뷰·Git 흐름
- 제외: 애플리케이션 코드 생성, 패키지 설치, DB schema 구현, 기능 구현

향후 기능 작업은 각각 별도 active plan과 명시적 승인 기록이 필요하다.

## Goal

- 요구사항을 추측하지 않고 제품 범위와 미결정 질문을 분리한다.
- 첨부 Excel을 원본 변경 없이 분석해 import/export 계약을 문서화한다.
- Vue/Tauri/SQLite/Prisma 예정 구조의 경계와 결정 필요 사항을 기록한다.
- 계획 → 구현 → QA → 리뷰 → 커밋 흐름을 로컬 스크립트로 검증한다.

## Non-Goals

- Vue/Vite/Tauri/Prisma 프로젝트 생성
- CRM 기능, DB migration, 달력 UI, Excel parser 구현
- 첨부 원본 또는 실제 고객 데이터를 저장소로 복사
- 라이브러리 미지정 영역을 임의 선택
- 법률·의료·재무 적합성 판단

## Context Map

- README.md, AGENTS.md: 공개 진입점과 작업 지도
- docs/product/: 제품 범위, 요구사항, 미정 질문
- docs/architecture/: 계층, 데이터, Excel/CSV, 달력·알림, 백업, 결정 기록
- docs/privacy/: 저장 금지 정보와 로컬 데이터 경계
- docs/references/: 공식 문서와 입력 아티팩트 기록
- docs/quality/: QA와 리뷰 규칙
- harness/: 반복 가능한 검사와 템플릿

## Constraints

- main에서 직접 작업하지 않는다.
- 첨부 Excel은 읽기 전용으로 분석하며 행 값을 문서·로그에 노출하지 않는다.
- SQLite 전용 SQL을 제품 규칙으로 채택하지 않는다.
- business logic은 feature service가 소유하고 UI에서 계산하지 않는다.
- 300줄 이상 파일은 책임 단위로 분리한다.
- docs/plan을 만들지 않는다.
- QA와 리뷰는 별도 단계다.

## Implementation Plan

- [x] base 및 spreadsheet 스킬 지침 확인
- [x] 저장소 상태와 기존 파일 확인
- [x] codex/plan-001-project-base 및 전용 worktree 생성
- [x] 보수적 base scaffold 생성
- [x] 제품·요구사항·미정 질문 문서 구체화
- [x] 시스템·데이터·달력·Excel·백업 아키텍처 문서 구체화
- [x] 공식 자료와 입력 아티팩트 기록
- [x] QA·리뷰 하네스 및 negative controls 구현
- [x] QA 실행 및 증거 기록
- [x] QA 이후 독립 리뷰 및 findings 처리
- [x] completed plan과 review mirror 준비

## QA Plan

- python3 harness/scripts/test_harness.py
- python3 harness/scripts/run_qa.py
- python3 harness/scripts/run_review.py
- 필수 파일, strict plan 경로, 승인/status, branch/worktree, root Markdown, 300줄 제한 검사
- 실제 README 명령과 하네스 실행 결과 대조
- 첨부 workbook 모든 시트의 읽기 전용 렌더 확인
- 민감한 셀 값이 저장소에 복사되지 않았는지 확인

## Review Plan

QA 통과 후 다음을 독립적으로 확인한다.

- 요구사항 누락 또는 임의 확정
- Prisma/Tauri, Excel, 달력의 미결정 경계
- 개인정보와 실제 데이터 노출
- Excel 구조·형식 관찰의 정확성
- 계획·승인·QA·리뷰 gate의 실제 강제력

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-05 | 이번 사용자 요청을 plan-001 base 범위의 승인 근거로 기록 | 사용자가 base 생성 범위를 구체적으로 제공함 |
| 2026-08-05 | 애플리케이션 코드는 이번 계획에서 제외 | 이후 기능 구현은 계획 승인 후 진행한다는 사용자 규칙 준수 |
| 2026-08-05 | 첨부 workbook은 복사하지 않고 구조·서식 계약과 hash만 기록 | 실제 고객 데이터와 입력 아티팩트 보호 |
| 2026-08-05 | Excel 및 달력 라이브러리를 아직 선택하지 않음 | 스택에 지정되지 않았고 기능 범위도 추가 확인 필요 |
| 2026-08-05 | Prisma/Tauri 런타임 경계를 proposed ADR로 남김 | 현재 예정 스택만으로 실행 구조가 자동 결정되지 않음 |
| 2026-08-05 | sensitive artifact, 300줄, 승인/status, branch/worktree negative controls 추가 | 독립 리뷰에서 하네스 우회 가능성을 발견함 |
| 2026-08-05 | import preview와 달력 이동 동작을 승인 후보로 유지 | 기능 추측 금지 규칙 준수 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-05 | project_lead | 저장소가 초기 main 상태임을 확인했다. |
| 2026-08-05 | plan_keeper | 작업 브랜치와 worktree에서 base scaffold를 생성했다. |
| 2026-08-05 | repo_cartographer | 제품·품질·개인정보·아키텍처 문서를 구체화했다. |
| 2026-08-05 | privacy_guard | 첨부 workbook의 실제 행 값을 저장소에 복사하지 않고 구조만 기록했다. |
| 2026-08-05 | quality_runner | QA와 negative controls를 통과했다. |
| 2026-08-05 | review_judge | 1차 changes-required findings를 해결한 뒤 재리뷰 PASS를 확인했다. |
| 2026-08-05 | doc_gardener | completed plan과 review mirror를 준비했다. |

## QA Evidence

- workbook: artifact-tool로 계약조회(엑셀변환)_장기 A1:U19를 읽기 전용 import·전체 sheet 렌더, 원본 무수정
- workbook identity: 8,277 bytes, SHA-256 6f55b17726cbe939c138a07f3797309e11ac97ec76c67d597da4328c38ce4210
- command: python3 harness/scripts/test_harness.py
- result: PASS — 민감 아티팩트, 300줄 확장자, 승인/QA, main/worktree negative controls
- command: python3 harness/scripts/run_qa.py
- result: PASS — 필수 구조, 승인/status, branch/worktree, root Markdown, 300줄, 민감 아티팩트, README 명령
- command: python3 harness/scripts/run_review.py
- result: PASS — 리뷰 상태, QA evidence, completed mirror 사전조건

## Review Findings

- 1차 독립 리뷰: changes-required. SQLite sidecar·tabular artifact 보호, source 확장자 검사, 승인/QA/worktree gate, 달력·import 과잉 확정, Excel style 정확성, 입력 hash 기록을 보완했다.
- 2차 독립 리뷰: root 300줄 규칙과 import preview 품질 규칙의 잔여 모순을 보완했다.
- 최종 독립 재리뷰: PASS. P0–P3 미해결 finding 없음.

## Completion Notes

- agent-ready root 문서, durable 제품·아키텍처·품질·개인정보·근거 문서, 계획/리뷰 템플릿과 실행 가능한 하네스를 만들었다.
- 첨부 workbook은 원본 변경·복사 없이 21열 계약과 시각 구조를 문서화했다.
- 애플리케이션 코드와 package는 생성하지 않았다.
- Prisma/Tauri runtime, Excel·달력 라이브러리, 상령 산식, import 중복/부분 성공, backup 경로·암호화는 후속 승인 계획의 잔여 결정이다.
