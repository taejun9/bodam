# 품질 규칙

## Planning Gate

- 모든 구현은 docs/exec_plans/active/plan-NNN-task.md에서 시작한다.
- plan에는 User Request, Approval, Goal, Non-Goals, Implementation Plan, QA Plan, Review Plan, Decision Log가 있어야 한다.
- 사용자 승인 전 implementation checkbox를 진행하지 않는다.
- 범위나 접근 변경은 코드와 함께 또는 먼저 Decision Log에 기록한다.
- docs/plan은 금지한다.

## Git Gate

- main에서 구현·커밋·푸시하지 않는다.
- codex/plan-NNN-task 브랜치와 .worktree/plan-NNN-task를 사용한다.
- QA와 리뷰 후 plan을 completed로 이동하고 review mirror를 만든다.
- 그다음 커밋, main 병합·푸시, git branch -d, worktree 제거 순서로 마친다.
- lifecycle을 완료할 수 없으면 우회하지 않고 정확한 blocker를 보고한다.

## Code Gate

- 300줄 이상이 되기 전에 책임 단위로 분리한다.
- package manager와 Cargo lockfile처럼 분리할 수 없는 lockfile만 줄 수 검사에서 제외한다.
- `node_modules`, `target`, `dist`, `src-tauri/gen`처럼 도구가 매 실행마다 다시 만드는 gitignored cache는 저장소 산출물이 아니므로 줄 수 검사 입력에서 제외한다. 커밋하거나 프로젝트가 직접 생성·배포하는 artifact에는 이 예외를 적용하지 않는다.
- TypeScript strict mode를 유지한다.
- UI component와 Pinia store에 보험 비즈니스 계산을 넣지 않는다.
- domain service는 Vue, Pinia, Router, Tauri, Prisma, ECharts에 의존하지 않는다.
- 외부 입력, Excel/CSV row, IPC payload는 Zod schema로 검증한다.
- clock과 filesystem, repository는 test에서 대체 가능하게 경계를 둔다.
- soft-deleted record를 포함하는 query는 의도를 이름과 test로 드러낸다.

## Database Gate

- schema 변경은 Prisma Migration으로 기록한다.
- 관계에는 Foreign Key와 의도적인 referential action을 둔다.
- 업무 삭제는 deletedAt soft delete가 기본이다.
- product service에 SQLite 전용 SQL을 두지 않는다.
- 금액은 부동소수점 계산을 피하고 단위를 명시한다.
- migration과 restore는 깨끗한 DB 및 기존 fixture DB에서 검증한다.

## Excel / CSV Gate

- 원본 파일을 수정하지 않는다.
- import는 parse, normalize, validate와 commit 책임을 분리하고 raw→mapped parity를 native commit 경계에서 다시 검증한다.
- 행 번호와 필드별 오류를 반환하되 실제 고객 값을 로그에 남기지 않는다.
- 활성 Policy의 보험사+source 증권번호 duplicate와 preview snapshot을 commit 직전에 다시 검사한다.
- 선택한 유효 행은 Customer·Policy·source를 한 transaction에서 모두 성공시키거나 모두 rollback한다.
- 실제 파일 선택은 native dialog가 소유하고 UI command에 임의 경로나 broad filesystem capability를 노출하지 않는다.
- XLSX는 실제 압축 해제 byte, Calamine식 ZIP name collision, shared-string 선언/실제 item과 target sheet decoded UTF-8 text 반복 참조 상한을 소유 preview allocation 전에 합성 공격 fixture로 검증한다.
- raw worksheet fixture로 shared index alias, implicit numeric text fallback, inline type 혼동, nested·복수 formula-string 값을 file error로 거부하고 정상 numeric·inline·entity text와 `sheetData` 밖 extension 호환을 고정한다.
- export는 승인된 열 순서·헤더·날짜·금액 형식을 golden fixture와 비교한다.
- 실제 첨부 파일은 repository fixture로 사용하지 않고 synthetic fixture를 만든다.

## Date / Calendar Gate

- 모든 계산 service는 기준일 또는 clock을 주입받는다.
- 상령일 산식과 30/60/90 경계 규칙을 승인된 test case로 고정한다.
- 월말, 연말, 윤년, 2월 29일, null, 과거일을 테스트한다.
- UTC instant의 local 월 귀속과 date-only·local wall time의 timezone 불변을 구분해 테스트한다.
- Calendar event는 source 종류·stable id·날짜·시간·제목·id 정렬과 soft-deleted parent visibility를 테스트한다.
- UI에서 날짜 차이를 다시 계산하지 않는다.

## Privacy Gate

- 주민등록번호, 보험사 로그인 정보, 민감 병력, 상세 병력을 저장하지 않는다.
- 실사용 고객 행, 메모, 연락처, 주소를 sample, test, docs, log, screenshot에 넣지 않는다.
- broad filesystem capability, telemetry, remote call은 별도 근거와 승인이 필요하다.
- backup과 export도 원본 DB와 같은 민감도로 다룬다.

## QA → Review → Commit

현재 기반 검증:

    python3 harness/scripts/run_qa.py
    python3 harness/scripts/run_review.py

애플리케이션 bootstrap 이후 다음 종류의 실제 명령을 package scripts로 만들고 문서와 하네스에 연결한다.

- unit test
- lint
- vue-tsc typecheck
- Vite build
- Tauri check/build
- migration 검증
- 전체 QA
- 최종 verify

명령이 실제로 동작하기 전 README에 실행 가능하다고 적지 않는다.

## 완료 정의

- 승인 범위가 구현됨
- 자동 QA 통과
- 수동 리뷰 findings가 해결되거나 잔여 위험으로 승인됨
- 문서와 실제 명령이 일치
- active plan이 completed로 이동
- 동일 plan 번호의 review mirror 존재
- 커밋과 Git lifecycle 완료
