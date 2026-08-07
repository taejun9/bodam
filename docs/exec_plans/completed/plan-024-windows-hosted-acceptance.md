# plan-024-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-023이 완료 commit의 automatic hosted acceptance를 후속 plan에 명시했다.
- 승인 범위: exact main `79b23f98eb3604247bf64188b5cd62f2025b9ecb`의 자동 `windows-2025` run, actual Windows launcher/private installed E2E와 exact production artifact 다운로드 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 automatic GitHub `windows-2025` run identity와 모든 step outcome을 결속한다.
- actual PowerShell host safety, Rust/NSIS production lifecycle과 새 Node JavaScript launcher 실행을 확인한다.
- private installed exact executable의 합성 UI/native/restart/import/export/backup/restore suite를 확인한다.
- successful production-only artifact 하나의 exact three-file allowlist, checksum과 sanitized evidence를 다운로드해 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-024-windows-hosted-acceptance`와 `.worktree/plan-024-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run을 전체 PASS로 사용하지 않고 skipped step은 어떤 PASS에도 사용하지 않는다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact three-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `79b23f98eb3604247bf64188b5cd62f2025b9ecb`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows all-feature Rust, production build/lifecycle, private E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `launchSmokePassed: true`, `appDataPreserved: true`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt와 Windows job identity 결속
- [x] 모든 validation, lifecycle, private installed E2E, cleanup, summary와 upload outcome 확인 — installed preflight FAIL, upload SKIPPED
- [x] artifact outcome과 다운로드 가능성 확인 — upload SKIPPED, artifacts 0, download NOT RUN
- [x] 실패가 있으면 최소 원인 분석·수정 후 전체 QA와 독립 리뷰
- [x] 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual PowerShell controls, Windows Rust all-features, production/private NSIS lifecycle 확인
- installed exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest와 inner allowlist/checksum/evidence schema·값 대사
- 다운로드 임시 디렉터리 삭제와 저장소 오염 부재 확인

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup·upload 단계가 success다.
2. production current-user/offline NSIS가 실제 설치·창 실행·정상 종료·제거되고 user data와 shared WebView2가 보존된다.
3. 새 Node launcher로 만든 private installer의 installed exact executable이 전체 합성 UI/native/restart/import/export/backup/restore suite를 통과한다.
4. successful non-PR artifact 하나가 exact production three-file allowlist만 포함하고 checksum/evidence가 일치한다.
5. 기록은 hosted PASS, unsigned 상태와 offline clean-VM `NOT RUN`을 구분한다.

## Review Plan

QA 증거가 완성된 뒤 independent run/artifact reviewer와 installer/privacy reviewer가 exact commit binding, step/result 해석, downloaded checksum/allowlist, 두 executable hash와 잔여 주장 범위를 검토한다.

## Open Questions

- Authenticode certificate provider, timestamp server와 public distribution owner
- WebView2가 없는 network-blocked Windows 11 clean VM image와 증거 보관 위치

위 항목은 현재 사용자 권한·환경 밖이므로 hosted PASS로 대신 해결하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Plan-023 완료 commit의 automatic main push run만 authoritative하게 사용 | reviewed Node launcher와 exact workflow를 실행 SHA에 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-023 `79b23f98eb3604247bf64188b5cd62f2025b9ecb`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-024 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic push run `31170168961`, attempt 1과 job `92839996499`를 exact SHA, `main`, `windows-2025` workflow에 결속했다. |
| 2026-08-07 | quality_runner | cross-layer QA, actual PowerShell controls, Windows all-feature Rust, production build/lifecycle/staging과 private E2E NSIS build가 PASS했다. Installed step은 설치 전 rendered NSIS preflight에서 FAIL했고 cleanup/summary는 PASS, upload는 skipped, artifacts 0이다. |
| 2026-08-07 | harness_builder | 잠긴 Tauri 2.11.4가 source `skip`을 rendered `INSTALLWEBVIEW2MODE ""`로 매핑하지만 preflight가 literal `"skip"`을 기대한 false negative를 공식 renderer/template source로 확정했다. Source `skip` guard는 유지하고 rendered empty expectation과 immutable mutation control을 최소 수정 범위로 정했다. |
| 2026-08-07 | quality_runner | rendered empty 수정과 empty/literal-skip/conjunction/inactive/duplicate mutations 뒤 전체 QA, Rust all-features와 dependency audit를 PASS했다. 앱과 JavaScript E2E runner는 직전 실제 전체 화면/기능 PASS 이후 변경되지 않았다. |
| 2026-08-07 | review_judge | post-QA 독립 리뷰에서 runtime NSIS script의 comment decoy·duplicate·conflicting define을 substring 검사가 허용하는 P2 한 건을 찾아 QA로 되돌렸다. |
| 2026-08-07 | harness_builder | 두 rendered define을 anchored line으로 parse해 exact one/value를 요구하는 공통 module과 Windows synthetic controls를 production/private preflight에 연결했다. |
| 2026-08-07 | quality_runner | P2 remediation 뒤 Python digest/wiring/mutation controls와 전체 QA를 다시 PASS했다. 새 PowerShell control은 로컬 PowerShell 부재로 NOT RUN이며, 후속 변경은 직전 PASS한 Rust/app/JavaScript E2E runner를 변경하지 않았다. |
| 2026-08-07 | review_judge | 재심사에서 .NET Multiline `$`가 CRLF의 `\r`을 소비하지 않아 valid Windows script를 거부할 수 있는 P2를 찾았다. |
| 2026-08-07 | harness_builder | anchored suffix를 optional CR에 결속하고 동일 valid LF/CRLF actual controls를 추가했다. |
| 2026-08-07 | review_judge | 후속 재심사에서 C-style/continued comments, conditional·macro decoy와 `/redef`/`!undef`가 line regex를 우회하는 P2를 찾았다. |
| 2026-08-07 | harness_builder | 잠긴 Tauri default template의 top-level define 불변식에 맞춰 block/continuation, conditional/macro target, switched/dynamic mutation과 symbol-generating command를 fail-closed로 거부했다. Source NSIS key exact-set으로 custom template/hook/include도 차단했다. |
| 2026-08-07 | quality_runner | 최종 remediation tree에서 Node actual subprocess, lint/typecheck, frontend 83 files/366 tests, Prisma, Rust 319 tests, Vite/Tauri와 전체 repository/Windows mutation harness를 PASS해 review로 전환했다. Corrected PowerShell runtime control은 다음 Windows run까지 NOT RUN이다. |
| 2026-08-07 | review_judge | 최종 evidence review가 Tauri의 자동 Windows JSON/JSON5/TOML platform-config 병합 surface를 source guard가 놓치는 P1을 실제 mutation으로 재현해 QA로 되돌렸다. |
| 2026-08-07 | harness_builder | pinned Tauri base→platform→CLI merge source와 세 platform filename을 결속하고, source/actual preflight에서 모든 Windows platform override를 fail-closed로 거부했다. Production package command도 exact equality로 잠갔다. |
| 2026-08-07 | review_judge | package pre/post lifecycle·nested E2E command와 imported helper/spec 변경이 launcher-only digest를 우회하고, raw association/resource 값이 renderer에 들어가는 P1을 찾아 QA로 되돌렸다. |
| 2026-08-07 | harness_builder | entire package scripts map, 54개 E2E module+WDIO trust tree와 complete base/E2E source config hash를 결속하고 해당 mutations를 추가했다. Config hash는 Windows checkout의 LF/CRLF/CR을 동일 승인하도록 UTF-8 newline normalization을 사용한다. |
| 2026-08-07 | review_judge | multi-symbol undef, command alias, later include에 이어 include search directory, local built-in shadow와 arbitrary plugin/finalizer가 protected compiled state를 우회하는 P2를 찾았다. |
| 2026-08-07 | harness_builder | pinned nine-directive/include order, actual installer parent와 세 generated include hash, built-in shadow 부재를 검사하고 `!addincludedir`/`!cd`/arbitrary plugin/finalizer mutations를 보강했다. Pinned renderer가 raw English bytes를 직접 쓰는 source에 맞춰 language hash를 확정했다. |
| 2026-08-07 | quality_runner | 최신 remediation의 Windows mutation contract, CRLF config positive와 repository base QA를 PASS했다. Corrected PowerShell parser는 다음 hosted Windows run까지 NOT RUN이다. |
| 2026-08-07 | review_judge | project `.npmrc`, preinstall과 alternate WDIO/Tauri dependency·lock graph가 npm 내부 QA 전에 command graph를 우회할 수 있는 P1을 재현했다. `npm-shrinkwrap.json`의 lock 우선순위도 범위에 포함했다. |
| 2026-08-07 | harness_builder | checkout 직후 direct host/Python trust를 모든 npm command보다 앞에 두고 complete package/lock/scripts/E2E hashes와 `.npmrc`/shrinkwrap 부재를 결속했다. Dependency install은 exact `npm ci --ignore-scripts`로 변경했다. |
| 2026-08-07 | review_judge | approved plugin/finalizer directive가 참조하는 `ADDITIONALPLUGINSPATH`와 `UNINSTALLERSIGNCOMMAND` 값이 자유로운 P2를 찾아 QA로 되돌렸다. |
| 2026-08-07 | harness_builder | sign command empty define과 plugin parent shape/reparse 부재/sole `nsis_tauri_utils.dll` official SHA-1을 별도 dependency module에 결속하고 indirect-value mutations를 추가했다. |
| 2026-08-07 | review_judge | direct pre-npm wrapper가 변경 가능한 imported checker를 실행하고 non-isolated Python module shadow를 허용하며, setup-node cache가 gate보다 먼저 npm을 호출하는 P1/P2를 찾아 QA로 되돌렸다. |
| 2026-08-07 | harness_builder | `python3 -I` gate를 setup-node 전으로 옮기고 exact checker hash를 import 전 검증한 captured source만 실행한다. Checker+package+lock 결합 변조, local `json.py` shadow와 action-order mutations를 추가했다. |
| 2026-08-07 | quality_runner | plugin byte tamper, extra child와 junction negatives를 보강한 최종 tree에서 isolated preflight, Windows contract/base QA, full npm QA, Rust all-features 335 tests와 dependency audit 0을 PASS하고 review로 전환했다. Corrected PowerShell actual은 다음 Windows run까지 `NOT RUN`이다. |
| 2026-08-07 | review_judge | npm trust failure에도 `if: always()` cleanup이 untrusted npm lifecycle을 실행하는 P1을 찾아 QA로 되돌렸다. |
| 2026-08-07 | harness_builder | npm cleanup을 exact successful trust outcome에 결속하고 gate rejection 뒤 cleanup 실행을 허용하는 workflow mutation을 추가했다. Gate는 setup/build/install 전이므로 failure 시 cleanup할 app state가 없다. |
| 2026-08-07 | quality_runner | trust-gated cleanup remediation 뒤 isolated preflight, focused/base contract와 full npm QA를 다시 PASS하고 review로 전환했다. Rust/application/dependencies는 직전 335-test/audit-0 PASS 이후 변경되지 않았다. |
| 2026-08-07 | doc_gardener | pinned Tauri raw source를 대조해 NSIS helper/write/compiler/association/language/tool line anchors를 실제 범위로 교정했다. |
| 2026-08-07 | review_judge | cleanup 보강 뒤 evidence/lifecycle, installer/privacy와 adversarial harness 최종 재심사가 모두 남은 P0–P3 없음으로 승인했다. |

## QA Evidence

- authoritative hosted run: [run 31170168961](https://github.com/taejun9/bodam/actions/runs/31170168961), attempt 1, `push`, branch `main`, head SHA `79b23f98eb3604247bf64188b5cd62f2025b9ecb`, `completed/failure`, 2026-08-07T10:27:54Z–10:55:32Z
- authoritative Windows job: [job 92839996499](https://github.com/taejun9/bodam/actions/runs/31170168961/job/92839996499), `Current-user NSIS and installed application`
- cross-layer QA, hosted PowerShell controls, Windows all-feature Rust, unsigned production build, actual production install lifecycle/staging and private E2E NSIS build: PASS
- installed full E2E: FAIL before install — Tauri source `skip` was correctly rendered as empty `INSTALLWEBVIEW2MODE`, while preflight incorrectly expected literal `skip`; installed UI/native suite `NOT RUN`
- unconditional app-owned cleanup and hosted boundary summary: PASS
- upload: SKIPPED; artifacts 0; downloaded artifact acceptance `NOT RUN`
- local modification QA result: PASS — isolated npm preflight and combined mutation controls; Node actual subprocess control; lint/typecheck; frontend 83 files/366 tests; Prisma validation·migration diff; Rust default 319 tests; production Vite build; Tauri check; full repository/Windows mutation harness
- local `cargo test --all-features`: PASS — 335 tests
- local dependency audit: PASS — vulnerabilities 0
- corrected-tree Python digest, exact wiring and mutation controls: PASS
- corrected PowerShell parser/control: `NOT RUN` — local PowerShell unavailable and corrected commit has no `windows-2025` run

## Review Findings

- P2 / resolved — immutable source digest만으로는 runtime `installer.nsi`의 comment decoy, duplicate와 conflicting named define을 막지 못했다. Anchored parser와 Windows fixture source를 production/private preflight에 연결하고 Python digest/wiring/mutation QA를 PASS했다. Superseded parser의 실제 Windows 실행은 주장하지 않는다.
- P2 / resolved — initial anchored regex가 .NET Multiline의 CRLF semantics를 반영하지 못했다. LF/CRLF fixture를 보강한 뒤 더 넓은 lexical review를 수행했다.
- P2 / resolved in focused QA — line regex가 block/continued comments, condition/macro decoy와 `/redef`/`!undef`를 해석하지 못했다. Pinned preprocessor parser와 negative controls가 이를 거부하고 repository base QA를 PASS했다. Actual corrected PowerShell 실행은 아직 주장하지 않는다.
- P1 / resolved in focused QA — base/E2E JSON만 검사해 자동 Windows platform config와 production `--config` suffix를 놓쳤다. 세 filename 부재, complete normalized source hashes, exact command와 mutations를 결속해 focused QA를 PASS했다.
- P1 / resolved in focused QA — npm pre/post lifecycle, nested `test:e2e` mapping과 imported helper/spec 변경이 launcher-only digest를 우회했다. Entire scripts map과 54개 E2E module+WDIO trust tree mutations가 모두 PASS했다.
- P2 / resolved in focused QA — multi-symbol undef, command alias, later include, include search 변경, built-in shadow와 arbitrary plugin/finalizer가 protected compiled state를 우회할 수 있었다. Nine-directive allowlist, exact include order/parent/content와 negative controls를 추가했다.
- P1 / resolved in focused QA — raw config bytes hash가 Windows CRLF checkout과 fixture를 거부할 수 있었다. Python/PowerShell 모두 strict UTF-8 decode 뒤 newline-normalized hash를 사용하고 CRLF positive control을 PASS했다.
- P1 / resolved in QA — project `.npmrc`, preinstall 또는 alternate package/lock dependency가 npm 내부 QA를 먼저 no-op할 수 있었다. Direct pre-npm gate, complete package/lock hashes, shrinkwrap 부재와 `npm ci --ignore-scripts`를 결속하고 full QA를 PASS했다.
- P2 / resolved in QA — pinned plugin/finalizer directive의 참조 define 값이 자유로웠다. Empty sign command와 regular/non-reparse plugin shape 및 sole official DLL SHA-1에 결속하고 full QA를 PASS했다.
- P1 / resolved in QA — thin pre-npm wrapper가 mutable imported checker를 신뢰해 package/lock과 함께 바꾸면 gate를 무력화할 수 있었다. Wrapper가 exact checker hash를 실행 전에 검증하고 captured source만 실행하며 결합 변조 control을 PASS했다.
- P2 / resolved in QA — non-isolated Python의 adjacent stdlib shadow와 setup-node cache의 선행 `npm config get cache`가 direct-gate 주장을 우회했다. `python3 -I` 실행, local `json.py` control과 setup-node 이전 order contract를 PASS했다.
- P3 / resolved in QA — plugin dependency guard의 byte tamper, extra child와 reparse branch에 actual PowerShell negative fixture를 추가하고 immutable mutation control을 PASS했다. Corrected PowerShell 자체는 아직 `NOT RUN`이다.
- P1 / resolved in QA — npm trust rejection 뒤에도 unconditional cleanup이 malicious npm pre/post cleanup lifecycle을 실행할 수 있었다. Cleanup을 successful trust outcome에 결속한 mutation과 full QA를 PASS했다.
- P3 / resolved — pinned config parser의 문서 label을 실제 dependency인 Tauri utils 2.9.3으로 교정했다.
- P3 / resolved — 오래된 Tauri NSIS source line anchors를 pinned raw source의 실제 helper/write/compiler/association/language/tool 범위로 교정했다.
- Final verdict — 세 독립 재심사가 cleanup trust gate를 포함한 최신 tree를 P0 0/P1 0/P2 0/P3 0으로 승인했다.

## Completion Notes

- authoritative run `31170168961`은 production install/window/readiness/normal close/uninstall/preservation과 private NSIS build까지 scoped PASS했지만, installed preflight가 올바른 rendered empty WebView 값을 거부해 전체 FAIL했다. Installed UI/native suite와 artifact upload/download는 `NOT RUN`이고 artifacts 0이다.
- 수정 tree는 rendered NSIS의 exact source/config/include/plugin/finalizer 경계, isolated pre-npm package/lock/E2E trust gate와 trust-gated cleanup을 fail-closed controls로 결속했다.
- 최종 tree는 isolated preflight, focused Windows controls, 반복 full `npm run qa`(frontend 83/366, Rust default 319), Rust all-features 335/335, dependency audit 0, review prerequisites와 세 독립 최종 심사를 PASS했다.
- corrected PowerShell parser, actual Windows installed full UI/native E2E와 downloaded exact three-file artifact acceptance는 이 완료 commit의 automatic main-push run을 소유할 Plan-025 전까지 `NOT RUN`이며, 여기서 PASS로 확대하지 않는다.
