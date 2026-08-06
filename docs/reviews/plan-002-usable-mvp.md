# plan-002-usable-mvp Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-002-usable-mvp.md`
- reviewed tree: `codex/plan-002-usable-mvp` worktree before commit
- reviewer role: 독립 `review_judge`
- review order: 전체 QA PASS 후 1차 리뷰, findings 해결, 재검증, 최종 읽기 전용 재리뷰
- reviewed_at: 2026-08-06 KST

## QA Evidence

- `npm run verify`: PASS
- Vitest: 3 files / 9 tests PASS
- Rust default/all-features: 19/19 PASS
- release-mode macOS `BODAM.app` WebdriverIO: 두 프로세스 2/2 PASS
- `cargo fmt --check`, all-targets/all-features clippy `-D warnings`: PASS
- Prisma validate, migration registry/hash, schema diff, runtime schema/history drift: PASS
- Python QA harness, `npm audit` 0 vulnerabilities, `git diff --check`: PASS
- in-app Browser: CRUD·theme·reload, 390px drawer, dialog name·Escape·focus, console warning/error 0건
- production boundary: WDIO/env override/listener 없음, 임시 SQLite 잔존 0건

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| P1 | 승인 프로필 hash 불일치 | plan hash와 실제 SHA-256 비교 | 현재 승인 snapshot hash를 일치시키고 결정 기록 |
| P2 | migration history/runtime drift가 exact match 아님 | extra history row·rogue object 재현 | history/schema/object allowlist와 negative tests 추가 |
| P2 | 직접 IPC update 누락 및 id/search 무검증 | partial payload·invalid UUID·oversized search | required-null DTO, unknown field 거부, UUID·100자 검증 |
| P2 | 예상 밖 `Error.message` 노출 | 임의 Error를 UI 경로에 주입 | known-error allowlist와 generic fallback test 추가 |
| P2 | collapsed 상태가 mobile drawer를 깨뜨림 | desktop collapse 후 390px 전환 | mobile class 분리와 compact child layout 제거 |
| P2 | dialog accessible name 연결 오류 | 공백 포함 `aria-labelledby` token | Vue `useId()`와 Browser 접근성 snapshot 확인 |
| P2 | Windows NSIS CI 주장 불일치 | plan과 `--no-bundle` workflow 대조 | hosted E2E와 plan-013 NSIS/offline acceptance 분리 |
| P3 | E2E 임시 DB cleanup race | Windows handle 지연 경로 검토 | recursive retry/backoff와 잔존 assertion 추가 |

모든 finding을 해결한 뒤 최종 독립 재리뷰에서 신규 P0–P3 finding이 없음을 확인했다.

## Requirements Trace

- 승인된 goal: offline Windows 우선 CRM의 app bootstrap과 Customer 첫 수직 기능
- 구현 증거: Vue 고객 화면, application/repository port, Rust Tauri IPC·SQLite adapter, Prisma migration
- 사용자 흐름: 검색·생성·수정·soft-delete·재실행 persistence를 실제 앱에서 확인
- 데이터 원칙: date-only, UTC timestamp, `deletedAt`, synthetic test data, migration exact-match
- non-goal 준수: 가족·계약·보장·상담·dashboard·calendar·import/export·backup 규칙은 구현하지 않음

## Privacy Review

- 실제 고객 행을 source, fixture, 문서, log, screenshot에 사용하지 않았다.
- 주민등록번호, 보험사 로그인 정보, 민감 병력, 상세 병력 필드를 만들지 않았다.
- memo에 저장 금지 정보 안내를 표시하고 예상 밖 오류 문자열을 redaction한다.
- production capability에는 broad filesystem, shell, process, network, WebDriver가 없다.
- remote call, telemetry, tracker, cloud dependency를 추가하지 않았다.

## Residual Risk

- `windows-2025` hosted workflow는 구성했지만 아직 실제 pass 증거가 없다.
- NSIS, WebView2 미설치·network-offline VM, wizard/UAC는 plan-013 수동 acceptance 대상이다.
- 로컬 SQLite는 암호화되지 않아 OS 계정·디스크 보호에 의존한다.
- Customer 이외의 MVP 기능은 후속 계획에서 구현·검증해야 한다.

## Follow-Ups

- plan-003: InsurancePolicy CRUD와 고객 월보험료 합계
- 후속: Coverage, Family, Consultation, Benchmark, Dashboard, Calendar, Import/Export, Backup/Restore
- 최종 release: Windows x64 NSIS와 offline VM 전체 회귀
