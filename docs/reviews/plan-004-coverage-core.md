# plan-004-coverage-core Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-004-coverage-core.md`
- reviewed tree: `codex/plan-004-coverage-core` worktree before commit
- reviewer roles: 독립 정확성 `review_judge`, UI/접근성 reviewer, `privacy_guard`
- review order: 전체 QA PASS 후 1차 리뷰, findings 해결·회귀 검증, 최종 읽기 전용 재리뷰
- reviewed_at: 2026-08-06 KST

## QA Evidence

- 최종 수정 후 `npm run qa`: PASS
- Vitest: 11 files / 35 tests PASS
- Rust default/all-features: 46/46 PASS
- Prisma validate, migration registry/hash, schema diff, v0–v3 runtime history/schema/FK drift: PASS
- `cargo fmt --check`, all-targets/all-features clippy `-D warnings`: PASS
- Python QA harness, negative controls, `npm audit` 0 vulnerabilities, `git diff --check`: PASS
- in-app Browser: Coverage 생성·수정·삭제, Policy 합계 제외·재포함, reload, 390×844 layout와 dialog keyboard 흐름 PASS
- release-mode macOS `BODAM.app`: 두 프로세스 E2E 2/2 PASS, Category rename·Coverage 합계·SQLite restart persistence·soft-delete 확인
- production boundary: 표준 app 재빌드, E2E DB override·WDIO·WebDriver 문자열 없음, `core:default`만 허용

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| P2 | 금액 form이 trim 후 검증해 공백 포함 문자열을 허용 | `coverage-form.ts`와 계약 비교 | 원문 정규식 검사와 공백·탭·개행 회귀 테스트 추가 |
| P3 | Category `maxlength=100`이 비-BMP scalar 100자를 차단 | HTML UTF-16 length와 Unicode 계약 비교 | `maxlength=200`으로 조정하고 schema/Rust scalar 100자 검증 유지 |
| P2 | 같은 이름의 Category가 선택·합계·수정·삭제에서 구분되지 않음 | component 렌더와 접근성 이름 검토 | 중복 이름에만 전체 Category ID를 표시하고 component/native E2E 추가 |
| P2 | Category 삭제 E2E가 delete panel 전환을 삭제 성공으로 오인 | fixture wait 조건 검토 | 목록 복귀와 dialog 재진입 뒤 대상 부재를 검증하도록 강화 |

모든 finding을 해결한 뒤 세 독립 관점 재리뷰에서 신규 또는 미해결 P0–P3 finding이 없음을 확인했다.

## Requirements Trace

- 승인 범위: CoverageCategory foundation, Policy별 Coverage CRUD, 고객별 Category 합계와 실제 앱 persistence
- 구현 증거: Vue application/repository/UI, Browser adapter, Tauri IPC·Rust SQLite repository, Prisma v3 migration
- 금액 계약: SQLite `INTEGER`/Prisma `BigInt` → IPC decimal string → TypeScript `bigint`; float와 파생 합계 저장 없음
- 합계 계약: 활성 Customer·Category·Coverage와 `isIncluded=true` Policy만 Category ID별 합산하며 제외 Policy 원본은 관리 목록에 유지
- 삭제 계약: Customer·Policy·Category·Coverage `deletedAt` soft delete, child 원본 유지, active read·합계 숨김, hard delete FK `RESTRICT`
- migration 계약: version/order/hash/history와 table·column·index·FK runtime drift 검사
- non-goal 준수: Benchmark, 병력·특약·청구 필드, Category 생성·복원, 원격 통신을 추가하지 않음

## Privacy Review

- 저장 필드는 승인된 Category·Coverage 필드에 한정되고 주민등록번호, 보험사 로그인, 민감·상세 병력은 없다.
- TypeScript와 Rust가 UUID·Unicode 길이·decimal money·unknown field를 각각 검증한다.
- validation/repository 오류는 거부값이나 DB 행 원문 대신 고정된 사용자 메시지만 노출한다.
- Browser와 native E2E는 명시적인 합성 데이터와 임시 SQLite만 사용했다.
- production capability에 broad filesystem, shell, network, telemetry 또는 WebDriver 권한이 없다.

## Residual Risk

- Windows x64 NSIS·WebView2 미설치·network-offline VM 설치와 native E2E는 아직 실증하지 않았다.
- 로컬 SQLite는 암호화되지 않아 OS 계정·디스크 보호에 의존한다.
- soft-deleted 업무 데이터는 원본을 유지하며 별도 보존기간·purge 기능은 아직 없다.
- Browser preview localStorage는 개발용이므로 합성 데이터 외 실사용 데이터를 넣지 않아야 한다.
- macOS WebDriver session의 환경 의존적인 일시 정지 가능성이 남는다.

## Follow-Ups

- 다음 수직 계획에서 Family 관계와 household 단위 탐색을 구현한다.
- 이후 Consultation, Benchmark, Dashboard, Calendar, Import/Export, Backup/Restore를 작은 승인 계획으로 진행한다.
- 최종 release에서 Windows x64 NSIS와 offline VM 전체 회귀를 수행한다.
