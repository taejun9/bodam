# plan-027-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-026이 completion commit의 automatic hosted acceptance를 Plan-027로 명시했다.
- 승인 범위: exact main `e42ad20d75acb9f33c5529f2397b25e3796089ee`의 automatic `windows-2025` run, corrected actual PowerShell/NSIS production lifecycle, private installed full E2E와 exact production artifact 다운로드 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact completion commit의 automatic GitHub `windows-2025` run identity와 모든 step outcome을 결속한다.
- corrected CLR ancestor, exact-three-newline와 parent-reparse PowerShell controls를 actual Windows에서 확인한다.
- production current-user install/launch/uninstall과 private installed exact executable의 합성 UI/native/restart/import/export/backup/restore suite를 확인한다.
- successful production artifact 하나의 exact three-file allowlist, checksum과 sanitized evidence를 다운로드해 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-027-windows-hosted-acceptance`와 `.worktree/plan-027-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run을 전체 PASS로 사용하지 않고 skipped step은 어떤 PASS에도 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact three-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `e42ad20d75acb9f33c5529f2397b25e3796089ee`의 main push event다.
- run/job success와 host safety, isolated npm trust, cross-layer QA, Windows all-feature Rust, production build/lifecycle, private E2E build/installed E2E, cleanup, summary와 upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `launchSmokePassed: true`, `appDataPreserved: true`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] Plan-027 branch/worktree와 exact-SHA evidence contract 생성
- [x] automatic run ID/URL, event, attempt와 Windows job identity 결속
- [x] trust, corrected PowerShell, QA, Rust, production/private lifecycle, cleanup, summary와 upload outcome 확인
- [x] installed exact executable의 suite 결과와 중단 뒤 `NOT RUN` 범위 기록
- [x] artifact upload skip·0개와 downloaded acceptance `NOT RUN` 기록
- [x] 최초 실패 최소 수정 후 전체 QA와 독립 리뷰
- [x] 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual isolated preflight와 corrected PowerShell recursive syntax/NSIS dependency mutations 확인
- Windows default/all-feature Rust, production/private NSIS build와 lifecycle 확인
- installed exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner allowlist/checksum/evidence schema·값 대사
- 다운로드 임시 디렉터리 삭제와 저장소 오염 부재 확인

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup·upload 단계가 success다.
2. corrected PowerShell이 rendered NSIS lexical/config/include/plugin/sign dependency positives와 terminal/ancestor reparse negatives를 통과한다.
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
| 2026-08-07 | Plan-026 completion commit의 automatic main push run만 authoritative하게 사용 | reviewed CLR/newline/reparse remediation을 실행 SHA에 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | production lifecycle PASS와 installed full E2E FAIL을 분리 | actual production 설치·실행·정상 종료·제거 증거를 보존하되 첫 spec 이후 미실행 범위를 승격하지 않음 |
| 2026-08-07 | 충돌 확인 후 unscoped Escape 대신 settled dialog의 scoped close 사용 | 저장 중 비활성 submit으로 active target이 dialog 밖으로 이탈할 수 있어 key dispatch가 종료 계약을 검증하지 못함 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-026 `e42ad20d75acb9f33c5529f2397b25e3796089ee`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-027 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | run `31185908075`, attempt 1, job `92890241298`을 exact SHA/main push/`windows-2025`에 결속했다. production lifecycle까지 PASS, installed full E2E FAIL, cleanup PASS, upload SKIPPED와 artifact 0개를 확인했다. |
| 2026-08-07 | review_judge | 최초 실패는 겹침 거절·행 수 보존 뒤 dialog 종료만 실패한 settlement/input-target 결함으로 추론했다. Family·Dashboard·Calendar는 연쇄 결과와 일치하지만 독립 결함 증거로 사용하지 않는다. |
| 2026-08-07 | harness_builder | submit pending을 dialog busy/dismiss-disabled에 결속하고 settled scoped close와 실제 AppDialog 회귀를 추가했으며 E2E trust hash chain을 갱신했다. |
| 2026-08-07 | quality_runner | 수정본 실제 앱 전체 E2E exit 0, all-features Rust 335/335와 문서 변경 포함 최종 `npm run qa`를 PASS했다. |
| 2026-08-07 | review_judge | code/dialog, evidence/privacy, trust/harness 독립 심사의 P2/P3 문구·계약 findings를 해결하고 의미 반전 mutation 8건과 최종 전체 QA를 PASS했다. |

## QA Evidence

- result: FAIL — [authoritative run 31185908075](https://github.com/taejun9/bodam/actions/runs/31185908075), attempt 1, job `92890241298`, main push, exact SHA `e42ad20d75acb9f33c5529f2397b25e3796089ee`, `windows-2025`, 2026-08-07T14:06:08Z–14:34:20Z
- result: PASS — checkout, corrected cleanup/PowerShell controls, isolated npm trust, setup, cross-layer QA, Windows all-feature Rust, production NSIS build/lifecycle, private NSIS build
- result: PASS — actual production current-user install, exact executable launch/readiness, main-window normal close, roaming DB/daily backup, uninstall, app-data/shared-WebView2 preservation
- result: FAIL — installed customer-write spec `2 PASS / 4 FAIL`; overlap rejection and one-row preservation passed, then global Escape failed to dismiss the dialog within 10 seconds
- result: NOT RUN — Windows restart/persistence, import/export, rollback, backup/restore; first spec failure stopped the suite
- result: PASS — failure-path exact app-owned cleanup and hosted evidence boundary
- result: NOT RUN — upload skipped, artifacts 0; artifact download/allowlist/checksum/evidence acceptance unavailable
- result: PASS — focused component regression 8/8, including pending→conflict→settled close→invoker-focus restoration
- result: PASS — modified actual local app full `npm run test:e2e`, including customer-write 6/6, restart persistence 4/4, XLSX/CSV round trips, rollback and backup/restore/exit contracts; orchestrator exit 0
- result: PASS — final modified `npm run qa`: frontend 83 files/367 tests, Rust default 319, build, Tauri check and full harness
- result: PASS — isolated Windows npm preflight plus node-spawn/npm/workflow/order contracts
- result: PASS — modified local Rust `cargo test --all-features`: 335 passed, 0 failed

## Review Findings

- 최초 원인 감사 2건은 backend 저장 실패가 아니라 submit 비활성화 뒤 unscoped key target이 dialog 계약과 결속되지 않은 E2E settlement/input-target 결함에 합의했다.
- resolved P2 — 로컬 macOS 증거를 installed-app으로 넓혀 쓴 문구와 cascade 단정을 actual-app bundle·inferred cascade 경계로 축소했다.
- resolved P3 — hosted run에서 관찰하지 않은 settled 상태와 잘못된 QA 날짜를 열린 dialog 관찰·실제 수행일로 교정했다.
- resolved P2 — exact SHA와 production PASS, installed FAIL, remaining `NOT RUN` 의미 반전이 loose token을 통과하던 문서 계약에 exact 결속과 양문서 8개 mutation을 추가했다.
- final code/dialog, evidence/privacy, trust/harness 재심: P0–P3 findings 없음.
- residual — 수정 흐름의 actual Windows 전체 E2E와 artifact 대사는 Plan-028 exact-commit run까지 `NOT RUN`이다.

## Completion Notes

- Plan-027은 실패 run의 실제 Windows 경계와 최소 수정 검증을 완료한 뒤 닫고, 수정 commit의 새 hosted run과 artifact 대사는 Plan-028이 소유한다.
