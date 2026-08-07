# plan-015-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-015-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-015-windows-hosted-acceptance` before commit
- baseline: main `26759625a2a34f9fe58fdeb059f445bd3ed74531`
- reviewer roles: independent migration/harness, timer-isolation, hosted-evidence/privacy
- reviewed_at: 2026-08-07 KST

## QA Evidence

- hosted run `31141527184`, job `92752255800`, exact baseline SHA, main push attempt 1, `windows-2025`, conclusion failure
- hosted boundary: dependencies success; cross-layer QA failure; host safety, Windows Rust, NSIS lifecycle and installed E2E skipped; cleanup·summary success; upload skipped; artifacts 0
- read-only failed log: Vitest 83/366 and Prisma validate passed before all 9 migration raw-byte checksums mismatched at `database:registry`
- fresh `core.autocrlf=true` clone: migration LF rule absent gives 9/9 mismatch; final selective rule gives `i/lf w/lf`, registry and complete `npm run qa` PASS
- timer control: short real midnight delay reproduces stale retry; 60 s default plus test-local 100 ms fake timer yields focused 10/10 and full 83/366 PASS
- full local gates: Rust default 319, all-features 335, fmt, Clippy `-D warnings`, Windows MSVC no-link projection, dependency audit 0, harness mutations and diff check PASS
- actual macOS app: approved GUI run completed native UI/function E2E with overall exit 0, including restart, import/export/rollback and backup/restore/exit paths

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| none | No P0–P3 finding | three independent reviews and direct reruns | no change required |

## Requirements Trace

- 승인된 goal: exact hosted run의 실제 outcome을 대사하고 실패 시 최소 수정·전체 QA·독립 리뷰를 완료한다.
- 구현 증거: migration-only LF checkout contract와 removal mutation; calendar/dashboard timer mock isolation.
- non-goal 준수: signed/public release, offline clean VM, real customer data와 raw runtime artifact를 추가하지 않았다.
- lifecycle: baseline failure를 PASS로 확대하지 않고 새 commit acceptance를 Plan-016으로 인계한다.

## Privacy Review

- 실제 고객 row, 연락처, 메모, full runner path, raw database/backup/export 또는 credential을 기록하지 않았다.
- GitHub Actions 인증은 기존 계정의 read-only log 조회에만 사용했고 token이나 raw log를 저장소에 복사하지 않았다.
- 임시 CRLF clone/cache는 삭제됐고 synthetic fixture binary rules와 sensitive-artifact scan은 유지된다.

## Residual Risk

- 새 수정 commit의 production NSIS build/install/window launch/uninstall, installed Windows E2E, NTFS tests, cleanup과 exact three-file artifact는 Plan-016 hosted success 전까지 NOT RUN이다.
- Authenticode, SmartScreen reputation과 WebView2-missing network-disabled clean VM acceptance는 승인 범위 밖이다.

## Follow-Ups

- Plan-016에서 main push의 새 exact SHA에 자동 결속된 hosted run을 관찰하고 모든 step과 production artifact를 대사한다.
- 새 실패가 있으면 failure/NOT RUN 경계를 유지하고 별도 complete QA/review lifecycle 뒤 다시 실행한다.
