# 테스트 전략

## 테스트 피라미드

### Domain unit

가장 많은 테스트를 둔다.

- 보험료와 보장 합계
- benchmark 판정 경계
- 상령일과 만기 30/60/90 계산
- 최근 상담/미상담 분류
- soft delete filter
- import row normalization과 validation
- backup retention 30개 선택

framework, DB, 실제 시간 없이 빠르게 실행되어야 한다.

### Application integration

- repository port와 SQLite adapter
- transaction rollback
- Foreign Key와 referential action
- migration 적용
- 승인된 import validation UX에서 commit까지
- export mapping
- backup 생성·복원 후 row count와 핵심 checksum 대사

실제 고객 데이터 대신 synthetic fixture를 사용한다.

### UI component

- loading, error, empty, success 상태
- mouse 중심 table, filter, dialog 동작
- dark mode
- keyboard 접근 가능한 기본 동작
- service DTO 표시가 정확하고 UI가 규칙을 재계산하지 않는지 확인

### Desktop smoke

- Windows 실행
- offline 실행
- SQLite 파일 생성과 재실행 유지
- native open/save dialog
- Excel/CSV import/export
- backup/restore
- installer와 WebView2 전략

desktop test 도구와 CI 환경은 project bootstrap 계획에서 선택한다.

## 고정 clock

날짜 기반 test는 시스템 현재 시간을 직접 읽지 않는다. KST 기준의 고정 clock과 명시적 기준일을 사용하고 경계 표를 fixture로 유지한다.

## Import / Export golden contract

첨부 workbook에서 구조만 추출해 synthetic golden workbook을 만든다. golden에는 가상의 고객과 계약만 넣고 다음을 비교한다.

- sheet 이름
- header row와 column 순서
- 날짜·금액 cell type과 number format
- 병합, 열 너비, 강조 서식 중 승인된 보존 범위
- row 단위 validation 결과

export fixture는 active source-backed parity 행만 포함하고 source 없는 수동 계약, domain/source 충돌과 soft-deleted parent를 제외한다. XLSX/CSV 생성 파일은 21개 raw text/null과 안정 정렬을 source table에 대사하고, release app에서 다시 import preview해 parser 호환성을 확인한다. export 전후 전체 사용자 table의 결정적 논리 스냅샷도 같아야 한다.

## 대사

- 가족 보험료 = 활성 가족 구성원의 활성 계약 월 보험료 합계
- 고객 보장 합계 = 활성 계약의 활성 보장 합계
- dashboard count = 동일 조건의 detail query count
- export row count = 선택된 활성 record count
- restore 후 핵심 table count와 schema version = backup 전 값

정확한 활성 계약 조건과 중복 규칙은 승인 후 식을 고정한다.
