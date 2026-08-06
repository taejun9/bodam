# 백업과 복원 계약

## 상태

승인된 운영 프로필과 구현 후보를 기록한 문서이며 자동 backup·restore UI는 아직 구현되지 않았다. plan-011 계약 파일 export 범위에는 포함하지 않고 후속 Exec Plan에서 구현·검증한다.

## 사용자 요구

- 프로그램 종료 시 백업
- 하루 1회 자동 백업
- 최근 30개 보관
- 복원 기능
- 별도 서버 없이 로컬에서 동작

## 기본 원칙

- backup은 SQLite 파일을 다루는 infrastructure use case이며 UI가 파일을 직접 복사하지 않는다.
- 열려 있는 DB 파일을 무조건 byte copy해 일관된 backup이라고 가정하지 않는다.
- 선택한 SQLite adapter와 transaction 방식에 맞는 안전한 snapshot 절차를 검증한다.
- 성공한 새 backup을 검증한 뒤에만 retention 정리를 수행한다.
- backup, export, 원본 DB를 같은 민감도로 취급한다.

## Trigger

### 프로그램 종료

- 정상 종료 요청에서 진행 중 write transaction을 정리한 뒤 backup을 시도한다.
- backup 실패 시 종료를 막을지 경고 후 종료할지 사용자 승인이 필요하다.
- OS 강제 종료, crash, 전원 차단에서는 실행을 보장하지 않는다.

### 하루 1회

- 마지막 성공 backup 날짜와 현재 local date를 비교하는 후보가 있다.
- 앱이 하루 종일 실행되는 경우 trigger 시점과 sleep/resume 처리는 미정이다.
- 같은 날 종료 backup과 daily backup이 겹칠 때 중복 생성 규칙은 미정이다.

## Backup 단위 후보

- SQLite database
- schema/migration version metadata
- 복원에 필수인 로컬 설정

cache, log, import 임시파일과 export는 기본 backup 대상이 아니다. 정확한 manifest는 구현 계획에서 승인한다.

## Retention

- 최근 30개는 성공하고 검증된 backup을 기준으로 한다.
- 정렬 key는 파일명 문자열이 아니라 manifest timestamp 후보를 사용한다.
- 31번째 성공 backup 뒤 가장 오래된 대상 하나를 제거하는 흐름을 우선 검토한다.
- 삭제 실패가 새 backup 성공을 무효화하지 않도록 별도 상태로 보고한다.
- 사용자가 직접 지정한 backup과 자동 backup을 같은 retention에 포함할지는 미정이다.

## Restore

    파일 선택
      → 확장자·manifest·schema version 확인
      → 현재 DB의 복원 전 안전 사본
      → 앱 write 차단
      → 임시 위치에서 무결성 확인
      → 원자적 교체 후보
      → repository 재연결
      → 핵심 table 대사
      → 성공 또는 rollback

- 호환되지 않는 future schema를 조용히 열지 않는다.
- restore 중 원본 파일을 덮어쓴 뒤 실패하는 순서를 피한다.
- restore 완료 후 앱 재시작 필요 여부는 runtime adapter에 맞춰 결정한다.
- backup 암호화와 recovery key는 승인 없이 도입하지 않는다.

## 오류와 로그

- 경로, 단계, error code, schema version처럼 진단에 필요한 최소 정보만 기록한다.
- 고객 row, 상담 메모, 증권번호를 log에 남기지 않는다.
- 디스크 부족, 권한 없음, 파일 잠금, 손상, retention 삭제 실패를 구분한다.

## QA

- 빈 DB와 populated synthetic DB
- write transaction 직전·직후
- 같은 날 여러 번 종료
- 날짜 변경과 Windows sleep/resume
- 29, 30, 31개 retention
- 디스크 부족과 읽기 전용 경로
- 손상 backup, 오래된 schema, future schema
- restore 전후 schema version, table row count, 핵심 checksum 대사
- restore 실패 시 현재 DB 보존

## 미결정

- 기본 backup 경로와 사용자 지정 경로
- 암호화와 앱 잠금
- daily trigger 시각과 종료 중복
- 수동 backup의 retention 포함 여부
- backup 파일명과 manifest format
- 실패 시 종료 UX
