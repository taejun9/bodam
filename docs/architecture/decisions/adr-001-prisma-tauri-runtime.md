# ADR-001 Prisma와 Tauri 런타임 경계

## Status

accepted — 2026-08-06, plan-002

## Context

사용자는 SQLite, Prisma Migration, Tauri를 지정했다. Prisma Client의 공식 실행 runtime과 Tauri의 기본 Rust core/WebView 구조 사이에 실행 경계를 선택해야 한다. plan-001에서는 이 결정을 추측하지 않는다.

## Required Outcomes

- Windows에서 설치와 실행이 재현 가능
- 인터넷 없이 CRUD, import/export, dashboard, backup 동작
- Prisma Migration을 schema 변경의 단일 source로 유지
- 최소 권한 IPC와 파일 접근
- 오류·로그에 고객 데이터가 노출되지 않음
- 향후 PostgreSQL 이전을 막는 service 결합 최소화

## Option A: Node sidecar에서 Prisma Client 실행

장점:

- Prisma Client와 schema/migration 사용 방식이 직접적이다.
- TypeScript 중심 repository 구현이 가능하다.

검증할 비용:

- Node app을 self-contained sidecar로 패키징
- Tauri IPC, process lifecycle, 포트 또는 stdio 보안
- Windows installer 크기와 antivirus/서명 영향
- sidecar crash 및 upgrade 복구

## Option B: Prisma는 schema/migration에 사용하고 Rust에서 runtime DB 접근

장점:

- Tauri core 안에서 로컬 DB 접근을 유지할 수 있다.
- 별도 Node process가 없다.

검증할 비용:

- Prisma schema와 Rust query model의 중복 및 drift
- migration과 runtime adapter의 호환성
- 사용자가 ORM으로 Prisma를 지정한 의도와의 일치 여부

## Option C: ORM 또는 desktop runtime 구성 재선정

사용자가 명시한 스택을 바꾸므로 기술적 blocker가 입증되고 사용자가 승인한 경우에만 검토한다.

## Decision

Option B를 채택한다.

- `schema.prisma`와 Prisma가 생성한 전체 migration SQL history를 schema artifact의 단일 source로 둔다.
- 개발 시 `prisma migrate dev --create-only`로 migration을 만들고 검토한 뒤 커밋한다.
- 설치 앱은 Node sidecar 없이 Tauri Rust adapter에서 SQLite를 연다.
- Rust migration runner는 SQL을 복사하지 않고 Prisma migration file을 `include_str!`로 포함한다.
- Rust executor와 그 history가 Prisma Migrate executor 또는 `_prisma_migrations`와 같다고 주장하지 않는다.
- generic SQL guest API 대신 Zod로 검증된 feature application 입력을 좁은 custom command로 전달한다.
- DB 기능에는 shell, process, network, broad filesystem capability를 허용하지 않는다.

이 결정은 사용자가 실사용 가능한 전체 MVP 구현을 위임한 요청과 plan-002의 versioned 운영 프로필을 승인 근거로 한다.

## Verification

- Prisma schema와 migration history의 diff가 없어야 한다.
- Rust runner가 clean DB에 적용한 결과와 Prisma schema의 diff가 없어야 한다.
- migration directory와 Rust 등록 목록이 1:1이고 적용된 SQL checksum이 변경되지 않아야 한다.
- clean DB, 기존 합성 fixture DB, 실패 migration rollback을 테스트한다.
- Customer CRUD와 재실행 persistence를 실제 Tauri 앱에서 확인한다.

## Consequences

장점:

- 별도 Node process, port/socket/stdin protocol과 shell execute capability가 없다.
- Windows installer에 target별 Node/Prisma sidecar binary를 추가하지 않는다.
- DB command를 feature use case 수준으로 제한할 수 있다.

비용과 잔여 위험:

- Prisma Client의 type-safe query를 runtime에 사용하지 않는다.
- Prisma schema, migration SQL, Rust DTO/query 사이 drift를 CI와 integration test로 막아야 한다.
- Prisma artifact source와 Rust executor history가 분리된다.
- 향후 Prisma Migrate executor 자체가 설치 앱에 반드시 필요해지면 Option A를 새 ADR로 재검토한다.

## Evidence Needed

- 공식 지원 runtime과 packaging 근거
- 최소 prototype의 build 결과와 용량
- startup/CRUD/backup failure mode
- migration 단일 source 유지 여부
- 개발·배포 명령과 Windows prerequisites
