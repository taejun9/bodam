# ADR-001 Prisma와 Tauri 런타임 경계

## Status

proposed

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

미결정. plan-002 또는 별도 architecture spike에서 최소 CRUD, migration, Windows packaging, offline 실행을 비교한 뒤 사용자가 승인한다.

## Evidence Needed

- 공식 지원 runtime과 packaging 근거
- 최소 prototype의 build 결과와 용량
- startup/CRUD/backup failure mode
- migration 단일 source 유지 여부
- 개발·배포 명령과 Windows prerequisites
