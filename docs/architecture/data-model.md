# 데이터 모델 원칙

## 상태

이 문서는 개념 모델과 불변 규칙을 정의한다. Customer, InsurancePolicy, CoverageCategory, Coverage, Family와 FamilyMembership의 실제 Prisma schema·index·migration은 plan-002부터 plan-005에서 승인·구현했다. 나머지 entity는 후속 계획에서 확정한다.

## 개념 관계

    Family
      ↔ FamilyMembership ↔ Customer
                             ├─ InsurancePolicy ─ Coverage
                             ├─ Consultation
                             └─ ScheduleLink 후보

    CoverageCategory ─ Coverage
    CoverageBenchmark ─ CoverageCategory

ScheduleLink는 관계를 설명하기 위한 후보 이름이다. 실제 model 이름과 필드는 구현 계획에서 결정한다.

## Entity 책임

### Customer

사용자가 명시한 고객 필드와 담당상태를 소유한다. 보험·상담·가족 관계의 기준 entity다.

### Family

Family는 `id`, `name`, `createdAt`, `updatedAt`, `deletedAt`을 가진 가족 단위 grouping이다. 이름은 trim 후 1–100자이며 중복 이름을 금지하거나 이름만으로 병합하지 않는다.

FamilyMembership은 `id`, `familyId`, `customerId`, 선택 `relationshipName`, timestamps와 `deletedAt`을 가진 다대다 관계다. 관계명은 trim 후 빈 값을 null로 저장하고 값이 있으면 1–100자 단순 표시 label이며 법적 관계·방향성·대표자 의미를 추론하지 않는다. 같은 Family·Customer 쌍은 삭제 이력을 포함해 하나만 두고, 제거된 쌍을 사용자가 다시 추가하면 기존 행을 명시적으로 재활성화한다.

가족 보험료는 저장된 숫자나 cache가 아니라 활성 Family·membership·Customer와 활성 `isIncluded=true` Policy의 월보험료를 요청 시 `bigint`로 계산하는 read model이다. `Customer.isManaged`와 자유 입력 status는 제외 조건이 아니다. 같은 Customer가 여러 Family에 속하면 각 Family에서 한 번씩 계산하지만 Family 전체를 다시 합친 합계는 만들지 않는다.

### InsurancePolicy

고객의 보험계약 정보를 소유한다. customer, 보험사, 상품명, 월보험료는 필수이며 가입일·만기일, 보험기간·납입기간 원문, 고지플랜, 계약 상태는 선택이다. 월보험료는 KRW 원 단위 정수이고, 갱신 여부와 합계대상 여부는 boolean이다. 갱신주기와 특약별 보험료는 MVP 범위에 두지 않는다.

### CoverageCategory / Coverage

CoverageCategory는 모든 고객에게 공통인 표준 카테고리다. `id`, `name`, `createdAt`, `updatedAt`, `deletedAt`을 소유한다. 이름은 trim 후 1–100자이며 중복 이름을 금지하거나 이름만으로 병합하지 않는다. 최초 migration은 암, 유사암, 뇌혈관, 심혈관, 질병수술, 상해수술, 후유장해, 입원, 간병, 운전자 10개를 한 번만 생성한다. 현재는 이름 변경과 soft delete만 제공하며 신규 생성·복원·자동 reseed는 제공하지 않는다.

Coverage는 InsurancePolicy 하나와 CoverageCategory 하나에 연결된 계약별 가입금액이다. `id`, `policyId`, `categoryId`, `amountWon`, `createdAt`, `updatedAt`, `deletedAt`을 소유한다. 같은 Policy·Category 또는 Customer·Category에 여러 행을 허용하고, 생성 뒤 `policyId`는 update로 옮기지 않는다. 개별 금액은 0부터 SQLite signed 64-bit 정수 최대값까지의 KRW 원 단위 정수다.

관리 목록은 활성 Customer·InsurancePolicy·CoverageCategory·Coverage를 대상으로 하며 `InsurancePolicy.isIncluded=false`인 보장도 편집할 수 있다. 고객별 보장 합계는 활성 행 중 `isIncluded=true`인 Policy의 Coverage만 Category ID별로 합산한다. 이름이 같은 Category도 ID가 다르면 별도 행이며, `Customer.isManaged`와 자유 입력 Policy status는 제외 조건이 아니다. 합계는 TypeScript `bigint` 순수 service가 요청 시 계산하고 DB에 저장하지 않으므로 여러 개별 금액의 합이 signed 64-bit 범위를 넘어도 손실되지 않는다.

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
- Customer와 InsurancePolicy FK는 hard delete `RESTRICT`이며 부모 soft delete 시 자식 원본을 유지하고 기본 조회·집계에서 숨긴다.
- Coverage의 Policy·Category FK도 hard delete `RESTRICT`, key update `CASCADE`다. 부모 Customer·Policy·Category가 soft delete되면 Coverage 원본은 유지하되 기본 관리 목록과 합계에서 숨긴다.
- Coverage에는 Policy·Category 조합 unique 제약이 없으므로 동일 조합의 여러 행을 모두 보존한다.
- FamilyMembership의 Family·Customer FK는 hard delete `RESTRICT`, key update `CASCADE`이며 `(familyId, customerId)`는 unique다.
- Family 또는 Customer를 soft delete하면 membership 원본은 유지하고 구성원 목록·가족 보험료에서 숨긴다.

## Soft Delete

- 삭제 가능한 업무 table은 deletedAt nullable column을 갖는다.
- delete use case는 deletedAt을 기록한다.
- 복원은 연결 관계와 unique 제약 충돌을 검증한다.
- unique 값 재사용, cascade 복원, 보관 기간은 별도 규칙이 필요하다.
- migration metadata처럼 업무 데이터가 아닌 내부 table의 처리까지 무조건 동일하게 만들지 않는다.
- CoverageCategory를 soft delete하면 연결 Coverage 행은 함께 수정하지 않고 숨긴다. 현재 Category와 연결 Coverage의 복원 UI는 없다.
- Family를 soft delete하면 membership 행은 함께 수정하지 않는다. Membership을 제거한 뒤 같은 Customer를 명시적으로 재추가하는 흐름만 기존 행을 재활성화한다.

## 이식성

- product service에서 SQLite 전용 SQL 또는 pragma에 의존하지 않는다.
- DB 고유 최적화가 필요하면 adapter에 격리하고 계획 Decision Log에 기록한다.
- 날짜를 locale 문자열로 저장하지 않는다.
- 금액은 부동소수점으로 계산하지 않는다. InsurancePolicy 월보험료와 Coverage 가입금액은 Prisma `BigInt`, SQLite `INTEGER`, IPC decimal string, TypeScript `bigint`를 사용한다.
- provider가 바뀌면 migration history와 데이터 이전 절차가 새로 필요함을 전제로 한다.

## 날짜와 시간

- 생년월일, 가입일, 만기일처럼 날짜 의미만 있는 값과 상담 시각처럼 시간 의미가 있는 값을 구분한다.
- DB 저장 방식, UTC 변환 여부, Windows local timezone 경계는 날짜 규칙 계획에서 승인한다.
- 동일 기준일을 service에 주입해 dashboard, calendar, notification 계산이 재현 가능해야 한다.

## Index

현재 migration은 Customer의 삭제·이름·상태·담당 여부, InsurancePolicy의 customer FK·만기일, CoverageCategory의 삭제·이름 조회를 위한 index를 갖는다. Coverage는 `(policyId, deletedAt)`과 `(categoryId, deletedAt)` 복합 index로 계약별 관리 목록과 활성 카테고리별 조회를 지원한다. Family는 삭제·이름 조회 index를 가지며 FamilyMembership은 Family·Customer별 active 조회 index와 pair unique로 구성원 조회와 중복 방지를 지원한다.

Consultation과 CoverageBenchmark의 index는 entity와 query가 승인될 때 실제 query plan과 데이터 규모를 확인해 결정한다.
