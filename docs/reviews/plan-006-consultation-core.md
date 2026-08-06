# plan-006-consultation-core Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-006-consultation-core.md`
- reviewed tree: `codex/plan-006-consultation-core` worktree before commit
- baseline: main `0d6ec2d`
- reviewer roles: 독립 데이터 정합성 `review_judge`, UI·접근성 reviewer, `privacy_guard`
- review order: 전체 QA PASS와 durable evidence 기록 뒤 세 읽기 전용 리뷰
- reviewed_at: 2026-08-06 KST

## QA Evidence

- 최종 `npm run qa`: PASS — Vitest 23 files / 97 tests, Rust 77 tests, Prisma validate/diff, Vite build, cargo check와 harness 포함
- `cargo test --all-features`: 77/77 PASS; rustfmt와 all-targets/all-features clippy `-D warnings` PASS
- v5 migration SHA-256 `48601ed0c5561661fd165634a44dcbd575474c3cb4f85b873fa190b9e0a41254`; v4 upgrade 보존·history/runtime schema/index/FK drift PASS
- `npm audit --audit-level=low`: 취약점 0건; `git diff --check`, line/privacy/artifact scan PASS
- in-app Browser: Consultation 생성·수정·reload·삭제, local↔UTC, date-only, privacy 안내, Escape·focus 복귀 PASS
- 390×844 Browser: table→card 전환, body/card/dialog 가로 overflow 0, console warning/error 0건
- release-mode macOS 앱: 첫 프로세스 write 3/3 PASS(1m 42.7s), 새 프로세스 persistence 2/2 PASS(11s)
- native E2E에서 같은 instant의 두 ID, 수정, reload/restart, soft delete와 삭제 후 focus를 실제 Tauri IPC·SQLite로 검증
- 표준 `BODAM.app` 재빌드 뒤 production binary·app·dist·default feature tree에서 E2E DB override, WDIO/WebDriver와 4445 표식 0건

## Findings

| severity | finding | resolution |
|---|---|---|
| P2 | 첫 리뷰 시도 시 계획이 `active`이고 QA Evidence가 `미실행`이라 review gate가 실패 | 실제 QA 증거를 기록하고 `review`로 전환한 뒤 `run_review.py` PASS와 세 독립 리뷰를 다시 확인 |

최종 세 리뷰에서 신규 또는 미해결 P0–P3 actionable finding이 없음을 확인했다.

## Requirements Trace

- 승인 범위: Customer별 Consultation CRUD, 상담 일시·내용·다음 연락일·자유입력 결과, v5 migration, Browser/native persistence
- 저장 계약: Customer FK와 UTC millisecond timestamp가 필수이고 내용·date-only 다음 연락일·결과는 nullable plain text
- 입력 계약: content 4,000, result 200 Unicode scalar; Zod와 Rust strict payload, canonical UUID/date/timestamp 검증
- 조회 계약: 활성 Customer의 활성 Consultation만 `consultedAt DESC, id ASC`; 같은 instant 중복은 ID별 유지
- 삭제 계약: Consultation·Customer soft delete 뒤 원본 유지와 active read 숨김, hard delete FK `RESTRICT`
- adapter 계약: Browser/Tauri의 validation, active-parent, not-found, ordering과 soft-delete parity
- migration 계약: v4 행 보존, version/order/hash/history와 table·column·index·FK runtime drift 검사
- non-goal 준수: 결과 enum, 병력 필드, 첨부, Dashboard 판정, Calendar 일정, 원격 통신을 추가하지 않음

## Privacy Review

- 상담에 주민등록번호·보험사 로그인·민감 병력·상세 병력 전용 필드를 두지 않는다.
- 상담 내용에 금지 정보를 저장하지 말라는 항상 보이는 안내와 `aria-describedby`를 제공한다.
- validation/repository 오류는 거부값·SQL·DB 행 원문 대신 안전한 고정 메시지만 노출한다.
- Browser/native E2E는 명시적 합성 데이터만 사용했고 Consultation·SQLite·실행 로그 artifact를 정리했다.
- production capability는 `core:default`만 보유하며 broad filesystem, shell, network, telemetry, WebDriver 권한이 없다.

## Residual Risk

- Windows x64 NSIS·WebView2 미설치·network-offline VM 설치와 native E2E는 아직 실증하지 않았다.
- 로컬 SQLite는 암호화되지 않아 OS 계정·디스크 보호에 의존한다.
- 자유입력 안내는 금지 민감정보 입력을 기술적으로 차단하지 않는다.
- soft-deleted 상담 원본은 보존되며 별도 보존기간·purge·복원 UI가 없다.
- DST gap/fold를 별도 timezone 프로세스로 고정한 회귀와 KST 밖 실제 화면 검증은 없다.
- Browser preview localStorage의 여러 탭 동시 쓰기와 복수 WebView IPC 경합은 시험 범위가 아니다.
- native E2E는 duplicate ID를 확인하지만 tie-break DOM 순서는 단위 테스트가 보완한다.
- 공용 AppDialog 설명은 아직 `aria-describedby`에 연결되지 않아 향후 공용 접근성 회귀로 보완할 수 있다.

## Follow-Ups

- 다음 수직 계획에서 Coverage Benchmark 설정과 부족·적정·과다 판정 기반을 구현한다.
- 이후 Dashboard, Calendar, Import/Export, Backup/Restore와 Settings를 작은 승인 계획으로 진행한다.
- 최종 release에서 Windows x64 NSIS와 offline VM 전체 회귀를 수행한다.
