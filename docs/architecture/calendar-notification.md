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
| Schedule | 승인될 일정 날짜/시간 | 사용자 스케줄 |

상령일은 저장된 값으로 단정하지 않는다. 승인된 산식과 기준일을 사용하는 service 계산 결과여야 한다.

Consultation 원본 CRUD와 두 날짜 source의 저장 계약은 구현되어 있다. 이를 합치는 Calendar event, 오늘 연락·최근 상담·미상담 판정과 같은 Customer의 여러 대상 grouping은 후속 Dashboard·Calendar 계획 범위다.

## 계산 경계

- 입력: 명시적 기준일, local timezone, 활성 record 목록
- 출력: event type, 날짜, 관련 entity id, 사용자 표시용 최소 정보
- UI는 날짜 차이 또는 대상 판정을 다시 계산하지 않는다.
- 30/60/90 구간의 포함·중복 규칙은 구현 계획에서 승인한다.
- 날짜가 없는 레코드는 대상에서 제외하되 data-quality 경고 여부를 결정한다.

## 달력 read model

달력은 계약·상담 원본을 복제하지 않는다. 각 feature의 application query에서 표준 CalendarEvent DTO로 변환한다.

필수 후보 필드는 event id, event type, date, related entity id 정도다. 제목, 색, 시간, 완료 상태는 UI·일정 요구 확정 후 추가한다.

## Notification

- 별도 서버와 background push를 사용하지 않는다.
- 앱 시작 시 한 번 계산한다.
- 같은 고객이 여러 대상에 속할 때 grouping 방식은 미정이다.
- notification 상태를 영구 저장할지 매번 계산할지 성능과 UX를 근거로 결정한다.

## UI 범위 미결정

- 월 보기만 제공할지 주·일 보기도 제공할지
- 일정 생성·수정·완료·반복
- drag and drop
- 색상과 우선순위
- 고객/계약 상세 화면으로 이동하는 동작
- keyboard 접근성과 Windows 기본 shortcut

dayjs는 날짜 계산 도구이며 달력 UI를 제공하지 않는다. 달력 component 선택은 별도 승인 대상이다.

## QA 기준

- 고정된 clock으로 경계 날짜 테스트
- 월말, 연말, 윤년, 2월 29일 test case
- 과거 날짜와 null 날짜
- 30/60/90 경계 전후
- timezone 변경 전후 동일 date-only 의미
- soft-deleted 고객·계약·상담 제외 규칙
