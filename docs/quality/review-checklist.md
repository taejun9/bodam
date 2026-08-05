# 리뷰 체크리스트

QA가 통과한 뒤 시작한다.

## Scope

- plan Approval 범위 안의 변경인가?
- 요구사항을 임의로 추가하거나 enum·산식을 추측하지 않았는가?
- Non-Goals가 지켜졌는가?
- Decision Log가 실제 변경과 일치하는가?

## Architecture

- UI에서 비즈니스 규칙을 계산하지 않는가?
- feature가 다른 feature의 DB adapter를 직접 사용하지 않는가?
- clock, repository, filesystem 경계가 테스트 가능한가?
- Prisma/Tauri 경계가 승인된 ADR과 일치하는가?

## Data

- Foreign Key와 soft delete 규칙이 일관적인가?
- deleted record 포함/제외가 use case와 test에 드러나는가?
- 금액·날짜 type과 단위가 명확한가?
- SQLite 전용 의존이 adapter 밖으로 새지 않는가?

## Excel / Calendar / Backup

- 실제 첨부 행이 fixture나 log로 복사되지 않았는가?
- import error와 duplicate 정책이 승인된 내용과 일치하는가?
- export가 승인된 workbook 계약과 일치하는가?
- 날짜 경계와 local timezone test가 있는가?
- backup 실패와 restore 대사가 검증되는가?

## Privacy

- 저장 금지 정보가 model, form, memo 안내, fixture, log에 없는가?
- filesystem과 Tauri capability가 최소 범위인가?
- 원격 call, telemetry, tracker가 추가되지 않았는가?
- backup/export 파일의 노출 위험이 설명되었는가?

## Handoff

- README와 docs가 실제 명령·동작과 일치하는가?
- plan QA Evidence와 Review Findings가 채워졌는가?
- completed plan과 review mirror가 준비되었는가?
