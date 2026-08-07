# plan-019-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-018이 native Windows relative rename 수정 main commit의 hosted acceptance를 Plan-019로 명시했다.
- 승인 범위: exact main `407149f5dcc078632f105379702fb391d1caa223`의 자동 `windows-2025` run, native PowerShell/NTFS/Rust/NSIS/installed E2E/cleanup과 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 GitHub `windows-2025` cross-layer QA와 recursive PowerShell parser를 실제 실행한다.
- Windows default/all-feature Rust에서 native pinned-directory rename, overwrite, HANDLE/reparse/name-swap와 FlushFileBuffers tests를 실행한다.
- production x64 current-user NSIS build/install/window launch/uninstall과 app data·shared WebView2 보존을 검증한다.
- private E2E NSIS의 installed exact executable로 합성 UI/native/restart/import/export/backup/restore suite를 실행한다.
- cleanup success와 production-only exact three-file artifact metadata/checksum/evidence를 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-019-windows-hosted-acceptance`와 `.worktree/plan-019-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `407149f5dcc078632f105379702fb391d1caa223`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows all-feature Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] successful production artifact 대사 — run failure로 upload가 skipped되어 artifact 0개, `NOT RUN`
- [x] checksum/evidence 대사 — production artifact가 없어 `NOT RUN`
- [x] repository 동적 진단 경로를 OS와 무관한 POSIX 저장소 상대 경로로 정규화
- [x] 전체 로컬 QA와 negative control 재검증
- [x] QA PASS 요약의 absolute worktree path를 안정된 scope label로 대체
- [x] worktree-flow 실패 진단의 absolute root를 제거하고 privacy negative control 추가
- [x] 독립 리뷰, 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- cross-layer frontend 366/database 계약과 Windows default 310 expected tests 확인
- actual PowerShell recursive parse, junction sentinel, registry views와 shared WebView2 `pv` preservation 확인
- Windows Rust default/all-features, NTFS HANDLE-relative overwrite/CRUD, identity-swap, symlink/junction와 FlushFileBuffers 확인
- production NSIS exact x64/config/feature/marker/hash, silent lifecycle, launch와 owned-residue/app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema 대사

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup 단계가 success다.
2. native pinned-directory rename이 stale target을 교체하고 junction name-swap 뒤 original identity에만 적용된다.
3. production current-user/offline NSIS가 실제 설치·창 실행·제거되고 user data와 shared WebView2 `pv`가 보존된다.
4. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
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
| 2026-08-07 | Plan-018 fix commit의 automatic main push run만 authoritative하게 사용 | validated tree와 hosted tree를 exact SHA로 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | automatic run `31148648177`을 authoritative attempt로 결속 | main push, attempt 1, exact full SHA와 workflow identity가 evidence contract에 일치 |
| 2026-08-07 | repository 동적 진단은 `/` 구분자의 저장소 상대 경로로 정규화 | Windows `Path` 문자열의 `\\`와 OS 독립 negative-control 계약의 `/` 불일치를 제거하고 로그를 안정화 |
| 2026-08-07 | QA PASS summary는 absolute root 대신 `current worktree` scope만 출력 | local username과 hosted runner 전체 경로를 로그에 남기지 않고 동일한 검증 의미를 유지 |
| 2026-08-07 | worktree mismatch 실패 진단도 expected relative location과 상태만 출력 | 실패 로그에서도 absolute checkout path를 노출하지 않고 privacy contract를 음성 대조로 고정 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-018 fix `407149f`를 main에 fast-forward·push하고 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-019 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31148648177`이 exact `407149f5dcc078632f105379702fb391d1caa223`, main push, attempt 1로 시작된 것을 확인했다. |
| 2026-08-07 | quality_runner | job `92773469878`은 Windows default Rust 310/310을 통과했지만 base harness의 nested backup 경로 negative control에서 실패했고 후속 release/E2E/upload가 skipped되었다. |
| 2026-08-07 | project_lead | 실패를 sensitive artifact 검출 누락이 아니라 Windows native separator로 출력된 진단과 POSIX 기대 문자열의 불일치로 국소화했다. |
| 2026-08-07 | harness_builder | repository의 줄 제한·주민번호 패턴·민감 산출물 동적 상대 경로 진단을 `.as_posix()`로 통일하고 OS 독립 negative-control 문자열은 유지했다. |
| 2026-08-07 | quality_runner | harness negative controls와 `npm run qa`의 frontend 366, Rust 319, Prisma/DB, build, Tauri, 전체 harness를 통과하고 audit 0·diff whitespace·Windows PurePath projection을 확인했다. |
| 2026-08-07 | plan_keeper | local remediation QA PASS를 기록하고 계획을 독립 review 상태로 전환했다. |
| 2026-08-07 | privacy_guard | QA PASS output의 absolute worktree path 노출 P3를 제기했고 stable scope label로 수정한 뒤 계획을 QA로 되돌렸다. |
| 2026-08-07 | quality_runner | privacy 수정 뒤 `npm run qa` 전체를 다시 실행해 frontend 366, Rust 319, DB/build/Tauri/harness가 모두 PASS하고 summary에 absolute root가 없음을 확인했다. |
| 2026-08-07 | plan_keeper | post-finding QA PASS 뒤 계획을 독립 재심사 상태로 전환했다. |
| 2026-08-07 | review_judge | 재심사에서 worktree-flow 실패 진단의 absolute root P3를 발견해 계획을 QA로 되돌렸다. |
| 2026-08-07 | privacy_guard | 실패 진단을 stable 상태 문구로 바꾸고 synthetic temporary root가 오류에 없는 negative control을 추가했다. |
| 2026-08-07 | quality_runner | 두 번째 privacy 수정 뒤 `npm run qa` 전체를 다시 실행해 366 frontend, 319 Rust, DB/build/Tauri와 새 root-redaction negative control이 모두 PASS했다. |
| 2026-08-07 | plan_keeper | post-finding 전체 QA PASS를 기록하고 최종 독립 재심사로 전환했다. |
| 2026-08-07 | review_judge | code/evidence/privacy 최종 재심사는 잔여 P0–P3 0건이며 hosted 후속 항목만 documented residual risk로 판정했다. |
| 2026-08-07 | doc_gardener | 두 resolved P3와 QA 재실행, hosted FAIL/NOT RUN 경계를 반영해 completed plan과 동일 번호 review mirror를 작성했다. |

## QA Evidence

- result: FAIL — [automatic run 31148648177](https://github.com/taejun9/bodam/actions/runs/31148648177), job `92773469878`, main push, attempt 1, exact `407149f5dcc078632f105379702fb391d1caa223`, runner `windows-2025`
- dependency setup: PASS
- cross-layer QA: FAIL — Vitest 83 files/366 tests, Prisma/database contract, Windows default Rust 310/310, Vite production build와 Tauri cargo check PASS; 이후 base harness만 `negative control did not detect: custom-recovery/BODAM-manual-synthetic.bodam-backup`으로 종료
- native Windows proof: `relative_crud_listing_and_file_identity_are_handle_bound`와 `selected_directory_name_swap_is_rejected_while_pinned_handle_stays_original` PASS
- root cause: detector가 만든 `Path` 진단은 Windows에서 `custom-recovery\\BODAM-...`이고 negative control은 OS 독립 `/` 경로를 기대해 substring 비교가 실패했다.
- hosted cleanup safety의 recursive PowerShell parse/junction sentinel, Windows all-feature Rust, production NSIS/lifecycle의 registry views/shared WebView2 보존, private/installed E2E와 upload: NOT RUN (steps skipped)
- unconditional exact app-owned state cleanup and evidence-summary: PASS
- artifacts: 0; successful artifact allowlist/checksum/evidence acceptance는 `NOT RUN`
- local remediation result: PASS
- focused regression: `python3 harness/scripts/test_harness.py` — nested backup path를 포함한 harness negative controls PASS
- full local QA: privacy 수정 전후 `npm run qa` — ESLint, Vue typecheck, Vitest 83/366, Prisma validate/registry/diff, Rust default 319, Vite production build, Tauri check와 full harness PASS
- log privacy regression: post-finding QA summary는 `repository scope: current worktree`만 출력하고 absolute root를 출력하지 않음
- failure-log privacy regression: synthetic unexpected-worktree control이 stable mismatch 문구는 검출하고 temporary absolute root가 오류에 없음을 확인
- portability projection: `PureWindowsPath(...).as_posix()`가 exact `custom-recovery/BODAM-manual-synthetic.bodam-backup` contract를 생성함
- dependencies and tree: `npm audit --audit-level=low` vulnerability 0, `git diff --check` PASS

## Review Findings

- resolved P3: 기존 `run_qa.py`의 PASS summary가 absolute worktree path를 출력해 계획의 full runner path 비기록 제약과 충돌했다. stable `current worktree` scope label로 교체하고 전체 QA를 재통과했다.
- resolved P3: worktree mismatch 실패 진단도 absolute root를 포함했다. stable expected-relative/status 문구와 root 비노출 negative control로 수정하고 전체 QA를 재통과했다.
- code reviewer: repository path normalization, PASS/FAIL root redaction과 negative control을 재심사해 잔여 P0–P3 0건으로 승인했다.
- evidence reviewer: exact hosted run/job/SHA, 310/310 PASS, downstream skipped, artifact 0과 local remediation PASS 경계를 재대사해 잔여 P0–P3 0건으로 승인했다.
- privacy reviewer: 고객 데이터·credential·raw runtime artifact 미포함, absolute root 비노출, 300줄 제한을 확인해 잔여 P0–P3 0건으로 승인했다.
- final verdict: PASS with documented residual risk. 새 commit의 actual Windows all-feature/NSIS/installed E2E/artifact acceptance는 후속 exact run 전까지 `NOT RUN`이다.

## Completion Notes

- authoritative run은 native Windows rename 수정과 Windows default Rust 310/310을 실기에서 검증했지만 harness 이식성 실패로 downstream acceptance를 완료하지 못했다.
- Windows native separator가 포함된 dynamic repo path를 POSIX 형식으로 고정하고, QA 성공·worktree 실패 로그의 absolute root를 제거했다. 실패 경로 비노출 negative control도 추가했다.
- 최종 tree는 focused controls와 전체 `npm run qa`, audit 0, diff 검사 및 독립 code/evidence/privacy 리뷰를 통과했다.
- 이 완료 commit의 automatic main run에서 Windows all-feature, host safety, production NSIS lifecycle, installed E2E와 exact three-file artifact를 확인하는 일은 Plan-020이 소유한다.
- Authenticode, SmartScreen reputation과 WebView2가 없는 network-blocked clean VM은 계속 별도 권한·환경 범위다.
