# plan-022-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-021이 완료 commit의 automatic hosted acceptance를 후속 plan에 명시했다.
- 승인 범위: exact main `17f5f5755291483a25a33064f5bf196db0c06848`의 자동 `windows-2025` run, 실제 PowerShell/NTFS/Rust/NSIS production lifecycle/private installed E2E/cleanup과 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 automatic GitHub `windows-2025` run identity와 모든 step outcome을 결속한다.
- actual PowerShell이 새 readiness control, junction/continuation/dormant-code safety와 NSIS payload controls를 실행했는지 확인한다.
- production current-user NSIS의 실제 설치, roaming DB/daily backup 안정화, one normal close, exit 0, 정상 제거와 app-data/shared WebView2 보존을 확인한다.
- private installed exact executable의 합성 UI/native/restart/import/export/backup/restore suite를 확인한다.
- successful production-only artifact 하나의 exact three-file allowlist, checksum과 sanitized evidence를 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-022-windows-hosted-acceptance`와 `.worktree/plan-022-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run 또는 skipped step을 PASS evidence로 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `17f5f5755291483a25a33064f5bf196db0c06848`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows all-feature Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `launchSmokePassed: true`, `appDataPreserved: true`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 job identity 결속
- [x] 모든 검증 step·cleanup·summary·upload outcome 확인
- [x] actual PowerShell readiness controls와 production normal lifecycle 확인 — readiness controls PASS, lifecycle cleanup FAIL
- [x] private installed E2E complete synthetic suite 확인 — upstream failure로 SKIPPED / `NOT RUN`
- [x] production artifact metadata, exact inner allowlist/checksum/evidence 대사 — upload SKIPPED, artifacts 0 / `NOT RUN`
- [x] failure가 있으면 최소 원인 분석·수정 후 전체 QA와 독립 리뷰
- [x] 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual PowerShell recursive parse, junction sentinel, readiness positive/negative controls와 NSIS payload identity 확인
- Windows default/all-feature Rust, NTFS HANDLE-relative tests와 full cross-layer harness 확인
- production NSIS exact x64/config/feature/marker/payload, silent lifecycle, normal close와 app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema·값 대사

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup·upload 단계가 success다.
2. actual PowerShell이 readiness와 NSIS identity positive/negative controls를 통과한다.
3. production current-user/offline NSIS가 실제 설치·창 실행·정상 종료·제거되고 user data와 shared WebView2가 보존된다.
4. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
5. successful non-PR artifact 하나가 exact production 3-file allowlist만 포함하고 checksum/evidence가 일치한다.
6. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/filesystem reviewer가 exact commit binding, step/result 해석, checksum/allowlist, 두 executable hash와 개인정보 경계, 잔여 주장 범위를 검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-021 완료 commit의 automatic main push run만 authoritative하게 사용 | changed readiness/lifecycle와 exact source digests를 reviewed tree와 SHA로 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-021 `17f5f5755291483a25a33064f5bf196db0c06848`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-022 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic push run `31160070617`, attempt 1과 job `92808166405`를 exact SHA, `main`, `windows-2025`에 결속했다. |
| 2026-08-07 | quality_runner | cross-layer, actual PowerShell controls, all-feature Rust와 production build PASS 뒤 lifecycle cleanup lock FAIL을 확인하고 후속 private E2E/artifact를 `NOT RUN`으로 경계 지었다. |
| 2026-08-07 | project_lead | 설치 앱 실행 뒤 outer lifecycle cleanup에서 관찰된 WebView2 app-owned `Rules` log의 transient handle을 광범위 process kill 없이 exact-tree bounded cleanup으로 처리하는 최소 수정을 Plan-022가 소유하도록 결정했다. 정상 exit/uninstall 완료 여부는 이 실패 run으로 입증하지 않는다. |
| 2026-08-07 | harness_builder | exact sharing-violation만 20회×250ms 재시도하고 매 attempt direct-child/reparse 검사를 반복하며 다른 오류는 즉시 전파하는 cleanup과 native persistent/transient lock controls를 구현했다. |
| 2026-08-07 | quality_runner | focused mutation controls, 전체 QA, Rust all-features 335/335와 dependency audit 0건을 current tree에서 PASS했다. |
| 2026-08-07 | review_judge | 독립 harness 심사에서 fail-open cleanup probe와 workflow comment-decoy 허용 P2 두 건을 발견해 QA로 되돌렸다. evidence/privacy와 cleanup algorithm 심사는 추가 finding 없이 완료했다. |
| 2026-08-07 | harness_builder | exact `ItemNotFoundException`만 부재로 인정하는 probe/postcondition, native missing-drive control, exact active workflow `run:` binding과 comment-decoy mutation을 추가했다. |
| 2026-08-07 | quality_runner | review remediation 뒤 focused controls, 전체 QA, Rust all-features 335/335, dependency audit 0건과 diff check를 current tree에서 다시 PASS하고 재심사로 전환했다. |
| 2026-08-07 | review_judge | 재심사에서 YAML block-scalar `run:` decoy와 host-step skip/ignored-failure 활성화 우회를 같은 P2로 찾아 QA로 다시 되돌렸다. cleanup probe remediation은 해결로 판정했다. |
| 2026-08-07 | harness_builder | step mapping exact indentation, unconditional/fail-closed host step, reviewed workflow raw SHA-256과 block-comment/`if: false`/`continue-on-error` mutations로 activation 우회를 닫았다. |
| 2026-08-07 | quality_runner | 두 번째 review remediation 뒤 focused mutation controls와 전체 QA를 다시 PASS하고 최종 재심사로 전환했다. |

## QA Evidence

- authoritative automatic run: [run 31160070617](https://github.com/taejun9/bodam/actions/runs/31160070617), run number 19, attempt 1, `push`, branch `main`, head SHA `17f5f5755291483a25a33064f5bf196db0c06848`
- authoritative job: [job 92808166405](https://github.com/taejun9/bodam/actions/runs/31160070617/job/92808166405), `Current-user NSIS and installed application`, label `windows-2025`, GitHub-hosted runner group
- result: FAIL — run/job `completed/failure`, 2026-08-07T08:02:38Z–08:22:58Z
- setup and locked dependencies: PASS
- cross-layer QA: PASS, 08:04:46Z–08:13:13Z
- hosted cleanup/installer identity/production readiness actual PowerShell controls: PASS, 08:13:13Z–08:13:14Z
- Windows all-feature Rust: PASS, 08:13:14Z–08:16:12Z
- unsigned production NSIS build: PASS, 08:16:12Z–08:21:09Z
- production lifecycle: FAIL, 08:21:09Z–08:22:44Z — lifecycle `finally`에서 app-owned WebView2 `Rules` log의 transient file handle 때문에 exact tree `Remove-Item`이 실패했다. runner full path는 기록하지 않는다.
- private E2E build and installed full E2E: SKIPPED / `NOT RUN`
- unconditional exact app-owned cleanup and hosted boundary summary: PASS; production normal lifecycle PASS로 확대하지 않는다.
- artifact upload: SKIPPED; artifacts 0, allowlist/checksum/evidence acceptance `NOT RUN`
- result: PASS — Plan-022 current-tree remediation local gate; exact sharing-violation bounded retry, native persistent/transient control contract와 문서/source mutation controls 통과. Windows-only 실행을 PASS로 확대하지 않는다.
- focused Windows cleanup/release contract controls: PASS
- post-remediation local full QA: PASS — `npm run qa`; ESLint/typecheck, frontend 83 files/366 tests, Prisma validate/registry/diff, Rust 319/319, Vite production build, Tauri check와 full harness
- post-remediation local all-feature Rust: PASS — 335/335 tests
- post-remediation dependency audit: PASS — vulnerabilities 0
- post-review-remediation focused Windows release and mutation controls: PASS — fail-open probe와 workflow comment-decoy synthetic mutations가 거부됨
- post-review-remediation local full QA: PASS — frontend 83 files/366 tests, Rust default 319/319, DB contract, production build, Tauri check와 full harness
- post-review-remediation local all-feature Rust: PASS — 335/335 tests
- post-review-remediation dependency audit and diff check: PASS — vulnerabilities 0, whitespace errors 0
- post-second-review-remediation workflow controls: PASS — block-scalar exact-line/block-comment, conditional skip와 ignored-failure mutations가 모두 거부됨
- post-second-review-remediation local full QA: PASS — frontend 83 files/366 tests, Rust default 319/319, DB contract, build, Tauri check와 full harness
- actual new PowerShell native lock controls, production lifecycle, private installed E2E와 artifact acceptance: `NOT RUN` locally — macOS에는 PowerShell/NTFS/installed Windows binary가 없으며 reviewed fix commit의 후속 exact `windows-2025` run이 실행 증거를 소유한다.

## Review Findings

- P2 / resolved — `Remove-BodamOwnedTree`의 `Get-Item -ErrorAction SilentlyContinue`
  존재 probe가 접근·provider 오류를 대상 부재로 오인할 수 있었다. 정확한
  `ItemNotFoundException`만 부재로 인정하는 fail-closed probe/postcondition과
  native·mutation controls를 추가한 뒤 전체 QA와 재심사한다.
- P2 / resolved — workflow의 hosted control 호출 검사가 step block substring만
  확인해 주석 decoy와 synthetic bypass를 거부하지 못했다. exact active run command와
  comment-decoy mutation control로 실제 `test-windows-host-safety.ps1` 실행을 결속한 뒤
  전체 QA와 재심사한다.
- P2 / resolved — 첫 remediation의 `^\s*run:` 검사가 YAML step mapping field와
  block-scalar 본문 속 `run:` decoy를 구분하지 못했다. step header 기준 exact field
  indentation, exact reviewed workflow digest, block-scalar exact-line/block-comment
  decoy mutations와 host step의 `if`/`continue-on-error` 금지를 추가한 뒤 전체 QA와
  다시 재심사한다.
- Final verdict — evidence/lifecycle/privacy, Windows cleanup, adversarial harness의
  최종 독립 재심사가 모두 P0 0/P1 0/P2 0/P3 0으로 승인했다.

## Completion Notes

- authoritative baseline run은 production lifecycle의 app-owned WebView2 UDF transient
  sharing violation에서 FAIL했고 normal exit/uninstall, private installed E2E와 artifact
  acceptance는 `NOT RUN`이었다.
- exact sharing violation만 bounded retry하고 exact not-found만 부재로 인정하도록
  fail-closed cleanup을 수정했으며 native persistent/transient/provider controls와
  adversarial workflow activation controls를 추가했다.
- current tree는 반복 전체 QA, Rust all-features 335/335, audit 0건, focused mutations,
  review prerequisite와 세 독립 최종 심사를 통과했다.
- 수정된 actual PowerShell/NTFS lifecycle, private installed UI/native E2E와 production
  three-file artifact acceptance는 완료 commit의 automatic main-push run을 소유할
  Plan-023에 인계하며 이 plan에서 PASS로 확대하지 않는다.
