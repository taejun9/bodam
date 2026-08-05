# 데이터 모델 원칙

## 상태

이 문서는 개념 모델과 불변 규칙만 정의한다. Prisma schema, column type, enum, index와 migration은 SQLite 구성 계획에서 승인한다.

## 개념 관계

    Family
      ↔ FamilyMember ↔ Customer
                         ├─ InsurancePolicy ─ Coverage
                         ├─ Consultation
                         └─ ScheduleLink 후보

    CoverageCategory ─ Coverage
    CoverageBenchmark ─ CoverageCategory

FamilyMember와 ScheduleLink는 관계를 설명하기 위한 후보 이름이다. 실제 model 이름과 필드는 구현 계획에서 결정한다.

## Entity 책임

### Customer

사용자가 명시한 고객 필드와 담당상태를 소유한다. 보험·상담·가족 관계의 기준 entity다.

### Family

가족 단위 grouping을 소유한다. 가족 보험료는 저장된 숫자가 아니라 활성 구성원의 활성 계약에서 계산하는 read model을 기본 후보로 한다. cache 여부는 성능 증거가 있을 때 결정한다.

### InsurancePolicy

고객의 보험계약 정보를 소유한다. 보험료와 기간의 단위, 갱신 상세는 아직 확정하지 않는다.

### CoverageCategory / Coverage

CoverageCategory는 표준 카테고리를, Coverage는 계약별 보장금액을 표현한다. 고객별 합계는 활성 계약과 활성 보장만 대상으로 계산하는 후보이며 soft delete/계약 상태의 정확한 규칙은 별도 승인한다.

### CoverageBenchmark

연령대·성별·카테고리별 기준과 판정 구간을 표현한다. 겹치는 rule 방지와 우선순위가 필요하지만 현재는 미정이다.

### Consultation

상담일, 내용, 다음 연락일, 결과를 소유한다. calendar와 dashboard는 read model로 참조한다.

### Schedule

사용자가 날짜·스케줄 표시를 요청했으므로 개념상 필요하다. 제목, 시간, 반복, 완료, 고객 연결 등 상세 필드는 승인 전 정의하지 않는다.

## 관계와 Foreign Key

- 업무 관계는 가능한 한 DB Foreign Key로 보호한다.
- relation의 onDelete 동작을 Prisma schema에 명시한다.
- soft delete가 기본이므로 cascade hard delete를 업무 삭제 흐름으로 사용하지 않는다.
- orphan 허용 여부는 관계별 계획에서 결정한다.
- 조회는 기본적으로 deletedAt이 null인 행만 사용한다.

## Soft Delete

- 삭제 가능한 업무 table은 deletedAt nullable column을 갖는다.
- delete use case는 deletedAt을 기록한다.
- 복원은 연결 관계와 unique 제약 충돌을 검증한다.
- unique 값 재사용, cascade 복원, 보관 기간은 별도 규칙이 필요하다.
- migration metadata처럼 업무 데이터가 아닌 내부 table의 처리까지 무조건 동일하게 만들지 않는다.

## 이식성

- product service에서 SQLite 전용 SQL 또는 pragma에 의존하지 않는다.
- DB 고유 최적화가 필요하면 adapter에 격리하고 계획 Decision Log에 기록한다.
- 날짜를 locale 문자열로 저장하지 않는다.
- 금액은 부동소수점으로 계산하지 않는다. 저장 단위와 Prisma type은 schema 계획에서 확정한다.
- provider가 바뀌면 migration history와 데이터 이전 절차가 새로 필요함을 전제로 한다.

## 날짜와 시간

- 생년월일, 가입일, 만기일처럼 날짜 의미만 있는 값과 상담 시각처럼 시간 의미가 있는 값을 구분한다.
- DB 저장 방식, UTC 변환 여부, Windows local timezone 경계는 날짜 규칙 계획에서 승인한다.
- 동일 기준일을 service에 주입해 dashboard, calendar, notification 계산이 재현 가능해야 한다.

## Index 후보

아래는 쿼리 요구에서 검증할 후보일 뿐 plan-001에서 확정하지 않는다.

- Customer deletedAt / 담당상태
- InsurancePolicy customer FK / 만기일 / deletedAt
- Consultation customer FK / 상담일 / 다음 연락일 / deletedAt
- FamilyMember family FK / customer FK / deletedAt
- Coverage policy FK / category FK / deletedAt
- CoverageBenchmark 성별 / 연령구간 / category FK / deletedAt

실제 query plan과 데이터 규모를 확인한 뒤 migration에 반영한다.
