# plan-019-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-019-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-019-windows-hosted-acceptance` before commit
- baseline: main `407149f5dcc078632f105379702fb391d1caa223`
- reviewer roles: independent harness portability, hosted evidence, privacy/quality
- reviewed_at: 2026-08-07 KST

## QA Evidence

- hosted run `31148648177`, job `92773469878`, exact baseline SHA, main push attempt 1, `windows-2025`, conclusion failure
- hosted PASS boundary: dependencies; Vitest 83/366; Prisma/database contract; Windows default Rust 310/310 including native rename and junction name-swap; Vite build; Tauri check; unconditional cleanup and evidence summary
- hosted NOT RUN boundary: recursive PowerShell/junction host safety, Windows all-features, production NSIS lifecycle and registry/WebView2 preservation, private/installed E2E, upload and production artifact acceptance; artifact API count 0
- local gates: focused harness negative controls and repeated `npm run qa` PASS; dependency audit 0; diff whitespace and Windows PurePath POSIX projection PASS
- privacy controls: PASS summary and worktree mismatch failure omit absolute root; synthetic mismatch control asserts the temporary root is absent

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| resolved P3 | QA PASS summary exposed the absolute worktree root | privacy review of `run_qa.py` | replaced with stable `repository scope: current worktree`, removed unused import, reran full QA |
| resolved P3 | worktree mismatch failure exposed the absolute root | final code re-review of `base_checks.py` | replaced with stable relative/status diagnostic, added root-redaction negative control, reran full QA |
| resolved P2 | completed plan/review mirror lifecycle remained during review | evidence reviewer | moved plan to completed and created this same-number review before commit |
| none | No remaining P0–P3 code, evidence or privacy finding | three final independent re-reviews | approved |

## Requirements Trace

- 승인된 goal: exact hosted result를 대사하고 실패 시 최소 수정, 전체 QA와 독립 리뷰를 완료한다.
- 구현 증거: Windows native path 진단을 POSIX repo-relative contract로 고정하고 PASS/FAIL harness log의 absolute checkout path를 제거했다.
- 회귀 증거: nested backup path negative control과 unexpected-worktree root-redaction negative control이 각각 이식성과 privacy 경계를 고정한다.
- lifecycle: failed baseline이나 skipped release steps를 PASS로 확대하지 않고 새 exact commit acceptance를 Plan-020에 인계한다.

## Privacy Review

- 실제 고객 row, 연락처, 메모, credential, raw database/backup/export와 full runner root를 소스·문서·QA summary에 추가하지 않았다.
- synthetic temporary directory는 경로 비노출 assertion에만 사용되며 오류나 문서에 값이 기록되지 않는다.
- GitHub evidence는 bounded test counts, basename, status와 identifiers만 기록하고 raw runner artifact/log를 저장소에 복사하지 않았다.

## Residual Risk

- 수정된 POSIX diagnostic의 actual Windows 실행과 downstream host safety, all-feature Rust, production NSIS/install/window, installed E2E 및 exact three-file artifact acceptance는 Plan-020 hosted success 전까지 `NOT RUN`이다.
- Authenticode, SmartScreen reputation과 WebView2-missing network-disabled clean VM acceptance는 승인 범위 밖이다.

## Follow-Ups

- Plan-020에서 이 완료 commit의 automatic main-push run을 exact SHA로 결속하고 모든 Windows step과 production artifact를 대사한다.
- 새 실패가 있으면 failure/NOT RUN 경계를 유지하고 별도 complete QA/review lifecycle 뒤 다시 실행한다.
