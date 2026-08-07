# plan-017-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-017-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-017-windows-hosted-acceptance` before commit
- baseline: main `e1e1df7854e56143edf3d167eeade20b3d693ac0`
- reviewer roles: independent durability/error mapping, Win32 handle semantics, hosted evidence/privacy
- reviewed_at: 2026-08-07 KST

## QA Evidence

- hosted run `31144926212`, job `92762290564`, exact baseline SHA, main push attempt 1, `windows-2025`, conclusion failure
- hosted boundary: dependencies success; cross-layer QA failure; host safety, all-feature Windows Rust, NSIS lifecycle and installed E2E skipped; cleanup·summary success; upload skipped; artifacts 0
- authenticated read-only log: lint/typecheck, Vitest 83/366, Prisma validate/registry/diff passed; Rust default 268/309 passed and 41 failed
- root split: 38 direct `BACKUP_SNAPSHOT_FAILED` plus one derived count failure; rename error 87; ancestor test setup error 5
- official contracts: Rust `File::open` is read-only, Windows `FlushFileBuffers` requires write access, and rename information requires struct size plus filename bytes
- full local gates: Rust default 319, all-features 335, backup focused 108, fmt, Clippy `-D warnings`, Windows MSVC no-link projection, dependency audit 0 and diff check PASS
- actual macOS app: approved GUI run completed native UI/function E2E with overall exit 0, including restart, import/export/rollback and backup/restore/reauthorization/exit paths

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| none | No P0–P3 finding | three independent reviews and direct reruns | no change required |

## Requirements Trace

- 승인된 goal: exact hosted run의 실제 outcome을 대사하고 실패 시 최소 수정·전체 QA·독립 리뷰를 완료한다.
- 구현 증거: write-enabled existing-file durability sync, bytes-preservation control, checked Win32 rename allocation과 leaf identity-swap test.
- non-goal 준수: signed/public release, offline clean VM, 실제 고객 데이터와 raw runtime artifact를 추가하지 않았다.
- lifecycle: baseline failure를 PASS로 확대하지 않고 새 commit acceptance를 Plan-018로 인계한다.

## Privacy Review

- 실제 고객 row, 연락처, 메모, full runner path, raw database/backup/export 또는 credential을 기록하지 않았다.
- GitHub Actions 인증은 기존 계정의 read-only run/log/API 조회에만 사용했고 token이나 raw log를 저장소에 복사하지 않았다.
- Windows test는 synthetic basename와 고정 bytes만 사용하며 생성 E2E/installer artifact는 저장소에 남기지 않는다.

## Residual Risk

- 새 수정 commit의 Windows default/all-feature Rust, production NSIS build/install/window launch/uninstall, installed E2E, NTFS tests, cleanup과 exact three-file artifact는 Plan-018 hosted success 전까지 NOT RUN이다.
- 현재 Windows evidence는 hosted baseline failure와 local MSVC no-link projection이며 수정된 Win32 code의 실제 실행 PASS가 아니다.
- Authenticode, SmartScreen reputation과 WebView2-missing network-disabled clean VM acceptance는 승인 범위 밖이다.

## Follow-Ups

- Plan-018에서 main push의 새 exact SHA에 자동 결속된 hosted run을 관찰하고 모든 step과 production artifact를 대사한다.
- 새 실패가 있으면 failure/NOT RUN 경계를 유지하고 별도 complete QA/review lifecycle 뒤 다시 실행한다.
