# plan-030-portfolio-user-guide

## Status

completed

## Owner

project_lead / plan_keeper / doc_gardener

## User Request

다운로드 위치에 BODAM 포트폴리오와 사용설명법을 만든다.

## Approval

- 요청일: 2026-08-09
- 승인일: 2026-08-09
- 승인 근거: 사용자가 다운로드 위치에 포트폴리오와 사용설명법을 만들어 달라고 명시적으로 요청했다.
- 승인 범위: 현재 저장소의 승인된 제품 정의와 구현 증거를 바탕으로 한 한국어 포트폴리오 PPTX/PDF, 한국어 사용자 설명서 DOCX/PDF, 합성 데이터만 포함한 화면 자료, 렌더·구조·개인정보 QA, 다운로드 폴더 전달
- 승인 프로필: `docs/product/product.md`, `docs/product/requirements.md`, `docs/architecture/system-overview.md`, `docs/privacy/principles.md`, 완료된 Plan-001~029의 현재 승인 범위

## Goal

- BODAM의 문제, 대상 사용자, 핵심 기능, 설계 원칙, 기술 구조, 개인정보 경계와 현재 한계를 사실 기반 포트폴리오로 전달한다.
- 보험설계사 1명이 설치 후 주요 업무를 안전하게 수행할 수 있도록 시작·고객·가족·계약·보장·상담·달력·데이터 교환·백업·설정 흐름을 설명한다.
- 포트폴리오는 PPTX와 PDF, 사용설명서는 DOCX와 PDF로 제공하고 모든 최종 파일을 사용자의 Downloads 폴더에 둔다.

## Non-Goals

- 미구현 기능, 공식 보험 권고, 규제 준수, 의료·금융 효과나 정량 성과를 만들어 내지 않는다.
- 실제 고객 행, 첨부 원본, 연락처·주소·메모·계약 식별값을 문서·화면·로그에 넣지 않는다.
- 앱 기능, 데이터베이스, 제품 요구사항 또는 UI를 변경하지 않는다.
- Windows 설치·서명·배포 상태를 현재 증거보다 강하게 표현하지 않는다.

## Context Map

- 제품·요구사항: `docs/product/`
- 구조·경계: `docs/architecture/`
- 개인정보·운영 조건: `docs/privacy/principles.md`
- QA·실화면 근거: `docs/exec_plans/completed/plan-029-quality-workflow-validation.md`
- 화면·기능 구현: `src/App.vue`, `src/features/`, `src/shared/`
- 최종 전달: `/Users/taejungkim/Downloads/`

## Constraints

- `codex/plan-030-portfolio-user-guide`와 `.worktree/plan-030-portfolio-user-guide`에서만 작업한다.
- 문서 내용은 저장소의 승인된 사실과 합성 화면 증거만 사용한다.
- 포트폴리오 PPTX는 `@oai/artifact-tool`, 사용설명서 DOCX는 번들 Python/`python-docx`로 만들고 각각 전체 페이지를 렌더해 시각 검증한다.
- PDF는 최종 PPTX/DOCX에서 변환하고 모든 페이지를 다시 렌더해 확인한다.
- QA 뒤 독립 리뷰를 수행하고 리뷰 전 커밋하지 않는다.

## Open Questions

- 없음. 형식이 지정되지 않아 포트폴리오는 PPTX/PDF, 사용설명서는 DOCX/PDF를 기본 전달 형식으로 선택한다.

## Implementation Plan

- [x] 제품 문서, 완료 계획과 실제 화면 경로를 대사해 포트폴리오·사용설명서의 사실 목록과 금지 주장을 확정한다.
- [x] 합성 preview 또는 안전한 저장소 자산으로 주요 화면 이미지를 준비하고 개인정보 노출 여부를 검사한다.
- [x] 한국어 포트폴리오 PPTX를 작성하고 슬라이드별 source notes를 포함한다.
- [x] 한국어 사용설명서 DOCX를 compact reference guide 규격으로 작성하고 개인 메타데이터를 제거한다.
- [x] PPTX/DOCX를 PDF로 변환하고 네 최종 파일의 전체 페이지 렌더·시각·텍스트·파일 무결성 QA를 수행한다.
- [x] 전체 저장소 QA와 문서 범위·주장·개인정보 독립 리뷰를 수행하고 finding을 해결한다.
- [x] 최종 파일을 Downloads 폴더에 복사하고 해시·파일 크기·열기 가능 여부를 확인한다.
- [x] plan을 completed로 이동하고 동일 번호 review mirror를 작성한다.

## QA Plan

- 포트폴리오 PPTX: 모든 슬라이드 PNG 렌더, montage 흐름 확인, `slides_test.py`, 텍스트 추출·placeholder·overflow 검사
- 사용설명서 DOCX: `render_docx.py --emit_pdf` 전체 페이지 PNG 확인, style/list/table geometry·개인 메타데이터·민감정보 검사
- PDF: `pdfinfo`, `pdftotext`, `pdftoppm`으로 각 페이지 렌더·페이지 수·텍스트·글꼴/깨짐 확인
- 내용: 제품 정의·요구사항·Plan-029 증거와 표본 대사, 미구현/미정/운영 조건의 명시 확인
- 저장소: `git diff --check`, 변경 문서 300줄 제한, `python3 harness/scripts/run_qa.py`, review 상태에서 `python3 harness/scripts/run_review.py`
- 전달: `/Users/taejungkim/Downloads/`의 네 파일 존재, 비어 있지 않음, SHA-256 기록

## Acceptance Scenarios

1. 포트폴리오가 대상 사용자, 문제, 핵심 흐름, 기술·품질·개인정보 경계와 현재 한계를 과장 없이 설명한다.
2. 사용설명서가 앱 시작부터 고객·가족·계약·보장·상담·Calendar·가져오기/내보내기·백업/복원·설정까지 실행 가능한 순서와 주의사항을 제공한다.
3. 실제 고객 정보나 저장 금지 항목이 어떤 최종 산출물·화면·메타데이터에도 없다.
4. PPTX, DOCX와 두 PDF가 정상 열리고 전체 렌더에서 잘림·겹침·깨진 글리프·미해결 placeholder가 없다.
5. Downloads 폴더에 네 최종 파일이 있고 독립 리뷰에 해결되지 않은 P0-P2 finding이 없다.

## Review Plan

QA 통과 뒤 independent reviewer가 네 최종 파일과 source artifact를 대상으로 제품 사실성, 미구현 기능 표현, 문서 사용성, 시각 품질, 개인정보·로컬 저장 경계와 QA 증거를 검토한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-09 | 사용자 요청 자체를 Plan-030 승인으로 기록 | 포트폴리오·사용설명서 생성과 Downloads 전달 범위가 명시적임 |
| 2026-08-09 | 포트폴리오는 PPTX/PDF, 사용설명서는 DOCX/PDF로 제공 | 발표·공유와 편집·인쇄 요구를 함께 충족하는 범용 형식 |
| 2026-08-09 | 외부 마케팅 수치 없이 저장소 증거만 사용 | 정량 성과·준수·추천을 추측하지 않고 사실성을 보장 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-09 | plan_keeper | Plan-030 branch/worktree와 사용자 요청에 근거한 승인 계획을 만들었다. |
| 2026-08-09 | repo_cartographer | 제품·요구사항·구조·개인정보 문서와 현재 README를 대사해 구현/제한/미정 사항을 분리했다. |
| 2026-08-09 | project_lead | 합성 예시 데이터만 사용해 대시보드·고객·가족·달력·데이터 관리 화면을 캡처했다. |
| 2026-08-09 | doc_gardener | 14장 포트폴리오와 15쪽 사용설명서를 만들고 PPTX/DOCX/PDF 전체 렌더를 검수했다. |
| 2026-08-09 | quality_runner | 산출물 구조 검사와 `npm run qa`를 통과해 상태를 review로 전환했다. |
| 2026-08-09 | review_judge | source note 경로와 OS 잠금 표현, 최신 산출물 해시를 교정한 뒤 잔여 P0-P2 없음으로 승인했다. |
| 2026-08-09 | project_lead | 네 최종 파일을 Downloads에 복사하고 크기·해시·Office ZIP·PDF 페이지 구조를 확인했다. |
| 2026-08-09 | plan_keeper | completed plan 이동과 동일 번호 review mirror를 작성했다. |

## QA Evidence

- result: PASS
- `npm run qa`: PASS. ESLint, vue-tsc, Prisma validate/diff, database registry, Vite build, Cargo check, base harness가 통과했다.
- Vitest: 84 files / 370 tests PASS. Cargo: 319 tests PASS.
- 포트폴리오: PPTX 14장 렌더와 montage 전수 확인, `slides_test.py` overflow 0, source notes 14개 확인.
- 사용설명서: DOCX 15쪽 렌더와 montage 전수 확인, table geometry PASS, inline image 8개, accessibility high/medium/low 0/0/0, privacy scrub 적용.
- PDF: 포트폴리오 14쪽, 사용설명서 15쪽. `pdfinfo`, Poppler 전 페이지 렌더, `pdftotext` 한글 추출, placeholder scan PASS.
- 최종 임시 SHA-256: PPTX `d24eec8f15cdae9b6d3052a1af9bb325c1c43ceaccdc80a631e251371fb17fa2`; 포트폴리오 PDF `70f92e6b69fbb7932b41eb9cfb2bbde56b1d3350cce03f429b8ccbd635731d99`; DOCX `f50ae6a313aaa1f8bc8f2a4232f09f87af8a6cdf37d64bb23c3b2ddb26d3c28a`; 설명서 PDF `64f00ab6f57d466622e26ab4fda349a1afd88087f228fb6d8c7428846b37005a`.
- Downloads 전달 검증: 네 파일이 비어 있지 않고 임시 최종본과 SHA-256이 일치했다. PPTX/DOCX `unzip -t`와 Poppler `pdfinfo`에서 포트폴리오 14쪽·사용설명서 15쪽을 확인했다.
- `python3 harness/scripts/run_review.py`: PASS. 독립 심사 전제와 durable evidence를 확인했다.

## Review Findings

- resolved P2 — 슬라이드 13 speaker notes가 존재하지 않는 Plan-029 파일을 가리켰다. 실제 근거인 `plan-029-quality-workflow-validation.md`로 교정하고 14개 source path의 존재를 확인했다.
- resolved P2 — 슬라이드 11의 `자동 잠금`이 앱 잠금 구현으로 읽힐 수 있었다. 현재 운영 경계에 맞게 `OS 화면 자동 잠금`으로 명확히 했다.
- resolved P2 — reviewer 수정 뒤 PPTX와 포트폴리오 PDF 해시가 plan의 이전 값과 달랐다. 최신 산출물과 Downloads 전달본의 해시로 교정했다.
- independent artifact review: 잔여 P0-P2 finding 없음. PPTX/PDF 14장, DOCX/PDF 15쪽, 시각·구조·접근성·개인정보·사실성 검증 승인.
- residual P3 — 설명서의 일부 데이터 교환·복원 용어에 한국어 병기를 더하고 10쪽에도 근거 행을 맞추면 비기술 사용자 친화성과 추적성을 높일 수 있다. 현재 절차의 정확성이나 완결성을 막지는 않는다.

## Completion Notes

- 완료 결과: BODAM 포트폴리오 PPTX/PDF와 사용설명서 DOCX/PDF를 합성 화면과 저장소 근거로 제작해 `/Users/taejungkim/Downloads/`에 전달했다.
- 품질 결과: 전체 저장소 QA, 14장/15쪽 전 페이지 렌더, Office/PDF 구조·텍스트·접근성·개인정보 검사와 독립 심사를 통과했다.
- 운영 경계: 포트폴리오와 설명서는 공식 보험 권고가 아님, 로컬 평문 SQLite·백업, app lock·OS notification 미제공, native 기능의 browser preview 한계를 명시한다.
