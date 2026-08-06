# plan-007-coverage-benchmark Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-007-coverage-benchmark.md`
- reviewed tree: `codex/plan-007-coverage-benchmark` worktree before commit
- baseline: main `49516d5`
- reviewer roles: 독립 데이터 정합성 `review_judge`, UI·접근성 reviewer, `privacy_guard`
- review order: 전체 QA PASS와 durable evidence 기록 뒤 세 읽기 전용 리뷰, finding 수정 뒤 데이터·UI 재리뷰
- reviewed_at: 2026-08-06 KST

## QA Evidence

- 수정 후 최종 `npm run qa`: PASS — Vitest 31 files / 134 tests, Rust 93 tests, Prisma validate/diff, migration registry, Vite build, cargo check와 harness 포함
- `cargo test --all-features`: 93/93 PASS; rustfmt와 all-targets/all-features clippy `-D warnings` PASS
- v6 migration SHA-256 `dac0ecb65e3f9e52270b6320af3e91bf0d83539cc78e716019ca55d18c906130`; v5 upgrade 보존·history/runtime schema/index/FK drift PASS
- `npm audit --audit-level=high`: 취약점 0건; `git diff --check`, line/privacy/artifact scan PASS
- in-app Browser: Benchmark 생성·수정·reload·삭제와 기준 미설정→적정→과다→부족, inclusive overlap 거부 PASS
- Browser 접근성: autofocus, 첫 오류 focus, Escape·호출 버튼 복귀와 공식 권고 아님 안내 PASS
- 390×844 dark mode: table→card, body/card/dialog overflow 0, 70자 무공백 Category 3줄 전체 wrapping, 삭제 Category/Benchmark ID와 console warning/error 0건 확인
- release macOS 앱: 첫 프로세스 write 4/4 PASS(23.4s), 새 프로세스 persistence 2/2 PASS(12.2s)
- 실제 Tauri IPC·SQLite에서 Benchmark ID·threshold·classification·reload/restart·soft delete를 검증
- 표준 `BODAM.app` 재빌드 뒤 production binary·app·dist·default feature tree에서 E2E DB override, WDIO/WebDriver와 4445 표식 0건
- 합성 Browser data는 UI로 soft delete했고 E2E temp SQLite와 WebDriver log를 제거했다.

## Findings

| severity | finding | resolution |
|---|---|---|
| P2 | Browser Benchmark lock이 repository 인스턴스에만 있어 다중 repository/tab과 Category 삭제 사이 localStorage RMW가 원자적이지 않음 | 고정 origin Web Lock과 storage identity queue를 Category update/delete 및 Benchmark list/CRUD에 공용 적용하고 경합 회귀 추가 |
| P2 | TS와 Rust gender trim·Unicode scalar 동작이 FEFF/U+0085·lone surrogate에서 불일치 | ECMAScript trim 집합과 surrogate 거부를 양 경계·Customer.gender에 통일하고 공통 벡터 회귀 추가 |
| P2 | 삭제 확인이 중복 Category 이름에서 stable ID를 보여 주지 않음 | Category ID와 Benchmark ID를 확인창에 표시하고 중복 이름 테스트 추가 |
| P3 | Benchmark E2E helper가 mobile card를 인식하지 못하고 삭제 0건을 거짓 통과할 수 있음 | row/card stable ID dedupe와 모든 representation DOM 0건 검사를 적용 |
| P3 | 고객 판정의 긴 Category 이름이 nowrap ellipsis로 잘림 | `overflow-wrap: anywhere` 전체 표시와 unit·실제 390px 회귀 추가 |

수정 후 독립 데이터, UI·접근성 재리뷰와 privacy·capability 리뷰에서 신규 또는 미해결 P0–P3 actionable finding이 없음을 확인했다.

## Requirements Trace

- 저장 계약: Category FK, exact gender, 포함 0–150세, signed i64 KRW threshold와 timestamp·soft delete
- 입력 계약: 필수 strict payload, canonical UUID/decimal/UTC, Unicode scalar 100자, `0 ≤ adequate < excessive`
- 중복 계약: 같은 활성 Category·gender의 포함 나이 구간 overlap을 native IMMEDIATE transaction과 Browser origin lock 안에서 거부
- 조회 계약: 활성 Category의 활성 Benchmark만 `categoryId, minAgeYears, maxAgeYears, id` 안정 정렬
- 판정 계약: OS-local referenceDate 만나이와 2월 29일 clamp, exact gender, bigint 부족·적정·과다와 기준 미설정
- 합집합 계약: Coverage summary Category와 matching Benchmark Category의 합집합이며 보장 0건도 0원으로 판정
- UI 계약: `/settings` CRUD, stable ID action, 고객 상세 chip·기준 trace·설정 링크와 공식 권고 아님 안내
- non-goal 준수: 권고 seed, gender enum/wildcard, 자동 추천, 판정 저장, Dashboard·원격 기능을 추가하지 않음

## Privacy Review

- Benchmark는 승인된 필드만 저장하고 권고금액 seed나 고객별 파생 판정을 저장하지 않는다.
- Settings·고객 상세·삭제 확인에 사용자 설정 내부 기준이며 공식 보험 권고나 적합성 판단이 아니라는 안내가 있다.
- validation·conflict·DB 오류는 거부값·SQL·행 원문 없이 고정 안전 메시지로 매핑한다.
- Category·Benchmark는 soft delete와 FK `RESTRICT`/`CASCADE`, active-parent visibility로 원본과 기본 조회를 분리한다.
- E2E는 명시적 합성 행과 임시 SQLite만 사용하고 종료 뒤 DB·log artifact를 제거한다.
- production capability는 `core:default`뿐이며 broad filesystem·shell·network·telemetry·WebDriver 권한이 없다.

## Residual Risk

- Windows x64 NSIS·WebView2 미설치·network-offline VM 설치와 native E2E는 아직 실증하지 않았다.
- 로컬 SQLite는 암호화되지 않아 OS 계정·디스크 보호에 의존한다.
- 사용자 설정 기준은 승인·버전·감사 이력이 없고 잘못된 금액도 기술 경계 안이면 저장된다.
- Customer의 birthDate·gender 누락 또는 exact 문자열 불일치는 기준 미설정이며 별도 데이터 품질 경고가 없다.
- row semantic DB CHECK를 두지 않아 외부 손상은 safe error·중복 판정으로 차단하지만 자동 복구하지 않는다.
- Web Locks가 없는 Browser preview의 서로 다른 tab은 storage identity fallback만으로 완전 직렬화되지 않는다. production Tauri는 SQLite IMMEDIATE transaction을 사용한다.
- soft-deleted Benchmark의 purge·복원 UI가 없고 Category 복원 시 개별 삭제되지 않은 자식이 다시 보일 수 있다.
- 만나이는 OS local date와 시스템 시계 정확도에 의존하고 상령·보험 적합성 의미를 제공하지 않는다.

## Follow-Ups

- 다음 수직 계획에서 Dashboard의 overdue·미상담·보험료·보장 부족 read model을 구현한다.
- 이후 Calendar, Import/Export, Backup/Restore와 Settings를 작은 승인 계획으로 진행한다.
- 최종 release에서 Windows x64 NSIS와 offline VM 전체 회귀를 수행한다.
