# plan-014-windows-hosted-evidence

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고, Plan-013 승인 범위가 main 반영 뒤 hosted Windows run의 실제 실행·관찰·실패 수정을 Plan-014로 명시했다.
- 승인 범위: main `641db6c`의 `windows-2025` workflow run 관찰, exact commit/run/step/artifact evidence 기록, Windows-only 실패의 최소 수정·QA·독립 리뷰·재실행
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact main commit의 첫 `windows-2025` 실행을 authoritative하게 관찰하고 run/job/step outcome을 기록한다.
- hosted failure를 공개 annotation과 독립 재현으로 분류하고 최소 수정과 재발 방지 계약을 구현한다.
- 수정 tree에서 전체 로컬 QA, Windows projection과 실제 macOS 앱 화면·기능 E2E를 재검증한다.
- QA·독립 리뷰·완료 plan 뒤 main에 반영할 수 있는 상태로 닫고, 새 exact commit의 hosted PASS·artifact 대사는 Plan-015로 이관한다.
- 실패한 실행을 PASS나 release artifact evidence로 확대하지 않고 unsigned/offline clean-VM `NOT RUN` 경계를 유지한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·raw log artifact 보관

## Constraints

- `codex/plan-014-windows-hosted-evidence`와 `.worktree/plan-014-windows-hosted-evidence`에서만 기록·수정한다.
- 계획·승인 → hosted evidence 관찰 → 필요 시 구현 → QA → 독립 리뷰 → 완료 plan/review → commit·merge 순서를 지킨다.
- run과 artifact는 exact main commit에 결속하고 진행 중·취소·실패 상태를 PASS로 표현하지 않는다.
- log·summary·docs에는 합성 count, basename, hash, status만 기록하고 전체 runner path, row value, credential을 복사하지 않는다.
- production exact 3-file artifact만 검사하며 E2E installer나 runtime data를 다운로드·재게시하지 않는다.
- 소스·문서·workflow는 300줄 전에 분리하고 Windows-only fix도 cross-platform regression을 재검증한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `641db6c`의 main push event다.
- run conclusion과 `windows-installer-e2e` job, 8개 검증 step, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR rerun이면 artifact는 `bodam-windows-x64-unsigned` 하나이며 production installer, `.sha256`, `evidence.json` exact 세 파일만 허용한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 서로 일치해야 한다.
- evidence는 `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, marker 0과 install/uninstall exit 0을 요구한다.
- Windows run log에서 업무 row나 full private path를 문서로 복사하지 않고 failure 설명도 safe code/step 중심으로 남긴다.

## Implementation Plan

- [x] main `641db6c` push workflow run ID/URL과 exact commit 확인
- [x] job/step outcome, public annotation, artifact 미생성 경계를 확인
- [x] CRLF visual contract와 cleanup PowerShell parser failure를 독립 재현하고 최소 수정
- [x] Windows 실제 parser와 로컬 mutation으로 재발 방지 계약 추가
- [x] targeted/full QA, Windows projection과 actual macOS full app E2E 수행
- [x] independent review, 완료 plan·동일 번호 review mirror와 Plan-015 인계 계약 작성

## QA Plan

- GitHub run status/conclusion, commit SHA, event, runner label과 step outcomes 확인
- hosted PowerShell parser, HKCU/HKLM registry views, WebView2 `pv`, nested junction sentinel negative control 확인
- Windows Rust default/all-features, NTFS relative CRUD, identity-swap, symlink/junction, FlushFileBuffers 실행 확인
- production NSIS exact x64/config/feature/marker/hash, silent lifecycle, launch and residue/app-data/WebView assertions 확인
- installed private E2E exact binary, complete synthetic UI/native suite, uninstall and zero owned residue 확인
- artifact count/name/retention/size/digest와 inner exact allowlist/evidence schema 대사
- 수정 시 `npm run qa`, Rust default/all-features/fmt/Clippy, Windows MSVC cross-check, actual macOS E2E와 mutation controls 재실행

## Acceptance Scenarios

1. exact main `641db6c`의 첫 hosted run, job, 실패·skip step과 upload 미실행을 정확히 기록한다.
2. Windows annotation의 CRLF 실패 2건이 newline-agnostic source contract로 수정되고 전체 Vitest가 통과한다.
3. cleanup import 실패가 PowerShell numeric literal parser 오류로 재현되고 literal 수정 뒤 repo 전체 PowerShell parse error가 0이다.
4. 로컬 전체 QA, Rust default/all-features/Clippy/Windows projection과 actual macOS full native E2E가 통과한다.
5. hosted production/installed E2E와 exact three-file artifact는 성공으로 주장하지 않고 새 main commit의 Plan-015 검증으로 넘긴다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/filesystem reviewer가 exact commit binding, step/result 해석, checksum/allowlist, 개인정보 경계와 잔여 주장 범위를 확인한다. Windows-only fix가 있으면 작성자가 아닌 reviewer가 코드도 재검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted pass로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-013 main push commit의 자동 run을 authoritative first attempt로 사용 | workflow 정의와 실행 commit을 직접 결속하고 수동 재실행으로 drift시키지 않음 |
| 2026-08-07 | public GitHub run/artifact metadata를 exact SHA 기준으로 관찰 | 로컬 `gh` 인증 실패와 무관하게 공개 repository의 authoritative state를 읽기 전용 검증 |
| 2026-08-07 | hosted 확인을 Plan-015로 분리하고 Plan-014는 first-run failure fix lifecycle로 완료 | repository gate가 review·completed plan 뒤 commit을 요구하므로 새 commit을 push하기 전 rerun 증거를 만들 수 없음 |
| 2026-08-07 | `15_000`을 `15000`으로 수정하고 실제 PowerShell recursive parser와 로컬 mutation을 함께 둠 | module import-time failure를 직접 제거하고 macOS pre-push와 Windows native parser 양쪽에서 재발 차단 |
| 2026-08-07 | special folder empty-path 가능성은 이번 root cause로 수정하지 않음 | parser가 먼저 실패해 해당 코드에 도달하지 않았으며 새 hosted run에서 환경 의존 잔여 위험으로 관찰 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-013 `641db6c`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | standing approval로 Plan-014 전용 branch/worktree와 hosted evidence 계약을 만들었다. |
| 2026-08-07 | quality_runner | run `31138692455`, job `92743753702`를 exact `641db6c4833015345394a5ab0d151fc57dd9446c`에 결속하고 failure/skip/upload 경계를 확인했다. |
| 2026-08-07 | quality_runner | 공개 annotation으로 Windows CRLF visual-contract 실패 2건을 확인하고 newline 정규화 뒤 Vitest 83/366을 통과했다. |
| 2026-08-07 | harness_builder | PowerShell 7.6.4 parser로 `15_000` import failure를 재현하고 `15000`, recursive native parser scan과 mutation control을 적용했다. |
| 2026-08-07 | quality_runner | full QA, Rust 319/335, Clippy, Windows MSVC projection, audit와 actual macOS full E2E를 통과했다. |

## QA Evidence

- local remediation QA result: PASS
- hosted Windows acceptance: FAIL — production lifecycle·installed E2E는 `NOT RUN`, artifact count 0이며 Plan-015 authoritative rerun이 pending
- hosted first attempt: [GitHub Actions run 31138692455](https://github.com/taejun9/bodam/actions/runs/31138692455), job `92743753702`, main push, exact commit `641db6c4833015345394a5ab0d151fc57dd9446c`, `windows-2025`, conclusion `failure`
- hosted step boundary: install dependencies success; cross-layer QA failure; host safety, Rust, production build/lifecycle, E2E build/installed E2E skipped; cleanup failure; always-summary success; artifact upload skipped
- public annotations: `app-settings-visual-contract.test.ts:38`와 `data-exchange-visual-contract.test.ts:108`이 Windows CRLF source를 LF literal과 비교해 실패; raw log는 익명 API `403` 경계로 문서에 복사하지 않음
- cleanup reproduction: official PowerShell 7.6.4 parser에서 `WaitForExit(15_000)`이 import-time parser errors 10건과 실제 `Import-Module` failure; `15000` 치환 뒤 repo PowerShell 6개 parse errors 0
- focused visual contracts: 2 files/5 tests PASS; full Vitest 83 files/366 tests, ESLint와 Vue typecheck PASS
- `npm run qa`: Prisma registry/hash/diff, Rust default 319/319, production Vite build, Tauri check, harness와 mutation controls PASS
- Rust: all-features 335/335, fmt check, all-features Clippy `-D warnings` PASS
- Windows MSVC projection: stable Rust, `x86_64-pc-windows-msvc`, tests/all-features, `RUSTFLAGS=-Dwarnings`, host pkg-config와 LLVM resource compiler를 사용한 no-link cross type-check PASS
- dependencies: `npm audit --audit-level=high` — vulnerability 0
- actual macOS `BODAM E2E.app`: `npm run test:e2e` overall exit 0; Customer/Policy/Coverage/Benchmark/Family/Consultation/Dashboard/Schedule/Calendar, restart, XLSX/CSV import/export/round-trip/rollback, backup/restore/restart/reauthorization/exit recovery/idempotency PASS
- expected-process boundary: restore와 exit lifecycle child WDIO가 app restart/exit 때문에 nonzero여도 상위 runner가 marker, archive, logical DB snapshot, cleanup residue를 대사했으며 최종 runner exit 0
- final diff/contract: `git diff --check`, recursive PowerShell portability mutation, repository 300-line/privacy/artifact scans PASS

## Review Findings

- PowerShell/cleanup reviewer: P0–P3 0. `15000`, recursive native parser, local mutation이 import failure를 닫고 cleanup allowlist·reparse·WebView2 경계를 넓히지 않음을 확인했다.
- visual contract reviewer: 코드 P0–P3 0. CRLF 정규화가 line ending만 canonicalize하고 selector·indentation·layout assertion을 약화하지 않음을 확인했다.
- evidence/privacy reviewer의 초기 P1: review/completed mirror 항목을 실제 완료 전에 체크했다. 미체크로 되돌린 뒤 이 완료 이동과 mirror 작성 시점에만 체크해 해소했다.
- evidence/privacy reviewer의 초기 P2: `result: PASS`와 artifact 문구가 hosted success로 오인될 수 있었다. local remediation PASS, hosted FAIL, core Windows `NOT RUN`, artifact 0과 successful-run 조건으로 분리해 해소했다.
- 두 문서 finding 수정 뒤 cross re-review에서 unresolved/new P0–P3 0, 최종 verdict PASS를 받았다.

## Completion Notes

- exact first run `31138692455`는 Windows CRLF test 2건과 cleanup module parser에서 실패했고 production/installed E2E·artifact는 실행되지 않았다.
- 두 visual contract source reader가 CRLF/CR을 LF로 정규화하며, PowerShell wait literal은 `15000`으로 수정했다.
- Windows host-safety가 repo E2E PowerShell을 recursive native parser로 검사하고 local harness mutation이 decimal underscore 회귀를 pre-push에서 차단한다.
- full local QA, actual macOS full app E2E, Windows MSVC projection과 세 독립 리뷰를 통과했다.
- 이 완료 plan은 수정 commit을 main에 반영하기 위한 lifecycle을 닫는다. 새 exact commit의 hosted Windows production/install/E2E/artifact acceptance는 Plan-015가 소유한다.
