# plan-023-windows-hosted-acceptance

## Status

completed

## Owner

project_lead / quality_runner

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-07
- 승인 근거: 사용자가 `/goal`로 MVP 완성과 실제 실행 테스트를 지속 위임했고 Plan-022가 완료 commit의 automatic hosted acceptance를 후속 plan에 명시했다.
- 승인 범위: exact main `b1afed381609542909e2082586736e7f5b6a3485`의 자동 `windows-2025` run, 새 native cleanup/provider controls, Rust/NSIS production lifecycle, private installed E2E와 exact production artifact 대사, 실패 시 최소 수정 lifecycle
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Authenticode 자격증명, SmartScreen reputation, public release channel과 WebView2가 없는 network-blocked clean VM은 새 권한·외부 환경이 필요한 별도 범위다.

## Goal

- exact commit의 automatic GitHub `windows-2025` run identity와 모든 step outcome을 결속한다.
- actual PowerShell이 nested reparse, exact not-found/provider-error, persistent/transient sharing-lock, installer identity와 readiness controls를 실행했는지 확인한다.
- production current-user NSIS의 실제 설치, roaming DB/daily backup 안정화, normal close/exit 0, 정상 제거와 app-data/shared WebView2 보존을 확인한다.
- private installed exact executable의 합성 UI/native/restart/import/export/backup/restore suite를 확인한다.
- successful production-only artifact 하나의 exact three-file allowlist, checksum과 sanitized evidence를 대사한다.

## Non-Goals

- Authenticode certificate, timestamping, SmartScreen reputation, signed/public release
- WebView2 미설치·network-disabled clean VM, interactive wizard screenshot, physical consumer PC acceptance
- x86/ARM64, MSI/WiX, per-machine/UAC install, auto-update와 배포 channel
- 실제 고객 데이터, 원격 telemetry/log upload, E2E installer·DB·backup·export·raw log artifact 보관

## Constraints

- `codex/plan-023-windows-hosted-acceptance`와 `.worktree/plan-023-windows-hosted-acceptance`에서만 기록·수정한다.
- exact SHA가 다른 run, 진행 중·취소·실패 run을 전체 PASS로 사용하지 않고 skipped step은 어떤 PASS에도 사용하지 않는다. 실패 run 안의 exact successful step은 이름과 범위를 한정한 scoped evidence로만 기록한다.
- log·summary·docs에는 bounded synthetic count, basename, hash, status만 기록하고 full runner path, row value와 credential을 복사하지 않는다.
- production exact 3-file artifact만 OS 임시 디렉터리에서 검사하고 E2E installer나 runtime data를 저장소에 복사·재게시하지 않는다.
- failure 수정은 QA→독립 리뷰→완료 plan/review→commit/main push 순서를 지키고 새 commit run은 후속 plan이 소유한다.
- 소스·문서·workflow는 300줄 전에 분리한다.

## Evidence Contract

- authoritative run은 repository `taejun9/bodam`, workflow `Windows NSIS and installed E2E`, commit `b1afed381609542909e2082586736e7f5b6a3485`의 main push event다.
- run/job success와 cross-layer QA, host safety, Windows all-feature Rust, production build/lifecycle, E2E build/installed E2E, cleanup, summary, upload outcome을 각각 확인한다.
- successful non-PR artifact는 `bodam-windows-x64-unsigned` 하나이고 installer, `.sha256`, `evidence.json` exact 세 파일만 포함해야 한다.
- checksum text, artifact metadata와 evidence JSON의 installer SHA-256/bytes가 일치해야 한다.
- evidence는 서로 다른 64자 source/installed SHA-256, `binaryPatchAwareMatch: true`, `NotSigned`, `hostedRunner: true`, `offlineVmAccepted: false`, `launchSmokePassed: true`, `appDataPreserved: true`, `sharedWebViewPreserved: true`, production marker 0과 install/uninstall exit 0을 요구한다.

## Implementation Plan

- [x] exact commit의 automatic run ID/URL, event, attempt 결속
- [x] exact Windows job identity와 모든 step·cleanup·summary·upload outcome 확인 — job `92821578155`, run/job failure
- [x] actual PowerShell cleanup/provider/lock/readiness controls 확인
- [x] production normal lifecycle와 scoped preservation 확인 — normal exit/uninstall, DB/daily hash와 관측 WebView registry exact 보존 PASS
- [x] private installed full synthetic E2E 확인 — launcher failure로 Tauri/Rust build 시작 전 중단, installed suite SKIPPED / `NOT RUN`
- [x] runner-local production staging exact allowlist/checksum/evidence 검사 — PASS
- [x] uploaded production artifact metadata/download 대사 — upload SKIPPED, artifacts 0 / `NOT RUN`
- [x] 실패가 있으면 최소 원인 분석·수정 후 전체 QA와 독립 리뷰
- [x] 완료 plan과 동일 번호 review mirror 작성

## QA Plan

- GitHub run status/conclusion, exact head SHA, event, runner label, step timestamps/outcomes 확인
- actual PowerShell recursive parse, junction sentinel, provider-error and native lock controls와 NSIS identity/readiness 확인
- Windows default/all-feature Rust, NTFS HANDLE-relative tests와 full cross-layer harness 확인
- production NSIS exact x64/config/feature/marker/payload, silent lifecycle, normal close와 app-data assertions 확인
- installed private E2E exact binary의 complete synthetic UI/native/restart/import/export/backup/restore suite 확인
- artifact count/name/retention/size/digest, inner three-file allowlist와 sanitized evidence schema·값 대사

## Acceptance Scenarios

1. exact main commit의 hosted run과 Windows job, 모든 검증·cleanup·upload 단계가 success다.
2. actual PowerShell이 nested reparse, missing/provider, persistent/transient lock과 NSIS controls를 통과한다.
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
| 2026-08-07 | Plan-022 완료 commit의 automatic main push run만 authoritative하게 사용 | bounded cleanup과 exact workflow activation controls를 reviewed tree와 SHA로 결속 |
| 2026-08-07 | artifact는 OS 임시 디렉터리에서 allowlist·hash·JSON 값만 검사한 뒤 삭제 | production installer 원본을 저장소·문서에 복사하지 않고 개인정보 경계를 유지 |
| 2026-08-07 | Windows `.cmd` shim을 직접 실행하거나 `shell: true`로 우회하지 않고 `process.execPath`가 검증된 absolute JavaScript CLI만 argv 배열로 실행 | Node의 CVE-2024-27980 보안 변경을 유지하면서 Tauri와 npm lifecycle을 Windows에서 이식 가능하게 실행 |
| 2026-08-07 | 최초 실패 지점인 Tauri launcher뿐 아니라 같은 direct `.cmd` 경계를 가진 installed E2E 내부 npm launcher 두 곳도 함께 교체 | 다음 hosted cycle에서 동일 `EINVAL`이 순차 재발하는 것을 실제 subprocess control로 예방 |
| 2026-08-07 | npm child env에서는 `npm_execpath`와 `npm_node_execpath`의 모든 case-insensitive alias를 제거한 뒤 고정값만 추가 | Windows의 case-insensitive 환경 키 선택에서 scenario-provided uppercase alias가 provenance를 이기지 못하게 차단 |
| 2026-08-07 | Node spawn core와 두 E2E consumer 전체를 normalized-text SHA-256에 결속 | 빈 actual control과 inactive/dynamic computed spawn decoy를 fail-closed mutation으로 검출 |
| 2026-08-07 | `qa`의 `run-s`와 모든 task를 exact ordered token tuple로 고정 | `--npm-path` 같은 npm-run-all option이 actual control과 전체 QA를 대체해 무음 성공시키는 우회 차단 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | Plan-022 `b1afed381609542909e2082586736e7f5b6a3485`를 main에 fast-forward·push하고 완료 branch/worktree를 정리했다. |
| 2026-08-07 | plan_keeper | exact new commit acceptance를 위한 Plan-023 branch/worktree와 evidence contract를 만들었다. |
| 2026-08-07 | quality_runner | automatic push run `31164325344`, attempt 1을 exact SHA, `main`, workflow identity에 결속했다. |
| 2026-08-07 | quality_runner | job `92821578155`에서 cross-layer QA와 actual PowerShell hosted cleanup/provider/native lock/installer/readiness controls가 PASS하고 Windows all-feature Rust로 진행했다. |
| 2026-08-07 | quality_runner | Windows all-feature Rust가 PASS하고 unsigned production NSIS build로 진행했다. |
| 2026-08-07 | quality_runner | unsigned production NSIS build가 PASS하고 actual install/window/readiness/normal-close/uninstall/preservation lifecycle로 진행했다. |
| 2026-08-07 | quality_runner | production lifecycle과 runner-local three-file staging PASS 뒤 private E2E launcher가 Node 24의 direct Windows `.cmd` `spawnSync`에서 즉시 `EINVAL`로 FAIL했다. Tauri/Rust E2E build는 시작되지 않았고 installed E2E와 upload는 skipped, cleanup/summary는 PASS, artifacts 0이다. |
| 2026-08-07 | harness_builder | direct `tauri.cmd` 외에도 installed suite의 두 direct `npm.cmd` 호출을 찾았다. 검증된 Node JavaScript entrypoint, `shell: false`, exact argv와 shell-metacharacter actual subprocess control을 최소 수정 범위로 확정했다. |
| 2026-08-07 | harness_builder | `process.execPath`가 잠긴 Tauri `tauri.js`와 부모의 검증·고정된 `npm-cli.js`만 실행하는 공통 runner, platform별 순수 build invocation과 actual/mutation controls를 구현했다. |
| 2026-08-07 | quality_runner | 전체 local QA, all-feature Rust와 실제 macOS Tauri 화면/기능 E2E를 새 JavaScript launcher로 끝까지 실행해 PASS했다. Windows private installed acceptance는 새 exact commit의 후속 hosted run 전까지 계속 `NOT RUN`이다. |
| 2026-08-07 | review_judge | 최초 post-QA 독립 리뷰에서 P1 빈 immutable control 1건과 P2 Windows env alias, dynamic consumer 우회, hosted evidence 문구 3건을 찾았다. |
| 2026-08-07 | harness_builder | case-insensitive env 정규화, uppercase poison actual control, 빈 파일·computed dynamic spawn mutation, 두 consumer digest와 scoped hosted wording으로 findings를 해결했다. |
| 2026-08-07 | quality_runner | 수정 후 전체 QA 83/366·Rust 319, all-feature Rust 335, 실제 macOS Tauri 전체 합성 화면/기능 E2E와 runtime cleanup을 재실행해 모두 PASS했다. |
| 2026-08-07 | review_judge | 최종 재리뷰가 Windows의 case-insensitive `process.env` 조회 expected 오류와 `run-s --npm-path` QA 대체 우회 P1 두 건을 추가로 찾았다. |
| 2026-08-07 | harness_builder | Windows에서는 uppercase 조회가 fixed canonical 값을 반환하도록 actual control을 보정하고, QA exact task tuple과 `--npm-path` mutation을 추가했다. |
| 2026-08-07 | quality_runner | 두 P1 수정 후 actual control, lint, 전체 QA와 review prerequisites를 다시 PASS했다. 앱 runner 자체는 직전 실제 전체 화면/기능 E2E PASS 이후 변경되지 않았다. |

## QA Evidence

- authoritative automatic run: [run 31164325344](https://github.com/taejun9/bodam/actions/runs/31164325344), attempt 1, `push`, branch `main`, head SHA `b1afed381609542909e2082586736e7f5b6a3485`
- authoritative job: [job 92821578155](https://github.com/taejun9/bodam/actions/runs/31164325344/job/92821578155), `Current-user NSIS and installed application`, `windows-2025`
- cross-layer QA: PASS
- actual PowerShell hosted cleanup/provider/native lock/installer identity/readiness controls: PASS
- Windows all-feature Rust: PASS
- unsigned production NSIS build: PASS
- production install lifecycle and staged release evidence: PASS — normal close/exit 0, process absence, uninstall 0, install residue removal, DB/daily backup hash와 관측 app-data directory 보존, 관측 shared WebView registry record/`pv` exact 보존, runner-local exact three-file staging. CI cleanup 이후 app-data 존속이나 WebView 파일 전체·재실행은 주장하지 않는다.
- private E2E launcher: FAIL — Node.js 24.18.1이 absolute `.cmd` shim direct `spawnSync`에 즉시 `EINVAL`을 반환했다. Tauri CLI/Rust/private NSIS build는 시작되지 않았으며 full runner path는 기록하지 않는다.
- installed full E2E: SKIPPED / `NOT RUN`
- unconditional exact app-owned cleanup and hosted boundary summary: PASS
- artifact upload: SKIPPED; artifacts 0. runner-local allowlist/checksum/evidence staging은 PASS했지만 GitHub packaging/metadata/retention/digest와 download acceptance는 `NOT RUN`
- result: FAIL — run/job `completed/failure`, 2026-08-07T09:04:06Z–09:22:41Z
- local modification QA result: PASS — `npm run qa`; Node actual subprocess control, lint/typecheck, frontend 83 files/366 tests, Prisma validation·migration diff, Rust 319 tests, production Vite build, Tauri check, repository/Windows mutation harness
- local `cargo test --all-features`: PASS — 335 tests, E2E-only WebDriver/native path controls 포함
- local actual `npm run test:e2e`: PASS — 새 Tauri JavaScript launcher로 macOS app bundle을 만들고 실제 WebKit 창에서 Customer/policy/coverage/benchmark/family/consultation/Dashboard/Schedule/Calendar, restart persistence, XLSX·CSV import/export/round-trip/rollback, settings와 backup/restore/restart/exit/idempotency를 합성 데이터로 실행; isolated runtime cleanup 완료
- Windows private installed E2E와 uploaded artifact acceptance: 이 수정 commit의 hosted run 전까지 `NOT RUN`

## Review Findings

- initial independent review: P0 0, P1 1, P2 4, P3 0. 중복 보고된 Windows env alias finding은 한 건으로 집계했다.
- resolved P1: empty immutable control이 digest 검사를 건너뛰던 조건을 제거하고 zero-byte mutation을 추가했다.
- resolved P2: 두 npm consumer를 normalized digest에 결속하고 inactive import와 computed dynamic child-process mutation을 추가했다.
- resolved P2: Windows case-insensitive npm env alias를 모두 제거한 뒤 fixed provenance를 추가하고 uppercase poison actual control로 검증했다.
- resolved P2: failed run 전체 PASS 금지와 successful-step scoped evidence를 분리하고 production scoped PASS와 private installed/upload `NOT RUN` 문구를 일치시켰다.
- resolved P1: Windows case-insensitive env lookup이 uppercase 이름에서도 fixed canonical 값을 반환하는 platform-aware actual-control expected를 추가했다.
- resolved P1: `run-s --npm-path true`가 QA task를 대체하지 못하도록 exact ordered task tuple과 option-injection mutation을 추가했다.
- 초기 findings 해결 후 전체 QA·all-feature Rust·실제 화면/기능 E2E를 재실행했고, 후속 actual-control·QA-harness P1 해결 뒤 actual control과 전체 QA를 다시 실행했다. 후속 수정은 직전 PASS한 앱 runner를 변경하지 않았다.
- Final verdict — evidence/lifecycle/privacy, launcher/security와 adversarial harness의 최종 독립 재심사가 모두 P0 0/P1 0/P2 0/P3 0으로 승인했다.

## Completion Notes

- authoritative baseline run은 production lifecycle과 runner-local release staging까지 PASS했지만 private E2E launcher가 Node 24의 direct `.cmd` 실행 거부로 FAIL했다. 따라서 installed full E2E와 artifact upload/download는 `NOT RUN`이다.
- Tauri와 npm을 검증된 absolute JavaScript entrypoint, `process.execPath`, argv 배열과 `shell: false`로 실행하도록 수정하고 case-insensitive env provenance와 exact QA task tuple을 fail-closed controls로 고정했다.
- current tree는 반복 전체 QA, Rust all-features 335/335, audit 0건, 실제 macOS Tauri 전체 화면·기능 E2E, review prerequisites와 세 독립 최종 심사를 통과했다.
- 새 launcher의 actual Windows private installed E2E와 uploaded production three-file artifact acceptance는 완료 commit의 automatic main-push run을 소유할 Plan-024에 인계하며 이 plan에서 PASS로 확대하지 않는다.
