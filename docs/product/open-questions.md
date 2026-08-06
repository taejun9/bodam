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

- 첨부 파일 헤더와 내부 도메인 필드의 최종 매핑
- 계약을 식별하는 키와 재업로드 시 중복 처리
- 빈 셀, 수식 셀, 잘못된 날짜·금액의 처리
- 업로드를 전체 성공/실패로 할지 정상 행만 반영할지 여부
- 동일 양식 export가 값·헤더·열 순서만 의미하는지, 열 너비·색·병합·인쇄 설정까지 의미하는지
- 사용할 Excel 라이브러리와 Tauri 실행 경계

## Calendar / Notification

- 월 보기만 필요한지, 주·일 보기도 필요한지
- 사용자 일정의 필드, 반복, 완료, 우선순위, 고객 연결 여부
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

위 결정은 `docs/product/proposed-operating-profile.md`의 승인 상태와 공통 데이터·Customer/Consultation·Dashboard 규칙을 근거로 한다.
