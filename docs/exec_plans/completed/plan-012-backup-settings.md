# plan-012-backup-settings

## Status

completed

## Owner

project_lead / plan_keeper

## User Request

프로젝트를 바로 사용할 수 있을 정도로 계속 진행하고, 실제 화면과 기능을 실행해 테스트한다.

## Approval

- 요청일: 2026-08-06
- 승인일: 2026-08-06
- 승인 근거: 사용자가 `/goal`로 전체 MVP 완성과 실제 실행 테스트를 지속 위임했고, plan-002에서 작은 후속 Exec Plan에 적용할 운영 프로필 전체를 승인했다.
- 승인 범위: 일관된 SQLite 자동·수동 backup, 최근 자동 30개 보존, pathless restore와 실패 시 현재 DB 보존·성공 후 재시작, Settings의 theme·Dashboard 기간/건수·backup 경로, Browser UI와 실제 release Tauri 검증
- 승인 프로필: SHA-256 `ff82a2d7d6690291b0733f5c71dbe12387a8c8f2c6e884443cb233c2bec2fb68`인 `docs/product/proposed-operating-profile.md`

Dashboard의 예정 bucket·상령 산식, backup 암호화·app lock, remote/cloud, 진단 log 설정과 Windows 배포 acceptance는 이 계획에서 바꾸지 않는다.

## Goal

- 열린 WAL DB를 byte copy하지 않고 SQLite online backup snapshot으로 검증 가능한 local backup을 만든다.
- 시작·resume·local date 변경 때 하루 1회, 정상 종료 때 마지막 성공본 이후 DB가 바뀐 경우 backup을 시도한다.
- 검증된 자동 backup 최근 30개만 보관하고 수동·복원 전 안전 사본은 retention에서 제외한다.
- native file/folder dialog 밖으로 전체 path를 IPC에 노출하지 않고 custom backup 폴더와 restore 파일을 고른다.
- restore 대상과 현재 DB 안전 사본을 검증한 뒤 재시작 전 staging하고, 시작 시 connection을 열기 전에 교체·migration·대사하거나 원본으로 rollback한다.
- Settings에서 light/dark theme, 최근 상담 일수, 미상담 기준 일수, 카드별 건수와 backup 위치를 관리하고 기존 Benchmark를 함께 유지한다.
- 합성 데이터로 실제 Browser와 release app의 backup·restore·재시작·종료 실패 UX를 검증한다.

## Non-Goals

- backup 암호화, recovery key, app lock, OS keychain, 자체 계정·권한, 파일별 비밀번호
- remote backup, cloud sync, network share 권장·검증, telemetry, crash upload, email·외부 전송
- DB 일부 선택 backup, export를 backup에 포함, 자동 purge 외 backup 파일 관리·삭제·이름 변경 UI
- soft-deleted 업무 데이터 purge·범용 복원 UI, import source 개별 복원, 진단 log 보존·삭제 설정
- Dashboard 예정 0–30/31–60/61–90 bucket·상령 산식·카드 배치/숨김 변경
- Windows NSIS·WebView2 offline VM, Windows 실제 file lock/replace/dialog acceptance, code signing·배포 채널
- 실제 고객 DB·backup·경로·행 값을 fixture, source, 문서, log, screenshot에 복사

## Context Map

- `src/features/backup`: lifecycle summary, manual backup, restore preview/confirm/result UI와 safe error boundary
- `src/features/settings`: persistent theme·Dashboard options와 backup path application/UI
- `src/features/dashboard`: 설정된 recent/unconsulted/limit query를 pure read model에 적용
- `src-tauri/src/backup`: online snapshot, archive manifest/checksum, retention, restore staging·startup apply, native dialog와 exit lifecycle
- `src-tauri/src/settings`: v9 singleton settings repository와 strict command validation
- `src-tauri/src/database`: registered-prefix restore 검증, current migration과 runtime schema 대사
- `e2e`: 격리 합성 DB/backup directory, restart·rollback·retention·exit scenario
- product/architecture/privacy/quality/README: 승인 상태, 사용 흐름, 평문·same-disk 위험과 증거

## Constraints

- `codex/plan-012-backup-settings`와 `.worktree/plan-012-backup-settings`에서만 구현·검증한다.
- 계획 → 구현 → QA → 독립 리뷰 → 완료 plan/review → commit 순서를 지킨다.
- source·문서·migration·생성물은 300줄 전에 책임 단위로 분리한다.
- UI는 SQLite snapshot, checksum, archive, retention, path, restore replacement와 migration을 소유하지 않는다.
- blocking DB/file/dialog 작업은 async Tauri command의 blocking worker나 native lifecycle worker에서 수행한다.
- UI IPC에 arbitrary path를 받지 않고 `fs:*`, shell, sidecar, process, network capability를 추가하지 않는다.
- 고객 행·메모·계약 식별값·전체 path를 IPC result, error, log와 문서 증거에 남기지 않는다.
- backup manager는 한 번에 한 작업만 허용하고 import/export/업무 write와의 SQLite 일관성은 online backup API가 소유한다.
- restore 교체는 모든 runtime repository connection을 열기 전 startup에서만 수행한다.

## Settings Contract

- v9 `app_settings` singleton은 theme, recent consultation days, unconsulted days, Dashboard item limit와 nullable custom backup directory를 저장한다.
- 기본값은 현재 앱 기본과 같은 `light`, 최근 상담 30일, 미상담 90일, 카드별 10건, app-data `backups`다.
- 최근 상담은 오늘을 포함한 1–365일, 미상담은 1–3,650일이며 `미상담 일수 ≥ 최근 상담 일수`를 강제해 두 카드가 겹치지 않게 한다.
- 카드별 표시 건수는 기존 최대 계약 안의 1–10 전역 값이다. 예정 bucket과 전체 건수는 바뀌지 않는다.
- theme와 Dashboard 설정은 SQLite를 canonical source로 사용하고 localStorage theme는 첫 paint용 cache로만 사용한다. Browser synthetic port는 localStorage에 같은 계약을 저장한다.
- custom backup directory는 native folder dialog로만 정하고 UI에는 기본/custom 여부와 basename만 표시한다. 취소는 기존 값을 유지한다.
- 선택한 custom directory가 없어지거나 쓸 수 없으면 조용히 기본 경로로 fallback하지 않고 안전한 오류와 경로 재선택을 요구한다.

## Backup Contract

- artifact는 `.bodam-backup` ZIP이며 root에 정확히 `manifest.json`과 `database.sqlite3`만 둔다.
- manifest v1은 UTC created timestamp, local date, reason, app version, schema migration count/last name, DB byte size와 SHA-256을 가진 strict JSON이다. 전체 path와 업무 값은 넣지 않는다.
- archive와 entry name/count, manifest·DB uncompressed size를 먼저 제한한다. DB는 read-only로 열어 `integrity_check`, `foreign_key_check`, registered migration prefix와 runtime schema를 검사한다.
- current 또는 등록된 과거 schema prefix를 허용하고 startup에서 current로 migration한다. unregistered/future/reordered/hash drift는 거부한다.
- automatic reason은 `daily`와 `exit`, 사용자가 누르는 `지금 백업`은 `manual`, 복원 전 안전 사본은 `pre_restore`다.
- 시작·resume·local date 변경의 daily check는 해당 local date에 성공한 automatic backup이 없을 때만 실행한다.
- 정상 종료는 최신 성공 backup의 DB checksum과 새 snapshot이 다를 때만 `exit` backup을 남긴다. 실패하면 종료를 막고 재시도 또는 경고 후 종료를 제공한다.
- 새 artifact를 same-directory random temp에 write·flush·sync·reopen·검증하고 atomic replace한 뒤에만 성공으로 기록·retention을 수행한다.
- automatic `daily|exit`만 timestamp와 basename 동점 순서로 최근 30개를 남긴다. retention 삭제 실패는 새 backup 성공을 취소하지 않고 별도 warning으로 반환한다.
- 같은 디스크와 무암호화 한계를 Settings와 backup 동작 전에 표시한다.

## Restore Contract

- native file dialog는 `.bodam-backup` 하나를 선택하고 backend가 strict 검증·app-data staging한 뒤 timestamp, app/schema version과 source kind만 pathless preview로 반환한다.
- 선택 cancel과 preview 폐기는 파일·DB·설정을 바꾸지 않고 staging temp를 제거한다.
- 확인 시 현재 DB를 `pre_restore` artifact로 먼저 만들고 검증한 뒤 opaque pending marker를 durable write한다.
- restore request는 앱 재시작을 요구한다. restart exit에는 일반 종료 backup을 만들지 않는다.
- 다음 startup은 repository connection 전에 staged archive를 다시 검증하고 별도 working DB에서 current migration·integrity·foreign key·핵심 schema 대사를 끝낸다. 그 DB를 same-directory temp로 준비해 원자 교체하고 WAL/SHM 잔여를 정리한다.
- 교체나 migration·대사 실패 시 검증된 pre-restore DB로 rollback하고 앱을 현재 데이터로 연다. 성공·실패 status는 한 번만 UI에 전달하고 staging/marker를 제거한다.
- pre-restore artifact는 자동 retention에서 제외하고 사용자가 외부에서 지울 때까지 보관한다.

## Implementation Plan

- [x] 승인된 backup/Settings 범위와 선택한 format·Dashboard setting 의미를 product/architecture 문서에 고정
- [x] v9 app_settings migration, Rust settings repository/validation/commands와 Browser/Tauri ports 구현
- [x] Dashboard recent/unconsulted/limit 설정 적용과 theme canonical/cache boot flow 구현
- [x] SQLite online snapshot, strict archive manifest/checksum/schema 검증과 atomic artifact writer 구현
- [x] daily/exit/manual trigger, changed-only 판단, 30개 automatic retention과 safe status 구현
- [x] pathless native folder/file dialog, restore preview/staging/pre-restore/startup apply·rollback·restart 구현
- [x] Settings/backup responsive UI, confirm/exit-failure dialog, focus/busy/error/result 접근성 구현
- [x] 합성 unit/integration/E2E backup·retention·restore·failure·restart·DB immutability scenario 구현
- [x] 전체 자동 QA와 실제 Browser responsive UI, release app native backup/restore/restart 검증
- [x] QA 뒤 독립 data/lifecycle, UI/accessibility, privacy/capability 리뷰와 finding 해결
- [x] completed plan과 동일 번호 review mirror 작성

## QA Plan

- lint, typecheck, full Vitest, production build, Prisma validate와 migration registry/hash/diff
- Rust default/all-features tests, fmt, all-targets/all-features Clippy `-D warnings`, dependency audit
- empty/populated WAL DB online snapshot과 snapshot 전후 source logical checksum 불변
- manifest strict JSON, SHA-256/size, exact ZIP entries, corruption/truncation/bomb/symlink/future·drifted schema rejection
- start/resume/date-change daily once, changed/unchanged exit, concurrent trigger serialization와 cancel
- 29/30/31 automatic retention, manual/pre-restore exclusion, deletion warning과 new artifact preservation
- restore preview cancel, current safety copy, staged checksum swap, migration, restart, 단계별 failure rollback와 temp 0
- Settings defaults/persistence/validation, theme first paint/toggle, Dashboard exact configurable boundary와 Benchmark 회귀
- Browser desktop/390px dark/light, no document overflow, keyboard/focus/dialog/inert/status와 console warn/error 0
- release app native folder/file cancel/select, manual/daily/exit backup, restore/restart와 전체 업무 table logical snapshot 대사
- production capability·bundle marker, temp/repository artifact, sensitive-value/path/log scan
- `npm run qa`, `npm run test:e2e`, production bundle, `npm audit`, `git diff --check`, 300줄 검사

## Acceptance Scenarios

1. Settings에서 theme, 최근/미상담 일수, 카드 건수와 기본/custom backup 위치를 읽고 안전하게 저장한다.
2. 설정값은 재실행 뒤 유지되고 Dashboard 최근·미상담과 카드 slice에 적용되며 예정 bucket·전체 건수는 보존된다.
3. 시작/resume/date 변경은 local date당 한 번만 검증된 daily backup을 만들고 정상 종료는 DB 변경 때만 추가한다.
4. manual backup은 즉시 만들되 automatic 최근 30개 retention에 포함되지 않는다.
5. artifact의 manifest·checksum·schema·SQLite integrity가 맞고 backup 전후 원본 DB는 논리적으로 같다.
6. 종료 backup 실패는 종료를 멈추고 재시도 또는 경고 후 종료를 제공한다.
7. native restore cancel은 무변경이고 손상·future/drifted backup은 staging 전에 안전하게 거부한다.
8. restore 확인은 현재 DB 안전 사본 뒤 재시작하며 성공은 선택 snapshot, 실패는 이전 DB로 열린다.
9. 성공·오류 IPC와 log에는 전체 path나 고객·상담·계약 원문이 없고 평문·same-disk 위험을 UI가 설명한다.
10. 실제 release app에서 합성 DB backup→업무 변경→restore→재시작 뒤 원래 logical snapshot이 복구된다.
11. 390×844, keyboard, focus, dark/light와 Browser/native 상태가 overflow·console error 없이 동작한다.

## Review Plan

QA PASS 뒤 independent data/lifecycle, UI/accessibility와 privacy/capability reviewer가 snapshot consistency, manifest/schema, trigger/retention, restore rollback/restart, settings semantics, pathless boundary, 평문 안내와 실제 native 증거를 확인한다.

## Open Questions

- custom backup 위치가 removable/network filesystem일 때의 platform별 atomicity와 운영 권장
- 자동 backup 파일을 앱 안에서 열람·개별 삭제·외부 폴더로 복사할 관리 UI 필요 여부
- 암호화, recovery key와 app lock이 필요한지

위 항목은 storage threat model이나 새 UX 범위가 필요하므로 현재 MVP에서 추측하지 않는다.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-07 | Dashboard 설정은 최근 상담 30일·미상담 90일과 카드 전역 1–10만 조절 | 승인된 기간·건수 설정을 제공하면서 상령·만기 30/60/90 bucket 의미는 보존 |
| 2026-08-07 | theme·Dashboard·backup 경로를 v9 SQLite singleton에 저장 | 전체 DB snapshot으로 필수 Settings를 함께 복원하고 application 경계를 유지 |
| 2026-08-07 | `.bodam-backup` ZIP v1, SHA-256 manifest와 online backup API 사용 | WAL 포함 live DB의 일관된 snapshot과 독립 restore 검증을 한 파일로 제공 |
| 2026-08-07 | 등록된 과거 migration prefix는 허용해 startup migration, future/drift는 거부 | 같은 앱 계보의 backup은 복구하되 알 수 없는 schema를 조용히 열지 않음 |
| 2026-08-07 | restore는 시작 전 staged replace와 pre-restore rollback으로 수행 | 여러 열린 repository connection을 강제 재연결하지 않고 실패 시 현재 DB 보존 |
| 2026-08-07 | custom 경로 오류는 default로 silent fallback하지 않음 | 사용자가 선택한 보호 위치에서 벗어난 민감 backup 생성을 숨기지 않음 |
| 2026-08-07 | manual과 pre-restore artifact는 automatic 30개 retention에서 제외 | 명시적 recovery point를 자동 정리가 지우지 않음 |
| 2026-08-07 | daily check와 사용자 backup/restore mutation을 양방향 직렬화 | 앱 시작 직후 버튼 동작이 `BACKUP_OPERATION_BUSY` race를 만들지 않게 함 |
| 2026-08-07 | 모든 platform bundle icon을 명시하고 macOS 26 DMG는 비대화식 Finder fallback으로 검증 | release 앱에 실제 icon resource를 포함하고 Finder AppleEvent 시간 초과와 앱 build 실패를 구분 |

## Progress Log

| date | role | note |
|---|---|---|
| 2026-08-07 | project_lead | plan-011을 `f5f010c`로 main에 병합·푸시하고 branch/worktree를 정리했다. |
| 2026-08-07 | repo_cartographer | 승인 프로필·backup 문서·현재 Settings/Dashboard 경계를 병렬 조사해 구현 가능 범위와 Plan-013 잔여를 분리했다. |
| 2026-08-07 | plan_keeper | plan-012 전용 branch/worktree와 standing approval 기반 실행 계획을 만들었다. |
| 2026-08-07 | 기반 | v9 Settings, online snapshot archive, retention, staged restore/rollback, lifecycle command와 Browser/Tauri application 경계를 구현했다. |
| 2026-08-07 | 검증 | synthetic native E2E를 backup write→mutation→verify→restore/relaunch→idempotency와 close/relaunch까지 확장했다. |
| 2026-08-07 | project_lead | 실제 Browser desktop/mobile과 release Tauri 앱을 조작해 설정·dark theme·manual/daily/exit backup·close를 확인했다. |
| 2026-08-07 | project_lead | 최종 전체 QA와 app/DMG 생성·checksum·read-only mount 검증을 마치고 독립 리뷰를 시작했다. |
| 2026-08-07 | quality_runner | restore 직후 host-local 폴더 재승인이 전체 DB 대사보다 먼저 실행되던 E2E 순서를 분리하고, 복원 직후 all-table digest 대사 뒤 별도 재승인 process를 실행하게 했다. |
| 2026-08-07 | quality_runner | 최종 QA, 전용·전체 actual release E2E와 production app/DMG 검증을 다시 통과해 계획을 review 상태로 전환했다. |
| 2026-08-07 | review_judge | data/lifecycle, UI/accessibility, privacy/capability 리뷰의 7개 finding을 rollback·temp sweep·archive identity·종료 E2E·artifact gate로 해결했다. |
| 2026-08-07 | quality_runner | 수정 뒤 자동 QA, 전용·전체 actual Tauri E2E와 production app/DMG를 재실행해 모두 통과했다. |
| 2026-08-07 | doc_gardener | 세 분야 독립 재리뷰에서 신규 finding 0건을 확인하고 plan-012와 동일 번호 review를 완료했다. |

## QA Evidence

- result: PASS
- 최종 `npm run qa`: ESLint, Vue typecheck, Vitest 83 files/366 tests, Prisma validate와 migration registry/hash/diff, Rust default 318 tests, Vite production build, Tauri check와 repository harness가 모두 통과했다.
- Rust 심화: backup module 107/107, `cargo test --all-features` 334/334, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo fmt --all -- --check`와 `git diff --check`가 PASS했다.
- Native E2E: `npm run test:e2e:backup-settings`와 `npm run test:e2e`가 exit 0이었다. 실제 release Tauri process에서 daily/manual/exit, custom destination, 독립 JSZip manifest·size·SHA-256 검사, process-abort state/write-probe orphan 회수, backup→업무 변경→restore 재시작, startup notice·ack, 전체 업무/schema/settings table digest 복구와 host-local 폴더 별도 재승인을 검증했다. 변경 종료는 automatic/exit 각각 정확히 +1, 무변경 종료는 +0을 요구한다. custom 폴더를 실제 이동한 실패 종료는 dialog 표시·초기 focus·재시도 오류·path 비노출·경고 후 종료와 archive +0을 모두 확인했다. Restore/close의 예상된 WebDriver session 종료는 phase marker와 후속 process 대사가 모두 맞을 때만 runner가 허용한다.
- 전체 기능 E2E: Customer·Policy·Coverage·Benchmark·Family·Consultation·Dashboard 8개·Schedule·Calendar 5종, XLSX/CSV import/export·strict 독립 재parse·restart·rollback을 실제 release app과 격리 합성 DB에서 통과했다.
- Browser 실제 화면: 1280×720에서 light/dark, 40일·60일·3건 저장/재로딩, invalid 40/20 validation·focus, Dashboard 반영과 console warning/error 0을 확인했다. 390×844에서 overflow 0, menu focus 이동, Escape 닫기·focus 복귀와 dark 화면을 확인했다.
- Production bundle: `CI=true npm run tauri -- build`가 app·DMG를 재현했다. Info.plist `app.bodam.desktop`/0.1.0, icon, generated production capability exact `core:default`, production app marker 0을 확인했다. `hdiutil verify`는 VALID였고 read-only mount에서 `BODAM.app`과 `/Applications` link를 확인했다. DMG는 5,776,249 bytes, SHA-256 `5aa2264d7882b850267162c78727c1e2c9f8f87cab2e938bb677399477730598`이다. 실행 파일은 linker ad-hoc signature만 있고 app resource seal·배포 인증서·공증이 없어 `codesign --verify --deep --strict` 대상 배포본으로 주장하지 않는다.
- Dependency/privacy: `npm audit --audit-level=low` vulnerability 0, `cargo audit` 차단 vulnerability 0과 allowed warning 17개였다. Linux GTK3 계열·Tauri transitive unmaintained/allowed advisory는 직접 의존성 변경 없이 해소할 수 없어 잔여 위험으로 남긴다. Harness sensitive artifact/capability scan은 PASS했다.
- 관찰: sandbox 안의 첫 GUI launch는 macOS WindowServer 등록에서 SIGABRT해 GUI 권한을 명시한 실행으로 재검증했다. 실제 E2E 첫 재실행은 restore 뒤 폴더 재승인이 `updated_at`을 바꾼 후 digest를 비교하던 테스트 순서 문제를 발견했고, 복원 직후 digest 대사와 별도 재승인 phase로 분리한 뒤 전용·전체 E2E가 연속 PASS했다. Vite의 단일 500 kB 초과 chunk warning은 후속 성능 후보다.

## Review Findings

| severity | finding | resolution |
|---|---|---|
| P1 | 손상된 current DB에서 candidate 준비가 실패하면 유효한 safety DB로 rollback하지 않음 | current 검증 실패 때 marker hash·schema가 맞는 safety를 재검증해 rollback하고, safety 불일치는 marker를 보존해 fail-closed |
| P1 | `.bodam-backup`이 root에만 ignore되어 중첩 민감 backup을 commit할 수 있음 | 전역 `*.bodam-backup`, repository scanner와 root/nested negative control 추가 |
| P2 | 검증 temp와 publish final archive가 같은 파일 객체인지 결속하지 않음 | macOS/Linux 열린 handle의 device/inode를 publish 전후 대사하고 final archive 전체 재검증·재개방 identity 확인 |
| P2 | state/write-probe process-abort temp가 startup/active custom sweep에서 남음 | canonical v4 exact regular file 두 probe 형식과 state temp만 제거하고 symlink·nonregular·delete/sync 오류는 fail-closed |
| P2 | 종료 E2E가 변경 뒤 automatic +0 또는 +1을 모두 허용 | 변경 종료 automatic/exit 정확 +1, 무변경 +0을 runner가 독립 대사 |
| P2 | 실제 종료 backup 실패 dialog·재시도·경고 후 종료 경로가 미검증 | custom 폴더를 실제 unavailable로 만들고 focus·alert·pathless·bypass·archive 무변경을 actual Tauri E2E로 검증 |
| P3 | manifest `localDate`가 비정규 자릿수를 허용 | parse 뒤 `%Y-%m-%d` exact 재format 비교와 invalid-width 회귀 추가 |

수정 뒤 data/lifecycle, UI/accessibility, privacy/capability 세 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding은 0건이었다.

## Completion Notes

- Settings의 theme·Dashboard 기간/건수·backup 위치를 v9 SQLite singleton으로 영속화하고 실제 Dashboard와 첫 paint에 적용했다.
- online SQLite snapshot, strict archive/checksum/schema, daily·changed-exit·manual, automatic 30개 retention과 pathless native 폴더/파일 경계를 구현했다.
- restore는 pre-restore safety, durable marker, connection 전 working-copy migration·대사, atomic install·검증 rollback과 재시작 status acknowledgement를 사용한다.
- 실제 Browser와 격리 release Tauri에서 설정·backup·업무 변경·restore·재시작·종료 성공/실패를 합성 데이터로 검증했고 전체 업무 table digest를 복원했다.
- production DMG는 로컬 검증 가능한 unsigned 산출물이다. Apple 배포 서명·공증, Windows HANDLE/NTFS·NSIS acceptance는 plan-013에 남긴다.
