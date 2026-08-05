# plan-001-project-base Review

## Verdict

pass

## Scope

- plan: docs/exec_plans/completed/plan-001-project-base.md
- reviewed tree: codex/plan-001-project-base worktree
- review order: 자동 QA 통과 후 독립 읽기 전용 리뷰
- reviewed_at: 2026-08-05 KST

## QA Evidence

- 첨부 workbook 전체 sheet 읽기 전용 렌더와 구조 검사: PASS
- python3 harness/scripts/test_harness.py: PASS
- python3 harness/scripts/run_qa.py: PASS
- python3 harness/scripts/run_review.py: PASS
- git diff whitespace 검사: PASS

## Findings

| severity | finding | resolution |
|---|---|---|
| P1 | SQLite WAL/SHM과 CSV/TSV/XLSM 등 민감 아티팩트가 gate를 우회 | ignore·scanner 패턴과 negative controls 추가 |
| P2 | Prisma/JS/YAML 등 300줄 검사 누락과 migration/generated 예외 모순 | source 확장자 확대, lockfile 외 예외 제거, 파일 분리 |
| P2 | Approval heading만으로 구현·QA·리뷰 진행 가능 | 승인일·근거·범위, status, checkbox, QA evidence를 검증 |
| P2 | main 또는 잘못된 worktree에서도 gate 통과 가능 | branch와 active plan, .worktree 경로 일치 검사 |
| P2 | 달력 이동, 상령 30/60/90, import preview를 임의 확정 | 사용자 명시 범위와 승인 후보를 분리 |
| P3 | Excel 기본 행 높이·첫 data row border 설명이 부정확 | OOXML 및 렌더 관찰에 맞게 수정 |
| P3 | 같은 이름의 workbook을 구분할 근거 부족 | 파일 크기와 SHA-256 기록 |

모든 finding 해결 후 독립 재리뷰에서 P0–P3 미해결 finding이 없음을 확인했다.

## Requirements Trace

- 개인용 offline Windows CRM: product와 system overview에 고정
- 고객·가족·보험·보장·상담·dashboard·notification·backup·settings: requirements에 명시
- 달력과 일정: 날짜 source와 미정 UX를 분리
- Excel/CSV: 첨부 workbook 21열 계약, mapping 미정 항목, synthetic test 경계 기록
- SQLite/Prisma/FK/soft delete/이식성: data model과 proposed ADR에 기록
- 계획 → 승인 → 구현 → QA → 리뷰 → 커밋: AGENTS, quality rules, templates, scripts로 강제

## Privacy Review

- 원본 workbook을 repository에 복사하지 않았다.
- 실제 cell 값, 고객 이름, 연락처, 주소, 증권번호를 문서·fixture·로그에 기록하지 않았다.
- 주민등록번호, 보험사 로그인 정보, 민감 병력, 상세 병력을 저장 금지로 고정했다.
- DB sidecar와 tabular artifact를 기본 ignore 및 QA reject 대상으로 추가했다.
- network, telemetry, remote AI, broad filesystem permission을 MVP에서 승인 없이 허용하지 않는다.

## Residual Risk

다음은 finding이 아니라 의도적으로 미결정한 후속 승인 항목이다.

- Prisma Client와 Tauri의 runtime 경계
- Excel 처리 및 달력 UI 라이브러리
- 상령일 산식과 날짜 경계
- import duplicate와 partial success
- backup 기본 경로, 암호화, 종료 실패 UX
- Windows installer의 완전 offline WebView2 전략

## Follow-Ups

- 다음 active plan 후보: 프로젝트 bootstrap 및 Prisma/Tauri runtime spike
- 기능·package·schema 구현 전 사용자 승인 필요
