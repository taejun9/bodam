# 달력과 알림 계약

## 목적

서로 다른 날짜 데이터를 한 달력에서 확인하고, 앱 시작 시 연락·상령·만기 대상을 로컬에서 계산한다.

## 날짜 source

| source | 날짜 | 표시 목적 |
|---|---|---|
| Customer | 생년월일에서 계산된 상령일 | 상령 예정 |
| InsurancePolicy | 만기일 | 30/60/90일 만기 예정 |
| Consultation | `consultedAt` UTC timestamp를 OS local 날짜·시간으로 표시 | 상담 이력 |
| Consultation | `nextContactOn` date-only | 오늘 연락 및 예정 연락 |
| Schedule | `scheduledOn` date-only와 선택 local `HH:mm` | 사용자 일정 |

상령일은 저장된 값으로 단정하지 않는다. 승인된 산식과 기준일을 사용하는 service 계산 결과여야 한다.

Consultation과 Schedule 원본 CRUD가 구현되어 있다. Dashboard는 오늘 연락·상령·만기·최근 상담·미상담을, Calendar는 같은 source의 월별 날짜 event를 요청 시 read model로 조합한다. 두 read model 모두 원본이나 계산 결과를 복제·저장하지 않는다.

## 계산 경계

- 입력: 명시적 `YYYY-MM` 월, IANA local timezone, 활성 record 목록
- Calendar가 지원하는 view 월은 `0001-01`부터 `9998-12`까지다. 이 범위는 월의 배타적 끝과 상령일 계산도 유효한 `0001-01-01`–`9999-12-31` 안에 두기 위한 UI 경계다.
- 출력: event type, 날짜, 관련 entity id, 사용자 표시용 최소 정보
- UI는 날짜 차이 또는 대상 판정을 다시 계산하지 않는다.
- Dashboard의 상령·만기는 0–30, 31–60, 61–90일의 비중복 구간을 사용한다. Calendar의 날짜별 표시는 bucket을 저장하지 않는다.
- Consultation `consultedAt`만 UTC instant를 조회 timezone의 local 날짜·분으로 변환한다. 다음 연락일·만기일·Schedule 날짜/시간은 timezone 변경으로 이동시키지 않는다.
- 모든 활성 Customer를 포함하며 Dashboard의 `isManaged=true` 필터와 최신 상담 supersede 규칙을 Calendar로 확장하지 않는다.
- soft-deleted Customer와 그 Policy·Consultation·linked Schedule은 숨기고 unlinked Schedule은 유지한다.
- 날짜가 없는 레코드는 event를 만들지 않는다.

## 달력 read model

달력은 계약·상담 원본을 복제하지 않는다. Customer·Insurance·Consultation·Schedule feature의 공개 application query를 표준 `CalendarEvent` DTO로 변환한다.

event kind는 상담, 다음 연락, 상령, 계약 만기, 사용자 일정 5종이다. DTO는 stable event id, kind, date, 선택 시간, 제목·사유, 관련 Customer/source id와 Schedule 완료 상태의 표시 최소값을 가진다. 상담 내용·결과는 복제하지 않는다.

stable id는 `consultation:<id>:consulted`, `consultation:<id>:next-contact`, `customer:<id>:insurance-age:<date>`, `policy:<id>:maturity`, `schedule:<id>`다. 날짜, all-day 우선, 시간, kind code, 제목 code-unit, event id 순으로 정렬하고 월의 모든 날짜를 이미 grouping한 read model을 UI에 반환한다.

### Schedule 원본

- 제목 1–200자와 실제 날짜는 필수이며 일정일은 Calendar view에서 계속 접근 가능한 `9998-12-31` 이하다.
- 분 정밀도 local `HH:mm`, 메모 최대 4,000자, 활성 Customer 연결은 선택이다.
- 완료 여부는 boolean이고 완료 event도 숨기지 않는다.
- Customer 연결 변경·해제를 허용하고 중복 일정을 자동 병합하지 않는다.
- 삭제는 `deletedAt` soft delete이며 별도 복원 UI는 없다.
- Browser preview에서는 Customer와 Schedule mutation이 같은 origin lock을 사용해 활성 부모 검사와 Customer soft delete를 직렬화한다.
- Rust에서는 linked Schedule의 부모 검사, mutation, 반환 row materialization을 하나의 `BEGIN IMMEDIATE` transaction에서 수행해 성공했지만 실패로 보고되는 경쟁을 막는다.

## Notification

- 별도 서버와 background push를 사용하지 않는다.
- 앱 시작 시 한 번 계산한다.
- 같은 고객이 여러 대상에 속할 때 grouping 방식은 미정이다.
- notification 상태를 영구 저장할지 매번 계산할지 성능과 UX를 근거로 결정한다.

## 월 UI

- 일요일 시작 7열 월 grid와 선택일 agenda를 제공한다. grid 안에 요일 header row와 6개 week row, 각 row의 7개 gridcell을 두고 선택 상태는 gridcell에 표시한다.
- 선택 날짜 button 하나만 roving tab stop이고 cell event action은 tab 순서에서 제외한다. 같은 날짜의 source link와 일정 edit·완료·삭제 keyboard 동작은 agenda에서 제공한다.
- 이전·다음·오늘, URL의 월·선택일 복원, 일정 생성·수정·완료/되돌리기·삭제를 제공한다.
- URL view는 `0001-01`–`9998-12`만 지원한다. 범위 밖 값은 현재 local 월·일로 canonical replace하고, 경계의 이전·다음 이동은 disabled/no-op 처리한다.
- source event와 연결 고객은 현재 존재하는 Customer 상세 route로 이동한다.
- 390px에서는 날짜와 event count를 유지하고 전체 제목·사유·동작은 agenda에서 제공한다.
- 날짜 button은 화살표·Home·End·PageUp·PageDown keyboard 이동을 제공한다.

새 달력 UI library는 사용하지 않는다. 주·일 보기, 반복, 우선순위, drag and drop과 색상 사용자 설정은 후속 범위다.

## QA 기준

- 고정된 clock으로 경계 날짜 테스트
- 월말, 연말, 윤년, 2월 29일 test case
- 과거 날짜와 null 날짜
- KST·DST timezone의 UTC 상담 월 경계와 date-only·local wall time 불변
- stable id와 날짜·all-day·시간·kind·제목·id 동점 정렬
- 비관리 Customer, excluded Policy 만기, 상담별 두 event
- soft-deleted 고객·계약·상담·일정과 linked/unlinked visibility
- Browser CRUD·reload·390px·dark/light와 release 앱 두 프로세스 persistence
