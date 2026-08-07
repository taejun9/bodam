# plan-028-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-08
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-027 completion notes가 remediation commit의 automatic hosted acceptance를 Plan-028에 배정했다.
- 승인 범위: exact main `37a5031ce2e107cd36628e54b18c63f6ea417022`의 automatic `windows-2025` run, production install lifecycle, corrected installed full E2E와 exact production artifact 다운로드 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- remediation completion commit의 automatic GitHub `windows-2025` run identity와 모든 step outcome을 결속한다.
- production current-user install/launch/uninstall과 private installed exact executable의 전체 합성 UI/native/restart/import/export/backup/restore suite를 확인한다.
- successful production artifact 하나의 exact three-file allowlist, checksum과 sanitized evidence를 다운로드해 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-028-windows-hosted-acceptance`와 `.worktree/plan-028-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run을 전체 PASS로 사용하지 않고 skipped step은 어떤 PASS에도 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact three-file artifact만 권한 제한된 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- artifact zip은 실행하지 않고 exact root regular entry, encryption, checksum, evidence schema와 metadata만 검사한 뒤 임시 파일을 삭제한다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `37a5031ce2e107cd36628e54b18c63f6ea417022`의 main push event다.
- run/job success와 host safety, isolated npm trust, cross-layer QA, Windows all-feature Rust, production build/lifecycle, private E2E build/installed E2E, cleanup, summary와 upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 root regular·unencrypted 파일만 포함해야 한다.
- GitHub artifact metadata는 exact run/branch/SHA, positive id/size, 7-day expiry와 non-expired status를 요구하며 API zip digest를 다운로드 bytes와 대사한다.
- checksum text, streamed installer SHA-256/bytes와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 strict 24-key schema, 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `launchSmokePassed: true`, `appDataPreserved: true`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] Plan-028 branch/worktree와 exact-SHA evidence contract 생성
- [x] automatic run ID/URL, event, attempt와 Windows job identity 결속
- [x] 모든 Windows step과 corrected installed complete suite outcome 확인
- [x] exact production artifact metadata/zip/allowlist/checksum/evidence 대사 후 임시 파일 삭제
- [x] 저장소 runtime 오염과 개인정보 경계 확인
- [x] hosted failure 부재 확인, 최종 전체 QA와 독립 리뷰
- [x] 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual isolated preflight, corrected dialog flow, Windows Rust, production/private NSIS lifecycle 확인
- installed exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, zip root allowlist/encryption/checksum/evidence schema·값 대사
- 다운로드 임시 디렉터리 삭제와 저장소 `runtime-data`/`.runtime` 오염 부재 확인

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup·upload 단계가 success다.
2. production current-user/offline NSIS가 실제 설치·창 실행·정상 종료·제거되고 user data와 shared WebView2가 보존된다.
3. private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
4. conflict rejection 뒤 busy 해제·scoped close·invoker focus 복원이 actual installed Windows에서 통과한다.
5. successful non-PR artifact 하나가 exact production three-file allowlist만 포함하고 metadata/checksum/evidence가 일치한다.
6. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer, installer/privacy reviewer와 trust-harness reviewer가 exact commit binding, step/result 해석, downloaded checksum/allowlist, 두 executable hash와 잔여 주장 범위를 검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-08 | Plan-027 remediation completion commit의 automatic main push run만 authoritative하게 사용 | reviewed dialog settlement와 fail-closed evidence controls를 실행 SHA에 결속 |
| 2026-08-08 | artifact zip은 권한 제한 임시 디렉터리에서 비실행 stream 대사 후 삭제 | production installer를 실행·저장소 복사·재게시하지 않고 artifact 및 개인정보 경계를 검증 |
| 2026-08-08 | 종료형 WDIO reporter `FAILED` 네 건은 개별 실패로 세지 않고 상위 orchestrator 계약과 후속 검증으로 판정 | 의도한 앱 종료·재시작이 session을 끝내며 전체 installed step success가 phase marker·논리 snapshot·잔여물 계약을 결속 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-08 | project_lead | Plan-027 `37a5031ce2e107cd36628e54b18c63f6ea417022`을 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-08 | plan_keeper | exact remediation commit acceptance를 위한 Plan-028 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-08 | quality_runner | automatic run `31190817318`, attempt 1, main push, exact SHA `37a5031ce2e107cd36628e54b18c63f6ea417022`을 authoritative run으로 결속했다. |
| 2026-08-08 | quality_runner | Plan-028 worktree baseline `npm run qa`를 frontend 83 files/367 tests, Rust 319, build, Tauri와 full harness까지 PASS했다. |
| 2026-08-08 | quality_runner | run/job success와 모든 hosted step success를 확인했다. installed full E2E는 Customer 6/6부터 persistence/import/export/rollback/backup/restore까지 완주했다. |
| 2026-08-08 | privacy_guard | artifact exact 1개를 두 번 독립적으로 비실행·비추출 stream 대사하고 private temp를 삭제했으며 저장소 runtime staging 부재를 확인했다. |
| 2026-08-08 | quality_runner | Plan-028 durable success evidence와 semantic mutation 변경을 포함한 최종 `npm run qa`를 PASS했다. |
| 2026-08-08 | review_judge | 세 독립 최종 심사에서 과거 Plan-013 귀속 P3 두 줄을 Plan-028로 교정하고 전체 QA·재심 뒤 잔여 P0–P3 finding 없음을 확인했다. |
| 2026-08-08 | plan_keeper | completed plan 이동과 동일 번호 review mirror를 작성했다. |

## QA Evidence

- result: PASS — [authoritative run 31190817318](https://github.com/taejun9/bodam/actions/runs/31190817318), attempt 1, job `92906854501`, `windows-2025`, main push, exact SHA `37a5031ce2e107cd36628e54b18c63f6ea417022`, 2026-08-07T15:04:46Z–15:40:30Z
- result: PASS — setup, checkout, host safety, isolated npm trust, toolchains, locked install, cross-layer QA, all-feature Rust, production/private NSIS builds, installed lifecycle, cleanup, evidence, upload와 모든 post-step
- result: PASS — actual production current-user install, exact executable launch/readiness, roaming DB/daily backup, normal window close, uninstall, app-data/shared-WebView2 preservation
- result: PASS — actual installed Customer write 6/6, including benchmark overlap rejection→settled scoped close→invoker focus; restart persistence 4/4
- result: PASS — XLSX/CSV import·persistence·export·round-trip each 4/4, rollback 1/1, DB assertions 3/3, export assertions 6/6
- result: PASS — backup write/mutate/post-restore verify/reauthorize each 1/1; four controlled exit reporter sessions were validated by the successful orchestrator contract
- result: PASS — E2E uninstall/runtime cleanup, exact app-owned cleanup and hosted evidence boundary
- result: PASS — artifact exact 1: ID `8999827782`, `bodam-windows-x64-unsigned`, 216336758 bytes, unexpired seven-day retention, API ZIP digest `89f62effb398e39bcbab7f87d0d6427b40c4e94f9d74ea0cbb4518d7d514bbac`
- result: PASS — raw ZIP exact three root regular unencrypted entries; installer 216335276 bytes/SHA-256 `4dd05128f9139d95ab3e9e8fcb92391559441bba221ec0c306f0579d56939727`; checksum exact
- result: PASS — strict 24-key evidence and fixed values; source/installed lower-hex SHA-256 valid and distinct; two independent checks neither executed nor extracted installer
- result: PASS — both private temp trees deleted; repository `runtime-data`/`.runtime` absent and no artifact content copied into the tree
- result: PASS — local exact-tree `npm run qa`: frontend 83 files/367 tests, Rust default 319, build, Tauri check and full harness
- result: PASS — final evidence-tree `npm run qa`: frontend 83 files/367 tests, Rust default 319, build, Tauri check and full semantic-mutation harness
- result: PASS — completed plan/review tree `npm run qa`: frontend 83 files/367 tests, Rust default 319, build, Tauri check and full harness

## Review Findings

- independent run/log audit: findings 없음; exact identity, runner, every step and scenario interpretation PASS.
- independent artifact consumer audit: findings 없음; metadata, ZIP, checksum, evidence, privacy cleanup PASS.
- resolved P3 — current Plan-028 NTFS evidence와 unsigned artifact 경계 두 줄이 과거 Plan-013으로 귀속된 문구를 Plan-028로 교정했다.
- final evidence, artifact/privacy와 harness/lifecycle 재심: 잔여 P0–P3 findings 없음.

## Completion Notes

- hosted production과 installed full suite 및 artifact consumer acceptance를 모두 충족했다.
- offline clean-VM, signing/SmartScreen/public distribution은 승인되지 않은 별도 외부 범위로 남는다.
- exact production artifact는 2026-08-14T15:38:04Z까지 원격에서 복구 가능하며 private 검사본은 삭제했다.
