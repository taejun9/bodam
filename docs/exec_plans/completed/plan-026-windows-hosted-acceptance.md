# plan-026-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-025가 completion commit의 automatic hosted acceptance를 Plan-026으로 명시했다.
- 승인 범위: exact main `a5a0bd9bf640c5ed416ba4100de2da2b48f29208`의 자동 `windows-2025` run, corrected module-qualified PowerShell/NSIS production lifecycle, private installed full E2E와 exact production artifact 다운로드 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 automatic GitHub `windows-2025` run identity와 모든 step outcome을 결속한다.
- isolated pre-npm trust, corrected actual module-qualified PowerShell NSIS controls와 production lifecycle을 확인한다.
- private installed exact executable의 합성 UI/native/restart/import/export/backup/restore suite를 확인한다.
- successful production artifact 하나의 exact three-file allowlist, checksum과 sanitized evidence를 다운로드해 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-026-windows-hosted-acceptance`와 `.worktree/plan-026-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run을 전체 PASS로 사용하지 않고 skipped step은 어떤 PASS에도 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact three-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `a5a0bd9bf640c5ed416ba4100de2da2b48f29208`의 main push event다.
- run/job success와 host safety, isolated npm trust, cross-layer QA, Windows all-feature Rust, production build/lifecycle, private E2E build/installed E2E, cleanup, summary와 upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `launchSmokePassed: true`, `appDataPreserved: true`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 Windows job identity 결속
- [x] direct trust, corrected PowerShell, QA, Rust, production/private lifecycle, cleanup, summary와 upload outcome 확인 — host safety FAIL, downstream SKIPPED
- [x] installed exact executable outcome 확인 — host-safety 선행 FAIL로 설치·suite SKIPPED / `NOT RUN`
- [x] artifact outcome 확인 — upload SKIPPED, artifacts 0, 다운로드 대사 `NOT RUN`
- [x] 실패가 있으면 최소 원인 분석·수정 후 전체 QA와 독립 리뷰
- [x] 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual isolated preflight와 PowerShell recursive syntax/NSIS dependency mutations 확인
- Windows default/all-feature Rust, production/private NSIS build와 lifecycle 확인
- installed exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner allowlist/checksum/evidence schema·값 대사
- 다운로드 임시 디렉터리 삭제와 저장소 오염 부재 확인

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup·upload 단계가 success다.
2. corrected PowerShell이 rendered NSIS lexical/config/include/plugin/sign dependency positives와 negatives를 통과한다.
3. production current-user/offline NSIS가 실제 설치·창 실행·정상 종료·제거되고 user data와 shared WebView2가 보존된다.
4. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
5. successful non-PR artifact 하나가 exact production three-file allowlist만 포함하고 checksum/evidence가 일치한다.
6. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/privacy reviewer가 exact commit binding, step/result 해석, downloaded checksum/allowlist, 두 executable hash와 잔여 주장 범위를 검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-025 completion commit의 automatic main push run만 authoritative하게 사용 | reviewed module-scope remediation을 실행 SHA에 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | plugin ancestor는 raw `DirectoryInfo` type/attribute로 검사하고 newline concatenation은 괄호로 묶어 exact 세 scalar를 요구 | provider-added property와 comma precedence에 의존한 두 actual/latent false negative 제거 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-025 `a5a0bd9bf640c5ed416ba4100de2da2b48f29208`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-026 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31182975142`, attempt 1과 job `92880515158`를 exact SHA, main push와 `windows-2025`에 결속했다. |
| 2026-08-07 | quality_runner | bounded cleanup retry, installer identity와 launch readiness controls는 PASS했지만 rendered NSIS fixture가 generic exact-form 오류로 FAIL했다. Npm trust와 모든 setup/build/install/E2E/upload는 skipped, summary 기록은 success, artifacts 0이다. |
| 2026-08-07 | harness_builder | official portable PowerShell 7.6.4로 generic failure를 재현하고 module-qualified call이 dependency에 진입함을 확인했다. Raw parent `DirectoryInfo`의 provider property 조회 P1과 comma-precedence가 newline vector를 5개로 쪼개는 잠재 P1을 수정했다. |
| 2026-08-07 | quality_runner | exact three newline scalar, parent plugin reparse negative와 immutable mutations를 보강하고 portable PowerShell rendered controls, focused Windows contract와 base QA를 PASS했다. Corrected actual Windows는 다음 run까지 `NOT RUN`이다. |
| 2026-08-07 | quality_runner | full npm QA(frontend 83/366, Rust default 319, Prisma/build/Tauri/full harness)를 PASS하고 review로 전환했다. |
| 2026-08-07 | quality_runner | hosted Rust surface와 같은 local `--all-features` 335/335를 추가 PASS했다. |
| 2026-08-07 | review_judge | hosted generic 오류와 local portable trace의 원인 귀속을 섞은 P3와 `NOT RUN` exact 문구 줄바꿈으로 focused contract가 실패한 P1을 찾아 문서 경계를 교정했다. |
| 2026-08-07 | quality_runner | 교정 뒤 focused Windows contract와 full npm QA, review prerequisites, diff check를 모두 재실행해 PASS했다. |
| 2026-08-07 | review_judge | evidence, PowerShell root-cause와 adversarial harness의 세 독립 최종 재심사가 최신 tree의 P0–P3 없음으로 승인했다. |

## QA Evidence

- authoritative run: [run 31182975142](https://github.com/taejun9/bodam/actions/runs/31182975142), attempt 1, `push`, branch `main`, head SHA `a5a0bd9bf640c5ed416ba4100de2da2b48f29208`, `completed/failure`, 2026-08-07T13:30:43Z–13:31:06Z
- authoritative job: [job 92880515158](https://github.com/taejun9/bodam/actions/runs/31182975142/job/92880515158), `Current-user NSIS and installed application`, `windows-2025`
- checkout, actual bounded cleanup retry, installer identity와 production launch readiness controls: PASS
- module-qualified rendered NSIS PowerShell fixture: FAIL — `rendered NSIS contract is not the exact approved form`; 세부 assertion은 normalized generic error 때문에 이 run만으로 확정하지 않음
- isolated npm trust, dependency setup, cross-layer QA, Windows Rust, production/private build/lifecycle, installed E2E와 upload: SKIPPED / `NOT RUN`
- trust-gated cleanup: SKIPPED as designed because npm trust did not run; hosted summary 기록 step: PASS
- upload: SKIPPED; artifacts 0; downloaded artifact acceptance `NOT RUN`
- local remediation PowerShell 7.6.4 rendered controls: PASS — temporary non-Windows junction shim을 사용했으므로 Windows junction evidence로 확대하지 않음
- local focused Windows contract, parent-type/newline/reparse mutations와 base QA: PASS
- local remediation full npm QA result: PASS — Node actual subprocess, lint/typecheck, frontend 83 files/366 tests, Prisma validation·migration diff, Rust default 319 tests, Vite build, Tauri check와 full repository/Windows mutation harness
- local Rust `--all-features`: PASS — 335/335 tests
- final focused Windows contract, review prerequisites와 `git diff --check`: PASS
- independent final review: evidence, PowerShell root-cause와 adversarial harness 모두 P0 0/P1 0/P2 0/P3 0
- corrected CLR-type/newline wiring의 actual Windows fixture는 새 exact commit run 전까지 `NOT RUN`

## Review Findings

- P1 / resolved in QA — `Get-Item`의 provider-added `PSIsContainer`를 `.Parent`가 반환한 raw `DirectoryInfo`에도 요구해 valid plugin ancestor가 두 번째 반복에서 실패했다. CLR type/attribute 검사와 parent reparse negative를 추가했다.
- P1 / resolved in QA — comma precedence가 intended LF/CRLF/CR concatenation보다 먼저 적용돼 fixture가 3개가 아닌 5개 요소가 됐다. Concatenation을 괄호로 묶고 exact three scalar assertion과 immutable mutations를 추가했다.
- P3 / resolved in QA — durable 문서가 hosted generic 오류와 local portable trace의 dependency 진입을 한 문장에 귀속했다. Hosted는 generic FAIL만, 원인 국소화는 local trace만 주장하고 non-Windows shim을 Windows junction 증거로 확대하지 않도록 분리했다.
- P1 / resolved in QA — 문서 줄바꿈이 exact `actual Windows result remains NOT RUN` 계약을 끊어 focused checker가 실패했다. 의미를 유지한 채 exact boundary를 한 줄에 복구하고 full QA를 재실행했다.
- Final verdict — 세 독립 재심사가 최신 tree를 P0 0/P1 0/P2 0/P3 0으로 승인했다.

## Completion Notes

- authoritative exact run `31182975142`는 checkout과 bounded cleanup retry, installer identity, production launch readiness까지만 scoped PASS했고 rendered NSIS fixture에서 generic exact-form 오류로 FAIL했다.
- npm trust 이후 setup/QA/Rust/build/install/installed E2E/upload는 SKIPPED, artifacts 0이며 installed UI/native suite와 artifact download acceptance는 `NOT RUN`이다.
- raw ancestor를 CLR type/attribute로 검사하고 LF/CRLF/CR을 exact three scalar로 묶으며 parent reparse negative를 추가한 수정은 portable PowerShell control, full npm QA, Rust `--all-features`와 세 독립 리뷰를 PASS했다.
- corrected actual Windows fixture와 downstream installed/artifact acceptance는 아직 `NOT RUN`이며 completion commit의 automatic main-push run을 Plan-027이 exact SHA로 소유한다.
