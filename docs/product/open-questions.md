# 구현 전 확인할 질문

아래 항목은 요구사항 누락이 아니라 의도적으로 미결정 상태다. 관련 구현 계획에서 사용자 승인 없이 답을 추측하지 않는다.

## 도메인 규칙

- 월 보험료에 특약 보험료가 포함되는지 여부
- 보험기간·납입기간의 저장 단위와 종신 표현
- 갱신 계약의 갱신 주기와 다음 갱신일 관리 여부
- 보장금액의 통화·단위와 중복 특약 합산 규칙

## 데이터 관계

- 보험계약과 보장 레코드의 필수/선택 관계

## Excel / CSV

- 동일 양식 export가 값·헤더·열 순서만 의미하는지, 열 너비·색·병합·인쇄 설정까지 의미하는지
- source 없는 수동 계약과 import 뒤 사용자가 수정한 domain/source 값을 동일 양식 export에서 어떻게 표현할지
- export 대상·정렬·파일명과 기존 파일 덮어쓰기 기본값

## Notification

- 30/60/90일 구간의 중복 노출 방식
- 앱을 여러 날 실행하지 않았을 때 시작 계산과 하루 1회 계산의 기준
- 오늘의 경계와 Windows 로컬 시간대 변경 처리

## Desktop / Database

- Prisma Client를 Node sidecar에서 실행할지, Prisma를 schema/migration에만 사용할지
- Windows installer가 인터넷 없이 설치되어야 하는지, 실행만 오프라인이면 되는지
- SQLite 파일과 백업의 기본 경로
- 백업 암호화와 앱 잠금 필요 여부

## 승인 프로필로 해결된 항목

- 담당상태와 상담 결과는 선택 자유입력으로 시작하며 enum을 고정하지 않는다.
- Coverage Benchmark는 카테고리·정확히 같은 자유입력 성별·포함 만 나이 구간별 적정하한과 과다하한을 사용한다. 겹치는 활성 구간은 거부하고 일치 기준이 없으면 부족으로 간주하지 않는다.
- Benchmark 판정은 `< 적정하한` 부족, `적정하한 ≤ 금액 < 과다하한` 적정, `≥ 과다하한` 과다이며 권고금액 seed나 우선순위를 만들지 않는다.
- 최근 상담은 최근 30일, 미상담은 90일 이상 상담이 없었던 관리대상 Customer로 계산한다. soft-deleted Customer는 제외하며 Dashboard에서 요청 시 계산한다.
- Customer를 soft delete하면 연결 계약·상담 원본은 유지하되 기본 조회·집계·Dashboard·Calendar·export에서 숨긴다. Customer 복원 시 개별 soft delete되지 않은 자식만 다시 노출한다.
- 상령은 생일에서 6개월 뒤 local date부터 증가하며 존재하지 않는 날짜는 월말로 clamp한다. Dashboard는 명시적 기준일·IANA local timezone으로 다음 상령일을 계산하고 저장하지 않는다.
- Dashboard는 관리대상 Customer 기반 7개 read card와 기존 Family summary 기반 1개 card를 각각 최대 10건 표시한다. 오늘 연락은 최신 상담의 연락일, 최근 상담은 오늘 포함 30일, 미상담은 exact 90일 이상 또는 상담 없음으로 계산한다.
- 상령·만기 bucket은 0–30, 31–60, 61–90일이고 날짜·금액·부족 Category 수 우선 뒤 이름·stable id로 동점을 정렬한다.
- Calendar는 모든 활성 Customer의 상담일·다음 연락일·상령일·만기일과 사용자 일정을 월 보기로 제공한다. 상담 한 건의 상담일과 다음 연락일은 각각 보존한다.
- 사용자 일정은 제목과 Calendar에서 접근 가능한 `9998-12-31` 이하 날짜 필수, 분 단위 local 시간·메모·활성 고객 연결 선택, 완료 boolean이다. 완료 일정도 표시하며 삭제는 soft delete다.
- Calendar의 주·일 보기, 반복·우선순위·drag and drop은 후속 범위이고 새 달력 UI library는 사용하지 않는다.
- 계약 가져오기는 G/H/J/K/N/R/T를 Policy에 mapping하고 21열 text/null을 이름 있는 1:1 source로 보존한다. 계약자·피보험자는 참고만 하며 Customer를 자동 병합하지 않는다.
- 보험사+증권번호 duplicate는 trim+NFC·case-sensitive로 비교한다. 기본 skip, exact update와 separate-create를 명시 선택하며 선택한 유효 행 전체를 한 transaction으로 반영한다.
- `.xlsx`는 Rust native dialog와 엄격한 sheet/header/string cell 계약, `.csv`는 UTF-8 BOM·CRLF·RFC 4180의 같은 21열 계약을 사용한다.

위 결정은 `docs/product/proposed-operating-profile.md`의 승인 상태와 공통 데이터·Customer/Consultation·Dashboard·Calendar 규칙을 근거로 한다.
