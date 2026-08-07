# plan-016-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-015가 수정 main commit의 hosted Windows acceptance를 Plan-016으로 명시했다.
- 승인 범위: exact main `b073398eab256051ff9a3edcabba8a9d173890c1`의 자동 `windows-2025` run, native PowerShell/NTFS/Rust/NSIS/installed E2E/cleanup과 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 GitHub `windows-2025` cross-layer QA와 recursive PowerShell parser를 실제 실행한다.
- production x64 current-user NSIS build/install/window launch/uninstall과 app data·shared WebView2 보존을 검증한다.
- private E2E NSIS의 installed exact executable로 합성 UI/native/restart/import/export/backup/restore suite와 Windows NTFS tests를 실행한다.
- cleanup success와 production-only exact three-file artifact metadata/checksum/evidence를 대사한다.
- 실패가 있으면 failure/NOT RUN을 유지하고 원인·수정·QA·독립 리뷰 후 다음 exact-commit plan으로 넘긴다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-016-windows-hosted-acceptance`와 `.worktree/plan-016-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 검사하며 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `b073398eab256051ff9a3edcabba8a9d173890c1`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] 실패 run의 artifact 0건과 upload skipped를 확인하고 successful-run allowlist 대사는 NOT RUN으로 유지
- [x] failure root cause와 NOT RUN 경계 기록, 최소 수정과 전체 QA 수행
- [x] hosted outcome 문서, 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual PowerShell recursive parse, junction sentinel, registry views와 shared WebView2 `pv` preservation 확인
- Windows Rust default/all-features, NTFS HANDLE-relative CRUD, identity-swap, symlink/junction와 FlushFileBuffers 확인
- production NSIS exact x64/config/feature/marker/hash, silent lifecycle, launch와 owned-residue/app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema 대사
- 수정 시 `npm run qa`, Rust default/all-features/fmt/Clippy, Windows MSVC cross-check와 actual macOS E2E 재실행

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup 단계가 success다.
2. production current-user/offline NSIS가 실제 설치·창 실행·제거되고 user data와 shared WebView2 `pv`가 보존된다.
3. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
4. Windows NTFS HANDLE/reparse/name-swap/FlushFileBuffers tests와 external-sentinel cleanup control이 통과한다.
5. successful non-PR artifact 하나가 exact production 3-file allowlist만 포함하고 checksum/evidence가 일치한다.
6. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/filesystem reviewer가 exact commit binding, step/result 해석, checksum/allowlist, 개인정보 경계와 잔여 주장 범위를 검토한다. 수정이 생기면 작성자가 아닌 reviewer가 코드도 재검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-015 fix commit의 automatic main push run만 authoritative하게 사용 | validated tree와 hosted tree를 exact SHA로 결속 |
| 2026-08-07 | successful artifact는 내용 검사 후에도 원본을 저장소나 문서에 복사하지 않음 | 설치물과 runtime data의 보관·개인정보 경계를 유지 |
| 2026-08-07 | automatic run `31143343159`를 authoritative attempt로 결속 | main push, exact full SHA와 workflow identity가 evidence contract에 일치 |
| 2026-08-07 | registry logic PASS 뒤 CP1252 stdout의 Unicode arrow encode failure를 cross-layer root cause로 분류 | authenticated failed log가 checksum PASS 다음 summary print의 `UnicodeEncodeError`와 exact code point를 확인 |
| 2026-08-07 | database CLI 성공 문구를 ASCII로 제한하고 강제 CP1252 subprocess control을 추가 | CLI 자체를 Windows code-page-safe하게 유지하며 workflow-wide UTF-8 mode가 파일·subprocess decoding을 바꾸는 범위 확장을 피함 |
| 2026-08-07 | 별도 `run_review.py` 누락-evidence 오류의 한글 보간은 이번 hosted blocker에서 제외 | Windows workflow와 `npm run qa` 정상 경로가 호출하지 않는 failure-only developer diagnostic이며 current fix scope를 확장하지 않음 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-015 fix `b073398`을 main에 fast-forward·push하고 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-016 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31143343159`가 exact `b073398eab256051ff9a3edcabba8a9d173890c1`, main push event로 시작된 것을 확인했다. |
| 2026-08-07 | quality_runner | run `31143343159`, job `92757646610`은 Vitest 83/366, Prisma validate와 migration registry logic까지 PASS한 뒤 CP1252가 `↔` summary를 encode하지 못해 cross-layer QA가 실패했다. cleanup·summary는 success, 후속 Windows 검증은 skipped, artifact는 0건이다. |
| 2026-08-07 | harness_builder | database success summary를 ASCII renderer로 모으고 registry CLI를 강제 CP1252 bytes로 실행하며 full summary의 ASCII contract를 검사하는 control을 추가했다. |
| 2026-08-07 | quality_runner | final local full QA, Rust all-features/fmt/Clippy, Windows MSVC projection, audit, encoding mutations와 승인된 실제 macOS full E2E를 모두 통과했다. |
| 2026-08-07 | review_judge | encoding/control, hosted run evidence, scope/privacy 독립 심사 3개가 P0–P3 finding 없이 PASS했다. |
| 2026-08-07 | doc_gardener | hosted 실패와 새 수정 commit의 NOT RUN 경계를 유지한 완료 계획과 동일 번호 리뷰를 작성했다. |

## QA Evidence

- local remediation result: PASS
- hosted Windows acceptance: FAIL — run [31143343159](https://github.com/taejun9/bodam/actions/runs/31143343159), job `92757646610`, main push, attempt 1, exact `b073398eab256051ff9a3edcabba8a9d173890c1`, `windows-2025`
- hosted boundary: dependencies success; cross-layer QA failure; host safety, Windows Rust, production lifecycle, installed E2E skipped; cleanup·summary success; upload skipped; artifact 0
- authenticated read-only failed log: lint/typecheck, Vitest 83/366, Prisma validate와 migration registry logic PASS 뒤 success summary의 U+2194를 CP1252 stdout이 encode하지 못해 `UnicodeEncodeError`; database contract exit 1
- focused reproduction: `PYTHONIOENCODING=cp1252` registry CLI는 원본에서 PASS header 뒤 동일 exception/exit 1, ASCII summary 뒤 exit 0
- regression controls: registry CLI를 forced CP1252 subprocess bytes로 실행해 exit 0와 ASCII stdout/stderr를 요구하고 full summary renderer도 ASCII를 요구한다. 첫째/둘째 arrow 복원은 exit/summary guard가, CP1252-compatible `é` mutation은 ASCII guard가 각각 탐지
- Python scan: hosted `npm run qa` 정상 경로의 non-CP1252 stdout은 제거한 두 arrow뿐이며 workflow-wide UTF-8 mode는 적용하지 않았다.
- `npm run qa`: ESLint, Vue typecheck, Vitest 366, Prisma validate/registry/diff, Rust default 319, Vite production build, Tauri check, harness와 mutation controls PASS
- Rust: all-features 335/335, fmt check, all-target/all-feature Clippy `-D warnings` PASS
- Windows MSVC projection: stable rustup compiler, `x86_64-pc-windows-msvc`, tests/all-features, `RUSTFLAGS=-Dwarnings`, host SQLite pkg-config와 LLVM resource compiler no-link cross type-check PASS
- dependencies: `npm audit --audit-level=high` — vulnerability 0
- actual macOS `BODAM E2E.app`: 승인된 GUI 환경의 `npm run test:e2e` overall exit 0; customer/policy/coverage/benchmark/family/consultation/dashboard/schedule/calendar, restart, XLSX/CSV import/export/round-trip/rollback, backup/restore/reauthorization/exit/idempotency PASS
- expected-process boundary: restore와 exit child WDIO의 process-level FAILED는 의도된 restart/exit이며 상위 runner가 marker, archive, logical DB snapshot과 residue를 대사한 뒤 exit 0
- final checks: modified files 300 lines 미만, sensitive artifact scan, review-state prerequisites와 `git diff --check` PASS

## Review Findings

- encoding/control reviewer: P0–P3 0. registry-only/full 성공 문구가 ASCII이고 forced CP1252 CLI가 exit 0이며, 두 arrow와 CP1252-compatible `é` mutation을 각각 탐지함을 확인했다.
- hosted evidence reviewer: P0–P3 0. run/job/SHA/attempt, cross-layer failure, 후속 skipped, cleanup·summary success, artifact 0과 인증 로그의 U+2194 root cause를 독립 대사했다.
- scope/privacy reviewer: P0–P3 0. full QA와 실제 macOS E2E를 재확인하고 hosted/local·child/upper-runner 경계, 300줄 제한과 민감정보 비노출을 확인했다.
- final verdict: PASS with residual risk. 새 수정 commit의 hosted Windows acceptance는 Plan-017 전까지 NOT RUN이다.

## Completion Notes

- exact run `31143343159`는 Vitest 366과 migration registry logic까지 통과한 뒤 CP1252 stdout이 성공 문구의 U+2194를 encode하지 못해 실패했다. 후속 host/Rust/NSIS/installed E2E/upload는 skipped, cleanup·summary는 success, artifact는 0이다.
- database CLI 성공 문구를 ASCII renderer로 단일화하고 실제 registry CLI를 forced CP1252 bytes로 검증하는 회귀 control을 추가했다. workflow-wide UTF-8 mode는 적용하지 않았다.
- final tree는 full QA, Rust 319/335, fmt/Clippy, Windows MSVC projection, audit 0, mutation controls와 승인된 실제 macOS full native E2E를 통과했고 독립 심사 3개에서 finding이 없었다.
- 완료 수정 commit의 자동 main run과 production NSIS/install/window/E2E/NTFS/cleanup/exact three-file artifact 대사는 Plan-017이 소유하며 그전까지 NOT RUN이다.
- `run_review.py`의 missing-evidence failure-only 한글 diagnostic hardening, Authenticode/SmartScreen과 WebView2 없는 network-blocked clean VM은 비차단 후속 또는 별도 권한·환경 범위다.
