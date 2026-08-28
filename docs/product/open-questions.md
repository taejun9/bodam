# 구현 전 확인할 질문

아래 항목은 요구사항 누락이 아니라 의도적으로 미결정 상태다. 관련 구현 계획에서 사용자 승인 없이 답을 추측하지 않는다.

## 도메인 규칙

- 갱신 계약의 갱신 주기와 다음 갱신일 관리 여부

## Excel / CSV

- source 없는 수동 계약의 21열을 향후 합성할지와 미매핑 열을 어떤 값으로 채울지
- import 뒤 사용자가 수정한 domain/source 충돌에 source 반영, domain 우선 또는 충돌 해결 UI 중 무엇을 제공할지
- 전체 export 외 고객·기간·계약 선택 filter와 사용자 지정 정렬이 필요한지

## Notification

- 30/60/90일 구간의 중복 노출 방식
- 앱을 여러 날 실행하지 않았을 때 시작 계산과 하루 1회 계산의 기준
- 오늘의 경계와 Windows 로컬 시간대 변경 처리

## Google Calendar 연동

- BODAM 전용 Google 보조 캘린더를 만들지, 사용자의 기존 캘린더를 선택할지
- BODAM→Google 단방향, Google→BODAM 단방향 또는 양방향 중 어떤 동기화가 필요한지
- 사용자 일정만 전송할지, 상담일·다음 연락일·상령일·만기일까지 포함할지
- 고객 이름·일정 제목·메모 중 Google에 전송할 수 있는 최소 필드
- 수동 동기화만 제공할지, 앱 시작·일정 변경 때 자동 동기화할지
- 중복·수정 충돌·삭제·연결 해제와 Google 반복 일정의 처리 규칙
- 개인/소수 사용자용 Testing 운영인지 외부 배포와 OAuth 검증까지 필요한지

## Desktop / Database

- removable·network filesystem을 custom backup 위치로 쓸 때 platform별 atomicity와 운영 지원 범위
- 자동 backup 파일을 앱 안에서 열람·개별 삭제·복사할 관리 UI 필요 여부
- 향후 backup 암호화, recovery key와 앱 잠금 필요 여부

## 승인 프로필로 해결된 항목

- 보험기간·납입기간은 `종신`을 포함할 수 있는 원문 text로 저장한다. 근거: [권장 기본 운영 프로필 5절](proposed-operating-profile.md)
- 월 보험료는 계약서에서 확인한 총 월납입액 한 개를 KRW 정수로 저장하고 특약별 breakdown은 별도 저장하지 않는다. 근거: [권장 기본 운영 프로필 5절](proposed-operating-profile.md)
- Policy는 Coverage 없이 생성할 수 있지만 각 Coverage는 Policy와 카테고리를 필수로 하고 금액은 KRW 정수로 저장한다. 같은 고객·카테고리의 여러 활성 Coverage 금액은 합산한다. 근거: [권장 기본 운영 프로필 5–6절](proposed-operating-profile.md)
- Prisma schema와 migration history를 schema artifact의 단일 source로 유지하고, 설치 앱 runtime은 Node sidecar 없이 Tauri Rust adapter가 SQLite에 접근한다. 근거: [ADR-001 Prisma와 Tauri 런타임 경계](../architecture/decisions/adr-001-prisma-tauri-runtime.md)
- Windows x64 NSIS는 WebView2 `offlineInstaller`를 포함해 설치와 핵심 실행 모두 offline을 목표로 한다. Hosted Windows CI는 설치된 앱 경로와 기능을 검증하지만, WebView2가 없는 network-blocked clean VM의 installer bootstrap·wizard를 대신 증명하지 않는다.
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
- export는 active Customer의 active Policy 중 보존 source와 G/H/J/K/N/R/T mapping이 정확히 같은 행만 포함한다. 수동·충돌 행은 값을 만들거나 우선하지 않고 별도 제외 건수로 표시한다.
- export는 계약일자 blank-last, Customer 이름, Policy id 순으로 정렬하며 XLSX의 열 너비·행 높이·border까지 재현하고 인쇄·페이지 설정은 제외한다.
- native save cancel은 무변경이고 덮어쓰기는 사용자가 저장 dialog에서 승인한다. 결과에는 basename과 건수만 표시한다.
- CSV formula trigger는 원문을 변형하지 않고 전체 CSV 저장을 거부하며 XLSX 사용을 안내한다.
- SQLite는 Tauri app-data, 자동 backup은 기본 `backups` 하위 폴더에 저장하고 native dialog로 custom local 폴더를 선택할 수 있다.
- backup은 SQLite online snapshot과 schema/app/timestamp/SHA-256 manifest를 사용한다. 시작·resume·local date 변경의 daily와 변경된 정상 종료 backup을 만들고 검증된 자동 최근 30개만 보관한다.
- 수동·복원 전 안전 사본은 자동 retention에서 제외한다. restore는 대상과 현재 DB 안전 사본을 검증하고 실패 시 현재 DB를 보존하며 성공 후 재시작한다.
- 종료 backup 실패는 재시도 또는 경고 후 종료를 선택한다. MVP backup은 암호화하지 않고 OS 계정·디스크 보호에 의존한다.
- Settings의 Dashboard 기간은 최근 상담·미상담 기준만 조절하고 예정 bucket은 고정한다. 카드 표시 건수는 전체 카드 공통 1–10이다.

위 결정은 [권장 기본 운영 프로필](proposed-operating-profile.md)의 승인 상태와 공통 데이터·Customer/Consultation·Dashboard·Calendar 규칙 및 [ADR-001](../architecture/decisions/adr-001-prisma-tauri-runtime.md)을 근거로 한다.
