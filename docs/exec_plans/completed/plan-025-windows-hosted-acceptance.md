# plan-025-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-024가 corrected completion commit의 automatic hosted acceptance를 Plan-025로 명시했다.
- 승인 범위: exact main `1bd13f23520d75fe3e14d82cf7b4e9ea834626a6`의 자동 `windows-2025` run, corrected PowerShell/NSIS production lifecycle, private installed full E2E와 exact production artifact 다운로드 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 automatic GitHub `windows-2025` run identity와 모든 step outcome을 결속한다.
- isolated pre-npm trust, corrected actual PowerShell NSIS controls와 production lifecycle을 확인한다.
- private installed exact executable의 합성 UI/native/restart/import/export/backup/restore suite를 확인한다.
- successful production artifact 하나의 exact three-file allowlist, checksum과 sanitized evidence를 다운로드해 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-025-windows-hosted-acceptance`와 `.worktree/plan-025-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run을 전체 PASS로 사용하지 않고 skipped step은 어떤 PASS에도 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact three-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `1bd13f23520d75fe3e14d82cf7b4e9ea834626a6`의 main push event다.
- run/job success와 host safety, isolated npm trust, cross-layer QA, Windows all-feature Rust, production build/lifecycle, private E2E build/installed E2E, cleanup, summary와 upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `launchSmokePassed: true`, `appDataPreserved: true`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 Windows job identity 결속
- [x] direct trust, corrected PowerShell, QA, Rust, production/private lifecycle, cleanup, summary와 upload outcome 확인 — host safety FAIL, downstream SKIPPED
- [x] installed exact executable outcome 확인 — fixture 선행 FAIL로 설치·suite SKIPPED / `NOT RUN`
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
| 2026-08-07 | Plan-024 completion commit의 automatic main push run만 authoritative하게 사용 | reviewed trust/parser remediation을 실행 SHA에 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | rendered module은 caller가 먼저 로드한 dependency module을 module-qualified command로 사용하고 내부 `-Force` reload를 하지 않음 | nested reload가 caller scope의 exported hash helper를 제거한 actual PowerShell failure 해결 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-024 `1bd13f23520d75fe3e14d82cf7b4e9ea834626a6`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-025 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic run `31181536529`, attempt 1과 job `92875742049`를 exact SHA, main push와 `windows-2025`에 결속했다. |
| 2026-08-07 | quality_runner | hosted cleanup retry, installer identity와 launch readiness controls는 PASS했지만 새 rendered NSIS fixture가 normalized hash helper 미인식으로 FAIL했다. Npm trust와 모든 setup/build/install/E2E/upload는 skipped, summary는 PASS, trust-gated cleanup도 안전하게 skipped됐다. |
| 2026-08-07 | harness_builder | dependency module을 caller와 rendered module이 연속 `-Force` reload해 exported caller command가 제거되는 원인으로 국소화하고, internal reload 제거와 module-qualified dependency call로 수정했다. |
| 2026-08-07 | quality_runner | qualified dependency wiring과 nested-reload/unqualified-call mutations 뒤 Windows focused controls와 full npm QA(frontend 83/366, Rust default 319, Prisma/build/Tauri/full harness)를 PASS하고 review로 전환했다. Actual corrected PowerShell은 다음 run까지 `NOT RUN`이다. |
| 2026-08-07 | review_judge | durable Windows 증거 문서가 Plan-024에 머문 P3를 찾아 actual Plan-025 scoped PASS/fixture FAIL/downstream SKIPPED/artifacts 0과 새 wiring `NOT RUN` 경계로 교정했다. |
| 2026-08-07 | quality_runner | 문서 remediation 뒤 focused contract, full npm QA, base QA, review prerequisites와 diff check를 재실행해 모두 PASS했다. |
| 2026-08-07 | review_judge | evidence/lifecycle, installer/privacy/security와 adversarial harness 세 독립 최종 재심사가 최신 tree에 남은 P0–P3 없음으로 승인했다. |

## QA Evidence

- authoritative run: [run 31181536529](https://github.com/taejun9/bodam/actions/runs/31181536529), attempt 1, `push`, branch `main`, head SHA `1bd13f23520d75fe3e14d82cf7b4e9ea834626a6`, `completed/failure`, 2026-08-07T13:12:07Z–13:12:31Z
- authoritative job: [job 92875742049](https://github.com/taejun9/bodam/actions/runs/31181536529/job/92875742049), `Current-user NSIS and installed application`, `windows-2025`
- checkout, actual bounded cleanup retry, installer identity와 production launch readiness controls: PASS
- rendered NSIS PowerShell fixture: FAIL — dependency module의 nested forced reload 뒤 caller scope에서 normalized hash helper를 찾지 못함
- isolated npm trust, dependency setup, cross-layer QA, Windows Rust, production/private build/lifecycle, installed E2E와 upload: SKIPPED / `NOT RUN`
- trust-gated cleanup: SKIPPED as designed because npm trust did not run; hosted summary: PASS
- upload: SKIPPED; artifacts 0; downloaded artifact acceptance `NOT RUN`
- local remediation result: PASS
- local remediation full npm QA: PASS — Node actual subprocess, lint/typecheck, frontend 83 files/366 tests, Prisma validation·migration diff, Rust default 319 tests, Vite build, Tauri check와 full repository/Windows mutation harness
- final focused Windows contract, base QA, review prerequisites와 `git diff --check`: PASS
- independent final review: evidence/lifecycle, installer/privacy/security, adversarial harness 모두 P0 0/P1 0/P2 0/P3 0
- corrected module wiring은 새 exact commit의 Windows run 전까지 `NOT RUN`

## Review Findings

- P1 / resolved in QA — dependency module을 두 scope에서 연속 `-Force` reload해 caller의 exported helper를 제거했다. Rendered module internal reload를 없애고 caller-loaded module command를 qualified name으로 호출하며 focused/full QA를 PASS했다.
- P3 / resolved in QA — durable Windows evidence 문서가 Plan-024 결과만 기록해 corrected commit의 actual FAIL을 `NOT RUN`으로 남겼다. Plan-025 scoped PASS, fixture FAIL, downstream SKIPPED, artifacts 0과 새 wiring만의 `NOT RUN` 경계를 고정했다.
- Final verdict — 세 독립 재심사가 최신 tree를 P0 0/P1 0/P2 0/P3 0으로 승인했다.

## Completion Notes

- authoritative run `31181536529`은 checkout과 bounded cleanup retry, installer identity, production launch readiness까지만 scoped PASS했고 rendered PowerShell fixture에서 FAIL했다.
- npm trust 이후 setup/QA/Rust/build/install/installed E2E/upload는 SKIPPED, artifacts 0이며 installed UI/native suite와 artifact download acceptance는 `NOT RUN`이다.
- nested forced reload를 제거하고 dependency command를 module-qualified name으로 호출하는 수정과 immutable mutations는 full QA와 세 독립 리뷰를 PASS했다. 새 wiring의 actual PowerShell 실행은 아직 `NOT RUN`이다.
- completion commit의 automatic main-push run과 full installed/artifact acceptance는 Plan-026이 exact SHA로 소유한다.
