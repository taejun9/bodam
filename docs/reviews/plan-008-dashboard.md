# plan-008-dashboard Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-008-dashboard.md`
- reviewed tree: `codex/plan-008-dashboard` worktree before commit
- baseline: main `e04dff7`
- reviewer roles: 독립 domain/data `review_judge`, UI·accessibility reviewer, `privacy_guard`
- review order: 전체 QA PASS와 실제 Browser/native 증거 기록 뒤 세 읽기 전용 리뷰, finding 수정·QA 뒤 UI/privacy 재리뷰
- reviewed_at: 2026-08-06 KST

## QA Evidence

- 최종 `npm run qa`: PASS — Vitest 37 files / 163 tests, Rust 93 tests, Prisma validate/diff, migration registry, Vite production build, cargo check와 harness 포함
- Dashboard targeted: 6 files / 29 tests PASS — date/instant/timezone, 0/30/31/60/61/90/91, same-day future consultation, managed boundary, bigint/tie/limit, refresh/stale/error와 contrast 포함
- `cargo test --all-features`: 93/93 PASS; rustfmt와 all-targets/all-features Clippy `-D warnings` PASS
- `npm audit --audit-level=high`: 취약점 0건; `git diff --check`, 300줄·privacy·artifact scan PASS
- in-app Browser: UI로 합성 Customer 2, Policy 3, Coverage 1, Benchmark 1, Consultation 1, Family 2와 membership 3을 만들고 8개 카드 count `1/1/1/2/2/1/1/1` 확인
- Browser: excluded Policy 만기, 합계대상 보험료, 1원 부족, 상령 9일, 연락 2일 연체, 최근 상담 1일, 상담 없음, stable customer link와 reload·Benchmark 삭제 재계산 PASS
- Browser 390×844: one-column, body overflow 0, 긴 이름 wrapping, dark/light, mobile menu와 console warning/error 0건; 합성 원본은 UI soft delete로 정리
- release macOS 앱: 실제 Tauri IPC write 5/5 PASS, 별도 앱 프로세스 restart persistence 3/3 PASS
- macOS AppKit GUI 등록은 Codex sandbox에서 차단되어 동일 native E2E 명령을 승인된 비샌드박스 실행으로 수행
- native E2E 뒤 기본 feature로 standard `BODAM.app` 재생성; app·binary·dist에서 E2E DB override, clock, WDIO/WebDriver와 4445 표식 0건
- E2E 임시 SQLite와 WDIO log artifact 0건

## Findings

| severity | finding | resolution |
|---|---|---|
| P2 | light theme Dashboard 보조 문구의 `--text-muted`가 white/subtle/app 표면에서 일반 text WCAG AA 4.5:1 미달 | 보조 문구 전체를 `--text-secondary`로 변경하고 light/dark의 app/surface/subtle/muted 네 표면 contrast 4.5:1 자동 회귀 추가 |
| P3 | `open-questions.md`가 Dashboard를 후속 구현이라 쓰고 8개 카드 전체를 managed Customer 기반처럼 기술 | 요청 시 계산 완료 상태와 managed Customer 7개 + 기존 Family summary 1개로 문서 정정 |

수정 후 UI·접근성 및 privacy·capability 재리뷰에서 신규 또는 미해결 P0–P3 actionable finding이 없었다. domain/data 리뷰는 최초부터 finding이 없었다.

## Requirements Trace

- 진입 계약: `/` → `/dashboard`, sidebar Dashboard와 고객·가족 실제 링크
- 조회 계약: 기존 Customer·Insurance·Family·Coverage·Benchmark·Consultation 공개 application만 병렬 조합하고 결과를 저장하지 않음
- 기준 계약: 명시적 canonical `referenceDate`, 같은 local 날짜의 UTC `referenceInstant`, 유효 IANA timezone과 기본 limit 10
- 상담 계약: 미래 instant 제외, latest `consultedAt DESC, id ASC`, 최신 상담의 nextContact supersede, 오늘 포함 최근 30일과 exact 90일/never-first
- 날짜 계약: 생일+6개월 month-end clamp, 0–30/31–60/61–90 상령·Policy 만기 bucket
- 집계 계약: managed Customer 7개 카드, 공개 Family summary 1개, bigint 0원 제외, excluded Policy 보험료 제외·만기 포함
- 부족 계약: `insufficient` Category count 우선, `unconfigured` 제외, 0 Coverage 부족 포함, 부족액 cross-category 합산 없음
- 표시 계약: limit 전 totalCount, code-unit/name/stable ID tie, semantic section/heading/time/reason/link, loading/error/retry/empty/truncated
- refresh 계약: mount, focus, hidden→visible, local midnight 재계산과 request number stale guard
- non-goal 준수: 새 DB·migration·Rust command·cache·원격 기능·공식 보험 권고·Dashboard 설정 저장 없음

## Privacy Review

- 실제 고객 행이나 민감 병력·상세 병력·주민등록번호·보험사 로그인 정보를 source/test/docs/log/screenshot에 넣지 않았다.
- feature adapter 오류는 고정된 safe Dashboard error로 바뀌며 거부값·행·SQL을 노출하거나 기록하지 않는다.
- Dashboard는 저장소·DB·Tauri command를 직접 읽지 않고 공개 application 결과만 조합한다.
- active parent/soft-delete와 합계 계약을 기존 application에서 재사용하고 새 hard delete나 SQLite 전용 SQL을 추가하지 않았다.
- E2E는 명백한 합성 데이터와 명시적 임시 SQLite만 사용하고 `finally` cleanup 뒤 artifact가 없다.
- production capability는 기존 `core:default` 경계이고 broad filesystem·shell·network·telemetry·WebDriver 권한이 없다.

## Residual Risk

- 공개 application을 Customer별로 fan-out하는 요청 시 read model이라 대규모 데이터 성능은 아직 실증하지 않았다.
- Windows x64 NSIS·WebView2 offline VM과 Windows native Dashboard E2E는 최종 release 계획에서 검증해야 한다.
- 로컬 SQLite는 암호화되지 않아 OS 계정·디스크 보호에 의존한다.
- 기준일·기준시각·timezone은 OS clock과 timezone 정확도에 의존한다.
- 1–9999 날짜 계약의 극단 상한과 장기 실행 stress는 일반 업무 범위 밖이며 별도 검증하지 않았다.
- visibility resume 직후 focus가 연속되면 중복 read가 발생할 수 있지만 stale 응답은 화면을 덮지 않는다.

## Follow-Ups

- 다음 수직 계획에서 승인된 월 Calendar와 사용자 일정 CRUD를 구현한다.
- 이후 Excel/CSV import·export, backup/restore, Settings와 Windows release를 작은 계획으로 진행한다.
- 데이터 규모가 커지면 public application batch query 또는 명시적 Dashboard read adapter를 별도 승인·성능 증거와 함께 검토한다.
