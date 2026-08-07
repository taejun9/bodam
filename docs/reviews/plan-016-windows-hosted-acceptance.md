# plan-016-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-016-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-016-windows-hosted-acceptance` before commit
- baseline: main `b073398eab256051ff9a3edcabba8a9d173890c1`
- reviewer roles: independent encoding/control, hosted-run evidence, scope/privacy
- reviewed_at: 2026-08-07 KST

## QA Evidence

- hosted run `31143343159`, job `92757646610`, exact baseline SHA, main push attempt 1, `windows-2025`, conclusion failure
- hosted boundary: dependencies success; cross-layer QA failure; host safety, Windows Rust, NSIS lifecycle and installed E2E skipped; cleanup·summary success; upload skipped; artifacts 0
- authenticated read-only failed log: Vitest 83/366 and Prisma migration registry logic passed before U+2194 success summary raised `UnicodeEncodeError` on CP1252 stdout
- focused reproduction/control: original forced CP1252 CLI exit 1; ASCII renderer fix exit 0; restored arrows and CP1252-compatible `é` mutations detected
- full local gates: Rust default 319, all-features 335, fmt, Clippy `-D warnings`, Windows MSVC no-link projection, dependency audit 0, harness mutations and diff check PASS
- actual macOS app: approved GUI run completed native UI/function E2E with overall exit 0, including restart, import/export/rollback and backup/restore/exit paths

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| none | No P0–P3 finding | three independent reviews and direct reruns | no change required |

## Requirements Trace

- 승인된 goal: exact hosted run의 실제 outcome을 대사하고 실패 시 최소 수정·전체 QA·독립 리뷰를 완료한다.
- 구현 증거: registry-only/full ASCII success renderer와 forced CP1252 CLI subprocess regression control.
- non-goal 준수: signed/public release, offline clean VM, 실제 고객 데이터와 raw runtime artifact를 추가하지 않았다.
- lifecycle: baseline failure를 PASS로 확대하지 않고 새 commit acceptance를 Plan-017로 인계한다.

## Privacy Review

- 실제 고객 row, 연락처, 메모, full runner path, raw database/backup/export 또는 credential을 기록하지 않았다.
- GitHub Actions 인증은 기존 계정의 read-only run/log 조회에만 사용했고 token이나 raw log를 저장소에 복사하지 않았다.
- subprocess stdout/stderr는 bytes로 판정만 하며 실패 내용을 문서나 test failure message에 복사하지 않는다.

## Residual Risk

- 새 수정 commit의 production NSIS build/install/window launch/uninstall, installed Windows E2E, NTFS tests, cleanup과 exact three-file artifact는 Plan-017 hosted success 전까지 NOT RUN이다.
- `run_review.py`의 missing-evidence failure-only 한글 diagnostic은 현재 workflow/QA 성공 경로 밖의 비차단 일반 hardening 후보다.
- Authenticode, SmartScreen reputation과 WebView2-missing network-disabled clean VM acceptance는 승인 범위 밖이다.

## Follow-Ups

- Plan-017에서 main push의 새 exact SHA에 자동 결속된 hosted run을 관찰하고 모든 step과 production artifact를 대사한다.
- 새 실패가 있으면 failure/NOT RUN 경계를 유지하고 별도 complete QA/review lifecycle 뒤 다시 실행한다.
