# plan-032-user-installers-windows-evidence

## Status

completed

## Owner

project_lead / quality_runner

## User Request

개발 지식이 없는 사용자도 macOS와 Windows에서 설치 파일을 더블클릭해 바로 사용할 수 있도록 운영체제별 패키징 단축키를 만들고, 실제 순서대로 설치·실행까지 테스트한다.

## Approval

- 요청일: 2026-08-19
- 승인일: 2026-08-19
- 승인 근거: 사용자가 Windows와 macOS 패키징 구현뿐 아니라 각 운영체제의 실제 설치 순서와 앱 동작 확인까지 명시적으로 요청했다.
- 승인 범위: plan-031 구현 exact main SHA의 자동 `windows-2025` run, `npm run package:windows`, production current-user NSIS 설치·실행·제거, installed full E2E, cleanup과 unsigned artifact 증거 확인

## Goal

- main `289709f4e05d137f53d3721e723300c667eeeeb0`의 automatic Windows workflow를 authoritative run으로 결속한다.
- 새 `package:windows` 단축키가 x64 BODAM 앱과 offline WebView2 current-user NSIS를 만들고 검사하는지 확인한다.
- production installer의 실제 설치·launch/readiness·정상 종료·제거와 app-data/shared WebView 보존을 확인한다.
- private installed exact executable의 전체 synthetic UI/native/restart/import/export/rollback/backup/restore suite를 확인한다.
- 성공 artifact의 exact allowlist, checksum, evidence metadata를 비실행 방식으로 대사하고 임시 검사본을 삭제한다.

## Non-Goals

- Authenticode, SmartScreen reputation, signed/public release channel
- WebView2가 없는 network-blocked clean VM, physical consumer PC, interactive wizard screenshot
- Windows ARM64/x86, MSI/WiX, per-machine/UAC, auto-update
- 실제 고객 데이터, raw database/backup/export, installer 재게시
- plan-031 구현 소스 변경; hosted failure가 발견되면 별도 수정 plan으로 분리

## Constraints

- `codex/plan-032-user-installers-windows-evidence`와 `.worktree/plan-032-user-installers-windows-evidence`에서만 증거 문서를 작성한다.
- repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, main push, exact head SHA가 모두 일치하는 run만 authoritative하다.
- 진행 중·취소·실패 run이나 skipped step을 PASS로 해석하지 않는다.
- bounded count, basename, hash, status만 기록하고 credential, full runner path, raw log, synthetic row 값을 문서에 복사하지 않는다.
- artifact는 private OS temp에서 실행·추출하지 않고 metadata/ZIP entry/checksum/evidence만 검사한 뒤 삭제한다.
- QA 완료 전 리뷰하지 않고 리뷰 완료 전 commit하지 않는다.

## Evidence Contract

- run/job conclusion과 checkout, host safety, isolated npm trust, setup, cross-layer QA, all-feature Rust, `package:windows`, production lifecycle, private NSIS build, installed E2E, cleanup, summary, upload가 모두 success여야 한다.
- artifact는 `bodam-windows-x64-unsigned` exact one이며 installer, `.sha256`, `evidence.json` 세 root regular·unencrypted entry만 포함한다.
- checksum과 evidence의 installer SHA-256/bytes가 일치하고 strict evidence keys가 expected unsigned/current-user/offline/hosted values를 가져야 한다.
- hosted PASS는 WebView2-absent offline clean VM이나 warning-free signed distribution으로 확대하지 않는다.

## Implementation Plan

- [x] plan-031 implementation main SHA의 automatic run ID/event/attempt/job 결속
- [x] 모든 workflow step과 package shortcut/production lifecycle/installed full E2E 결과 확인
- [x] artifact metadata와 exact ZIP allowlist/checksum/evidence 대사 후 임시 파일 삭제
- [x] 저장소 runtime 오염과 개인정보 경계 확인
- [x] local evidence-tree QA
- [x] 독립 리뷰
- [x] completed plan 및 동일 번호 review mirror 작성

## QA Plan

- GitHub run identity, exact SHA, main push event, Windows job/runner와 every step outcome 확인
- workflow summary/evidence에서 production current-user install·launch·normal close·uninstall과 preserved boundaries 확인
- installed exact app의 complete synthetic feature scenarios와 orchestrator exit 확인
- artifact exact count/name/retention/size, three-entry ZIP, checksum/evidence consistency를 비실행 검사
- `npm run qa`, `python3 harness/scripts/run_review.py`, `git diff --check`

## Review Plan

QA 증거가 완성된 뒤 independent run/evidence reviewer가 exact commit binding, step/result 해석, artifact checksum/allowlist, privacy cleanup과 signing/offline-VM 주장 경계를 검토한다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-19 | plan-031 merge commit `289709f4e05d137f53d3721e723300c667eeeeb0`의 automatic main-push run만 사용한다. | reviewed package shortcut과 Windows inspector가 실제 실행된 증거를 exact implementation tree에 결속하기 위해서다. |
| 2026-08-19 | successful artifact는 private temp에서 비실행·비추출 대사 후 삭제한다. | installer bytes와 runtime data를 저장소에 복사·재게시하지 않으면서 배포 계약을 검증하기 위해서다. |
| 2026-08-19 | 의도한 앱 종료로 reporter가 failed인 네 session은 개별 PASS로 세지 않고 parent installed-E2E step과 phase/snapshot/cleanup 계약으로 판정한다. | 앱 종료가 WebDriver session을 끝내는 restore/exit 시나리오를 숨기지 않으면서 전체 orchestrator 성공을 정확히 해석하기 위해서다. |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-19 | project_lead | plan-031을 main `289709f4e05d137f53d3721e723300c667eeeeb0`로 merge/push하고 완료 branch/worktree를 정리했다. |
| 2026-08-19 | plan_keeper | exact Windows hosted acceptance를 위한 plan-032 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-19 | quality_runner | plan-032 worktree에서 `npm ci` 후 local `npm run qa`를 frontend 84 files/370 tests, Rust default 319, build, Tauri와 full harness까지 PASS했다. |
| 2026-08-19 | quality_runner | automatic run `32219085193`, attempt 1, job `95966064908`, main push와 exact SHA를 결속하고 모든 21개 반환 step의 success를 확인했다. |
| 2026-08-19 | quality_runner | `npm run package:windows`가 219744882-byte x64 app/offline-WebView2 installer를 검사했고 production lifecycle 및 installed full E2E가 success임을 확인했다. |
| 2026-08-19 | privacy_guard | artifact exact 1개를 private temp에서 비실행·비추출 stream 대사하고 임시 ZIP/디렉터리를 삭제했으며 repository runtime staging 부재를 확인했다. |
| 2026-08-19 | quality_runner | hosted/artifact 기록을 포함한 evidence tree에서 전체 `npm run qa`를 재실행해 PASS하고 plan status를 review로 전환했다. |
| 2026-08-19 | review_judge | exact run/job/21 steps, 실제 package shortcut, installed scenario 해석과 artifact 생성 계약을 독립 재대조하고 P0–P3 finding 없이 승인했다. |
| 2026-08-19 | privacy_guard | artifact를 독립 재다운로드해 digest/CRC/three-entry/checksum/24-key evidence와 temp/privacy cleanup을 재검증하고 승인했다. |
| 2026-08-19 | plan_keeper | completed plan 이동과 동일 번호 review mirror를 작성했다. |
| 2026-08-19 | quality_runner | completed plan/review tree에서 최종 전체 QA, review prerequisite와 diff check를 PASS했다. |

## QA Evidence

- result: PASS — [authoritative run 32219085193](https://github.com/taejun9/bodam/actions/runs/32219085193), attempt 1, job `95966064908`, `windows-2025`, main push, exact SHA `289709f4e05d137f53d3721e723300c667eeeeb0`, 2026-08-19T05:20:57Z–06:03:51Z
- result: PASS — setup, checkout, host safety, isolated npm trust, toolchains, locked install, cross-layer QA, all-feature Rust, `npm run package:windows`, production/private NSIS builds, installed lifecycle/full E2E, cleanup, evidence, upload와 모든 post-step
- result: PASS — package inspector: `BODAM_0.1.0_x64-setup.exe`, 219744882 bytes, x64 application PE와 offline WebView2/current-user NSIS 계약
- result: PASS — actual production install, exact executable launch/readiness, roaming DB/daily backup, normal close, uninstall, app-data/shared-WebView2 preservation
- result: PASS — installed Customer write 6/6, restart persistence 4/4, XLSX/CSV import·persistence·export·round-trip 각 1/1, rollback 1/1
- result: PASS — backup write/mutate/post-restore verify/reauthorize 각 1/1; 종료형 reporter 네 session은 successful parent orchestrator의 phase marker/snapshot/residue 계약으로 검증
- result: PASS — artifact exact 1: ID `9354058079`, `bodam-windows-x64-unsigned`, 219746364 bytes, unexpired seven-day retention, ZIP SHA-256 `0475f3ff0925db0ec3e5b09fdc56044abe16c8efd6dcfa4cf6dd18173a6d43c2`
- result: PASS — exact three root regular unencrypted entries; installer SHA-256 `70e0db1b08ed6a8deff7694e9ef3fe220b9cced1abbdc7918a06f0253e1e9265`; checksum and CRC exact
- result: PASS — strict 24-key evidence; expected unsigned/current-user/offline/hosted values; source/installed lower-hex executable hashes valid and distinct
- result: PASS — private temp ZIP/tree deleted; repository `runtime-data`/`.runtime` and Windows installer build output absent
- result: PASS — local exact-tree `npm run qa`: frontend 84 files/370 tests, Rust default 319, build, Tauri check와 full harness
- result: PASS — hosted/artifact evidence-tree `npm run qa`: frontend 84 files/370 tests, Rust default 319, build, Tauri check와 full harness
- result: PASS — completed plan/review tree `npm run qa`, `python3 harness/scripts/run_review.py`, `git diff --check`

## Review Findings

- independent run/log audit: findings 없음; exact identity, Windows 21 steps, package shortcut과 installed E2E 해석 PASS.
- independent artifact/privacy audit: findings 없음; metadata, ZIP digest/CRC, allowlist, checksum, 24-key evidence와 cleanup PASS.
- GitHub annotation은 pinned action의 Node 20→24 강제 실행 deprecation warning이며 application/package test failure가 아니다.
- final P0–P3 findings 없음.

## Completion Notes

- 완료 결과: exact implementation SHA의 Windows package shortcut, production install/launch/normal-close/uninstall, installed full E2E와 artifact consumer acceptance를 모두 충족했다.
- 잔여 위험: installer는 unsigned이며 Unknown Publisher/SmartScreen 경고가 가능하다. interactive double-click wizard와 WebView2-absent network-blocked clean VM은 `NOT RUN`이다.
- 잔여 위험: artifact는 비공개 7-day CI evidence이며 2026-08-26T05:58:40Z 이후에는 새 build 또는 별도 승인된 release channel이 필요하다.
