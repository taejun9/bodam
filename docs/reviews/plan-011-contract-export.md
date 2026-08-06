# plan-011-contract-export Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-011-contract-export.md`
- reviewed tree: `codex/plan-011-contract-export` worktree before commit
- baseline: main `9ddf896`
- reviewer roles: 독립 domain/data `review_judge`, UI/accessibility reviewer, `privacy_guard`
- review order: 전체 QA, 읽기 전용 리뷰, finding 수정·회귀, 전체 QA 재실행, 세 심사자의 최종 재검토
- reviewed_at: 2026-08-07 KST

## QA Evidence

- 최종 `npm run qa`: ESLint, typecheck, Vitest 67 files/317 tests, Prisma 계약, Rust default 195 tests, production build, Tauri check와 harness PASS
- Rust all-features 206/206, fmt, all-targets/all-features Clippy `-D warnings`, `npm audit --audit-level=high`, `git diff --check` PASS
- 실제 Browser 1280×900·390×844 dark/light: 대상/제외 요약, privacy 안내, disabled Browser 저장, overflow 0, console warning/error 0
- 실제 macOS release app: 합성 대상 1·원본 없음 1·충돌 1, NSSavePanel cancel, XLSX·CSV 저장과 성공 요약 1/1/1 확인
- 격리 release E2E: XLSX·CSV strict 생성 검사, production parser round-trip, import/write/restart/rollback과 SQLite logical snapshot 불변 PASS
- artifact-tool XLSX import/render: 21열과 formula error 0; CSV 독립 검사: BOM·CRLF·RFC 4180·21 fields와 quoted lone CR/LF 확인
- production `dist`·`BODAM.app`·binary E2E marker 0, isolated `dist-e2e`·`target/e2e/BODAM E2E.app`에만 marker 존재

## Findings

| severity | finding | resolution |
|---|---|---|
| P1 | E2E 앱이 production identity와 target을 공유 | `BODAM E2E`, 별도 identifier·dist·Cargo target과 exact-path guard 적용 |
| P2 | README가 backup을 구현 기능처럼 표시 | 현재 export 상태와 plan-012 후속 범위를 분리 |
| P2 | sort-only identity text가 logical budget·memory를 증폭 | SQL 안정 정렬 후 21 source cell만 retain·budget 계산 |
| P3 | quoted CSV lone CR/LF를 import parser가 거부 | quote-aware record scanner와 exact round-trip 회귀 추가 |
| P2 | summary 실패 뒤 stale 저장이 가능 | application/UI cache 무효화와 저장 disable 적용 |
| P2 | import/export mutual busy가 retry/refresh에서 우회 | guard·disabled 계약과 호출 횟수 테스트 추가 |
| P2 | logical-text/path native error mapping 부정확 | safe code별 한국어 오류 mapping 추가 |
| P2 | retry 뒤 focus 유실 | panel-scoped format button/summary/status fallback 적용 |

세 독립 최종 재리뷰에서 미해결 또는 새 P0–P3 actionable finding은 0건이었다.

## Requirements Trace

- 대상 계약: active Customer·Policy, 1:1 source, 7개 mapped domain/source exact parity만 포함
- 제외 계약: manual source 없음과 parity conflict를 별도 집계, deleted parent/Policy는 숨김
- 형식 계약: exact 21 headers, XLSX text/blank/style, CSV BOM/CRLF/RFC 4180과 formula trigger fail-closed
- 순서·상한: SQL blank-last date/name/id stable order, 5,000 rows, 10 MiB file와 20 MiB logical source text
- 파일 계약: native pathless dialog, blocking worker, same-directory random temp, flush/sync/reparse/atomic replace
- UI 계약: summary/loading/error/result, mutual busy, retry focus, 390px no document overflow와 민감 평문 안내
- capability 계약: no broad fs/shell/process/network; production/E2E identity·frontendDist·Cargo target 격리

## Privacy Review

- 실제 고객 데이터·첨부·전체 경로·Customer/Policy 식별값을 fixture, source, 문서, log, screenshot에 복사하지 않았다.
- IPC result는 format, count와 basename만 반환하고 source cell과 전체 path를 반환하지 않는다.
- manual/conflict 행을 승인 없이 합성하지 않으며 export 파일이 평문 민감 파일임을 저장 전에 알린다.
- E2E path seam은 feature와 canonical synthetic temp runtime에 제한되고 production bundle에는 포함되지 않는다.

## Residual Risk

- process 또는 전원 중단 시 같은 directory의 random temp가 남을 수 있다.
- parent symlink 변경과 network filesystem의 atomic replace semantics는 platform/filesystem 계약에 의존한다.
- semantic verification/replace failure는 검사했지만 write·flush·fsync 각각의 deterministic failure injection은 없다.
- system overwrite-decline은 실제 자동화하지 않았고 macOS 실제 save/cancel과 Rust 경계 테스트에 의존한다.
- Windows native dialog와 `MoveFileEx` 실제 파일시스템 경계는 plan-013 release acceptance에 남는다.

## Follow-Ups

- plan-012에서 SQLite backup/restore, Settings와 손상·취소·재시작 수명주기를 구현·검증한다.
- plan-013에서 Windows offline installer, 실제 save overwrite-decline/accept와 restore/install acceptance를 수행한다.
