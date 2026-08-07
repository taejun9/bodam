# plan-018-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-018-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-018-windows-hosted-acceptance` before commit
- baseline: main `8cf376c95d74ca27ff9af3e8358d330d25eae39d`
- reviewer roles: independent Win32 native semantics, backup regression, hosted evidence/privacy
- reviewed_at: 2026-08-07 KST

## QA Evidence

- hosted run `31146413994`, job `92766662181`, exact baseline SHA, main push attempt 1, `windows-2025`, conclusion failure
- hosted boundary: dependencies success; cross-layer QA failure; host safety, all-feature Windows Rust, production lifecycle, installed E2E skipped; cleanup·summary success; upload skipped; artifact 0
- authenticated read-only log: frontend 366과 database 계약 PASS 뒤 Windows Rust default 281/310 PASS, relative rename error 87 하나와 28개 derived backup fixture failure
- local gates: `npm run qa`, Rust default 319, all-features 335, backup 108, fmt, Clippy `-D warnings`, Windows MSVC 기본/all-feature no-link projection, dependency audit 0 PASS
- actual macOS app: full native UI/function E2E와 backup-only upper runner exit 0; 의도된 restart/exit child disconnect는 marker·archive·logical DB snapshot·residue로 판정

## Findings

| severity | finding | evidence | resolution |
|---|---|---|---|
| resolved P2 | 심사 시점에 완료 plan/review mirror lifecycle이 남아 있었음 | evidence/privacy independent review | completed 이동과 동일 번호 review mirror 작성으로 해소 |
| none | No remaining P0–P3 code, regression, evidence or privacy finding | three independent reviews and direct QA reruns | no code change required |

## Requirements Trace

- 승인된 goal: exact hosted run의 실제 outcome을 대사하고 실패 시 최소 수정·전체 QA·독립 리뷰를 완료한다.
- 구현 증거: Win32 wrapper를 pinned-directory native rename으로 교체하고 overwrite·identity·junction name-swap control을 강화했다.
- non-goal 준수: signed/public release, offline clean VM, 실제 고객 데이터와 raw runtime artifact를 추가하지 않았다.
- lifecycle: baseline failure를 PASS로 확대하지 않고 새 commit의 actual Windows acceptance를 Plan-019로 인계한다.

## Privacy Review

- 실제 고객 row, 연락처, 메모, full runner path, raw database/backup/export 또는 credential을 기록하지 않았다.
- GitHub Actions 인증은 기존 계정의 read-only run/log/API 조회에만 사용했고 token이나 raw log를 저장소에 복사하지 않았다.
- Windows와 macOS E2E는 OS 임시 위치의 synthetic basename/bytes/data만 사용하고 생성 artifact를 저장소에 남기지 않는다.

## Residual Risk

- 수정된 `NtSetInformationFile` path의 actual Windows/NTFS 실행과 default/all-feature Rust, production NSIS/install/window, installed E2E, cleanup, exact three-file artifact는 Plan-019 hosted success 전까지 NOT RUN이다.
- 현재 Windows 수정 증거는 official native contract와 MSVC no-link projection이며 actual execution PASS가 아니다.
- Authenticode, SmartScreen reputation과 WebView2-missing network-disabled clean VM acceptance는 승인 범위 밖이다.

## Follow-Ups

- Plan-019에서 새 main commit에 automatic binding된 hosted run을 관찰하고 모든 step과 production artifact를 대사한다.
- 새 실패가 있으면 failure/NOT RUN 경계를 유지하고 별도 complete QA/review lifecycle 뒤 다시 실행한다.
