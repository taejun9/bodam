# 제품 요구사항

이 문서는 사용자가 명시한 범위만 정리한다. 필드의 enum, 계산식, 중복 판정처럼 확정되지 않은 내용은 open-questions.md에 둔다.

## Customer

- 이름
- 생년월일
- 성별
- 연락처
- 주소
- 메모
- 담당상태
- 삭제 시 deletedAt을 기록하고 기본 조회에서 제외

## Family

- 이름이 필수인 가족 단위 생성·조회·수정·soft delete
- Customer와 membership을 통한 다대다 구성원 관리
- 같은 가족 안의 같은 Customer membership 중복 금지
- 선택 자유입력 관계명과 대표자 없는 구성원 조회
- 한 Customer의 복수 가족 소속 허용
- 활성 구성원의 합계대상 계약 월보험료를 가족별로 요청 시 합산
- 여러 가족을 다시 합친 전체 보험료 카드는 만들지 않음

## Insurance

- 보험사
- 상품명
- 가입일
- 보험기간
- 납입기간
- 월 보험료
- 고지플랜
- 만기일
- 갱신 여부
- 고객과의 Foreign Key
- 삭제 시 deletedAt을 기록

## Coverage

모든 보장을 표준 카테고리에 연결하고 고객별 보장금액을 합산한다.

초기 예시 카테고리:

- 암
- 유사암
- 뇌혈관
- 심혈관
- 질병수술
- 상해수술
- 후유장해
- 입원
- 간병
- 운전자

예시는 초기 데이터 후보이며 승인 없이 고정 enum으로 만들지 않는다.

## Coverage Benchmark

- 활성 보장 카테고리, 자유입력 성별, 포함 만 나이 시작·끝
- 적정하한과 과다하한은 KRW 원 단위 정수
- `금액 < 적정하한`은 부족
- `적정하한 ≤ 금액 < 과다하한`은 적정
- `금액 ≥ 과다하한`은 과다
- 같은 카테고리·정확히 같은 성별의 활성 나이 구간 겹침 금지
- 일치 기준이 없으면 `기준 미설정`이며 부족으로 간주하지 않음
- 일치 기준이 있는 카테고리는 Coverage 0건도 0원으로 판정
- 초기 권고금액 seed 없이 사용자가 Settings에서 생성·수정·soft delete
- 판정 결과는 저장하지 않고 명시적 OS-local 기준일에 요청 시 계산

성별은 enum·별칭·전체 wildcard로 해석하지 않고 Customer의 trim 저장값과 정확히 일치시킨다. 기준은 사용자가 정한 비교값이며 공식 보험 권고가 아니다.

## Consultation

- 활성 Customer와 상담 일시는 필수
- 상담 일시는 UTC timestamp로 저장하고 OS local timezone으로 입력·표시
- 상담내용, 다음 연락일, 상담 결과는 선택
- 다음 연락일은 `YYYY-MM-DD` date-only
- 상담 결과는 enum이 아닌 자유입력
- 상담내용 4,000자, 상담 결과 200자의 기술 입력 경계
- 같은 Customer와 같은 상담 instant의 여러 행을 ID별로 유지
- 고객별 활성 상담을 최신 일시 우선, 같은 instant는 ID 순서로 조회
- Customer와의 Foreign Key 및 활성 부모 확인
- 삭제 시 deletedAt을 기록하고 기본 조회에서 제외

상담 메모에도 민감 병력과 상세 병력을 저장하지 않는다.

## Dashboard

- 오늘 연락해야 하는 고객
- 상령 예정
- 만기 예정
- 보험료 TOP
- 가족 보험료
- 보장 부족 고객
- 최근 상담 고객
- 최근 미상담 고객

plan-008에서 다음 요청 시 read-model 계약을 승인했다.

- 활성 관리대상 Customer 기반 카드와 기존 Family summary를 사용하고 계산 결과는 저장하지 않음
- 카드별 전체 건수와 최대 10건, 날짜·금액·부족 수 우선 뒤 이름·stable id 동점 정렬
- 오늘 연락은 최신 상담의 `nextContactOn ≤ 오늘`, 최근 상담은 오늘 포함 30일, 미상담은 정확히 90일 이상 또는 상담 없음
- 상령·만기는 0–30, 31–60, 61–90일 비중복 bucket
- 보험료 TOP은 합계대상 계약의 0원 초과 고객, 가족 보험료는 기존 활성 Family 합계
- 보장 부족은 Benchmark `insufficient` Category가 하나 이상인 고객이며 `unconfigured`는 제외

기간·건수 사용자 설정과 카드 재배치는 후속 계획에서 승인받는다.

## Calendar

- 날짜별 상담일, 다음 연락일, 상령일, 만기일을 조회
- 제목과 `9998-12-31` 이하 실제 날짜 필수, 시간·메모·고객 연결 선택, 완료 boolean인 사용자 일정 CRUD
- 로컬 시간대를 사용하며 서버 동기화는 하지 않음
- `0001-01`–`9998-12` 월 보기, 경계에서 disabled/no-op인 이전·다음·오늘 이동, 선택일 agenda와 활성 고객 상세 이동
- 모든 활성 Customer를 포함하고 완료 일정도 상태로 계속 표시
- 연결 Customer가 soft delete되면 일정 원본을 유지하되 Calendar에서 숨김

plan-009에서 월 보기와 Schedule 저장·표시 계약을 승인했다. 주·일 보기, 반복·우선순위·drag and drop, 완료 일정 자동 숨김과 OS notification은 후속 범위다.

## Notification

- 프로그램 시작 시 로컬 데이터로 자동 계산
- 30일, 60일, 90일 만기 대상
- 상령일 대상
- 별도 서버 없음

## Import / Export

- Excel import/export
- CSV import/export
- 첨부 계약조회 양식의 열 계약과 표시 형식 지원
- 행 단위 검증, 오류 표시와 반영 확인 UX는 구현 계획에서 승인
- export 대상은 active Customer의 active Policy 중 1:1 import source가 있고, G/H/J/K/N/R/T를 현재 Policy로 mapping한 값이 정확히 같은 행
- `isManaged`·`isIncluded` 계산 flag는 export 대상 여부를 바꾸지 않음
- source 없는 수동 Policy와 domain/source 불일치는 각각 제외 사유와 건수만 표시하며 값을 합성하거나 한쪽을 자동 우선하지 않음
- 계약일자 blank-last, Customer 이름, Policy id 순서의 안정 정렬
- XLSX는 승인된 sheet·A:U header·text/blank·열 너비·행 높이·border 계약, CSV는 UTF-8 BOM·CRLF·RFC 4180·21 field 계약
- CSV formula trigger는 source를 변경하지 않고 파일 전체를 거부하며 XLSX 사용을 안내
- native save 취소는 파일·DB를 변경하지 않고, 기존 파일 교체는 사용자가 저장 창에서 승인한 경우에만 수행
- 성공 결과는 format·파일 basename·내보낸 건수·두 제외 건수만 표시
- PDF export는 MVP 제외

source 없는 수동 Policy의 21열 합성과 domain/source 충돌 해결 UI, 고객·기간 선택 export는 후속 승인 범위다.

## Backup

- SQLite online backup API로 열린 WAL DB의 일관된 snapshot 생성
- 기본 위치는 Tauri app-data의 `backups`, Settings에서 native dialog로 다른 로컬 폴더 선택 가능
- 앱 시작·resume·local date 변경 때 해당 local date의 성공 automatic backup이 없으면 daily backup 생성
- 정상 종료 시 마지막 성공 backup 이후 DB가 변경됐을 때만 exit backup 생성
- 검증된 daily·exit 자동 backup 최근 30개 보관, 수동·복원 전 안전 사본은 자동 retention에서 제외
- schema migration 수/마지막 이름, app version, UTC timestamp, DB byte size와 SHA-256 manifest 포함
- restore 전에 checksum·SQLite integrity·Foreign Key·등록 migration prefix 검증과 현재 DB 안전 사본 생성
- restore는 앱 재시작 전에 staging하고 repository 연결 전 교체·검증하며 실패 시 현재 DB로 rollback
- 종료 backup 실패는 종료를 멈추고 재시도 또는 경고 확인 후 backup 없이 종료 선택
- backup은 암호화하지 않으며 원본 DB와 같은 민감도의 평문 파일이고 같은 디스크 보관 한계가 있음

## Settings

- light/dark/system theme; system은 OS 색상 선호를 실행 중 변경까지 반영
- 최근 상담 기간 1–365일, 미상담 기준 1–3,650일이며 미상담 기준은 최근 상담 기간 이상
- Dashboard 카드별 공통 표시 건수 1–10; 상령·만기 0–30/31–60/61–90 bucket은 변경하지 않음
- 기존 사용자 정의 Coverage Benchmark
- 기본/custom local backup 위치와 지금 backup·restore 동작
- restore 시 장치별 custom backup path는 승계하지 않고 기본 app-data 위치로 초기화하며, 재선택은 native folder dialog로만 수행

## UI

- Windows 프로그램 느낌의 단순한 디자인
- 다크모드
- 반응속도 우선
- 마우스 사용성 우선
