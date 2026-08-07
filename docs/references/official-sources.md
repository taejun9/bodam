# 공식 자료

확인일: 2026-08-07 KST

현재 변경 가능성이 있는 기술 사실은 아래 공식/1차 문서를 기준으로 한다. 링크를 재확인하지 않고 버전·요구사항을 단정하지 않는다.

| source | url | scope | used_for |
|---|---|---|---|
| Tauri 2 Start | https://v2.tauri.app/start/ | Desktop shell 개요 | Vue UI와 Rust core 경계 |
| Tauri Vite | https://v2.tauri.app/start/frontend/vite/ | Vite frontend 연동 | project bootstrap 후보 |
| Tauri Prerequisites | https://v2.tauri.app/start/prerequisites/ | Windows 개발 요구사항 | Build Tools와 WebView2 준비 |
| Tauri Windows Installer | https://v2.tauri.app/distribute/windows-installer/ | MSI/NSIS와 WebView2 방식 | offline installer 결정 |
| Tauri Dialog Plugin | https://v2.tauri.app/plugin/dialog/ | native open/save dialog | import/export/backup 경로 선택 |
| Tauri Single Instance Plugin | https://v2.tauri.app/plugin/single-instance/ | desktop 단일 instance와 기존 window focus | restore 전 process 배타 경계 |
| Tauri File System Plugin | https://v2.tauri.app/plugin/file-system/ | local file 접근 | 파일 adapter |
| Tauri Capabilities | https://v2.tauri.app/security/capabilities/ | command와 scope 권한 | 최소 권한 설계 |
| Tauri SQL Plugin | https://v2.tauri.app/plugin/sql/ | SQLite driver와 migration 선택지 | Prisma와 이중 migration 방지 검토 |
| Tauri Node Sidecar | https://v2.tauri.app/learn/sidecar-nodejs/ | Node sidecar packaging | Prisma runtime option A |
| Tauri Rust Commands | https://v2.tauri.app/develop/calling-rust/ | typed custom command | feature IPC adapter |
| Tauri Permissions | https://v2.tauri.app/security/permissions/ | app command permission | main window command 제한 |
| Tauri App lifecycle API | https://docs.rs/tauri/2/tauri/enum.RunEvent.html | exit/restart event와 prevent API | 종료 backup과 restore restart 경계 |
| Tauri WebDriver | https://v2.tauri.app/develop/tests/webdriver/ | 실제 desktop UI 자동화 | macOS·Windows E2E |
| Tauri WebDriver CI | https://v2.tauri.app/develop/tests/webdriver/ci/ | Windows runner 예제 | Windows release app QA |
| Tauri CLI 2.11.4 bundle source | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle.rs | bundle-type marker patch와 source restore | NSIS installed executable identity projection |
| Tauri CLI 2.11.4 NSIS template | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi | patched main executable의 NSIS capture | installed payload provenance |
| Tauri CLI 2.11.4 NSIS renderer | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs | WebView install mode의 template value mapping | E2E source `skip`과 rendered empty value 결속 |
| Tauri NSIS raw helpers | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L563-L580 | Handlebars escape와 raw helper 등록 | config 값의 rendered script 주입 경계 |
| Tauri NSIS artifact write | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L593-L603 | generated include와 installer script 쓰기 | script/include parent 결속 |
| Tauri NSIS compiler invocation | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L636-L654 | makensis current directory와 environment | include/plugin resolution 경계 |
| Tauri NSIS association expansion | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi#L621-L626 | raw association helper 소비 | complete source config hash 필요성 |
| Tauri NSIS language copy | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L425-L450 | default language bytes와 include path 생성 | pinned English file hash |
| Tauri NSIS language table | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L829-L857 | English source의 embedded bytes | generated language provenance |
| Tauri NSIS tool hashes | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L32-L70 | NSIS toolchain과 nsis_tauri_utils SHA-1 | rendered plugin dependency identity |
| Tauri CLI 2.11.4 config loader | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-cli/src/helpers/config.rs#L154-L188 | base→platform→CLI merge order | Windows platform config 부재 guard |
| Tauri utils 2.9.3 config parser | https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-utils/src/config/parse.rs#L42-L72 | JSON/JSON5/TOML platform filename | 세 Windows override 이름 exact guard |
| NSIS Script File Format | https://nsis.sourceforge.io/Docs/Chapter4.html#4.1 | `;`/`#`, C-style comment와 `\` line continuation | rendered pinned-template parser의 fail-closed lexical boundary |
| NSIS Compile-Time Commands | https://nsis.sourceforge.io/Docs/Chapter5.html#5.4.1 | `!define`, `!undef`, conditional compilation과 macro | protected installer symbol의 top-level canonical-state 검사 |
| Tauri core 2.11.5 app setup source | https://github.com/tauri-apps/tauri/blob/7cd71369c00978a3783b6ae3e9972358abbe4ae6/crates/tauri/src/app.rs | configured window build와 user setup 순서 | production launch readiness 경계 |
| Tauri core 2.11.5 desktop path source | https://github.com/tauri-apps/tauri/blob/7cd71369c00978a3783b6ae3e9972358abbe4ae6/crates/tauri/src/path/desktop.rs | Windows app data resolver | exact roaming app-data 계약 |
| Tauri 2.11.5 PathResolver docs | https://docs.rs/tauri/2.11.5/tauri/path/struct.PathResolver.html#method.app_data_dir | `app_data_dir = data_dir / identifier` | BODAM identifier 경로 결속 |
| dirs 6.0.0 data_dir docs | https://docs.rs/dirs/6.0.0/dirs/fn.data_dir.html | Windows `FOLDERID_RoamingAppData` mapping | Tauri Windows roaming root 결속 |
| Node.js April 2024 security release | https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2 | CVE-2024-27980 이후 Windows batch spawn 변경 | `.cmd` direct spawn 금지 근거 |
| Node.js 24.18.1 child process | https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html#spawning-bat-and-cmd-files-on-windows | Windows `.bat`/`.cmd` 실행과 shell 경계 | E2E launcher 이식성·주입 방지 |
| Node.js DEP0190 | https://nodejs.org/download/release/v24.18.1/docs/api/deprecations.html#DEP0190 | `shell: true`와 args 사용 runtime deprecation | shell 우회 금지 |
| Node.js process.execPath | https://nodejs.org/download/release/v24.18.1/docs/api/process.html#processexecpath | 현재 Node executable의 absolute path | JavaScript CLI 직접 실행 |
| npm project config | https://docs.npmjs.com/cli/v11/configuring-npm/npmrc/ | root `.npmrc`와 config precedence | repository script-shell override 금지 |
| npm ci | https://docs.npmjs.com/cli/v11/commands/npm-ci/ | frozen install과 `ignore-scripts` | pre-QA lifecycle 실행 금지 |
| npm shrinkwrap | https://docs.npmjs.com/cli/v11/commands/npm-shrinkwrap/ | shrinkwrap의 package-lock 우선순위 | alternate lockfile 부재 guard |
| Python isolated mode | https://docs.python.org/3/using/cmdline.html#cmdoption-I | script directory·user site·`PYTHON*` 주입을 제외하는 `-I` | pre-npm stdlib import shadow 차단 |
| setup-node npm cache source | https://github.com/actions/setup-node/blob/49933ea5288caeca8642d1e84afbd3f7d6820020/src/cache-utils.ts#L19-L25 | cache directory 확인이 `npm config get cache`를 실행 | Python gate를 setup-node 전으로 이동 |
| PowerShell Import-Module | https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/import-module?view=powershell-7.6 | `-Force`가 loaded module을 제거 후 재import하고 module 내부 import는 caller module scope를 사용 | dependency module 이중 reload 금지 |
| PowerShell command precedence | https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_command_precedence?view=powershell-7.6 | `ModuleName\CommandName` qualification 권장 | rendered NSIS dependency command provenance 결속 |
| Tauri CLI releases | https://v2.tauri.app/release/%40tauri-apps/cli/ | Tauri CLI 버전별 release | 잠긴 CLI 2.11.4 경계 재확인 |
| Microsoft Process.CloseMainWindow | https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.closemainwindow | GUI main-window close 요청 | production OS-close smoke |
| Microsoft Process.WaitForExit | https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.waitforexit | bounded process exit wait | normal exit와 cleanup timeout 분리 |
| Microsoft WM_CLOSE | https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-close | window close message semantics | Tauri CloseRequested/exit-backup 진입 |
| Microsoft NtCreateFile | https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntcreatefile | directory HANDLE 상대 open과 reparse 동작 | Windows backup 경로 결속 |
| Microsoft file handle information | https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getfileinformationbyhandleex | 열린 file/directory identity와 entry 정보 | Windows identity 대사 |
| Microsoft SetFileInformationByHandle | https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle | HANDLE 기반 rename/delete | Windows archive publish와 cleanup |
| Microsoft GetVolumeInformationByHandleW | https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getvolumeinformationbyhandlew | 열린 객체의 filesystem·volume 정보 | local NTFS 경계 |
| Microsoft FlushFileBuffers | https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers | 열린 file HANDLE의 buffered data flush | file 내용 flush와 metadata durability 주장 경계 |
| Microsoft WebView2 Distribution | https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#detect-if-a-suitable-webview2-runtime-is-already-installed | x64 HKLM/HKCU `pv (REG_SZ)` runtime 탐지 | shared WebView2 등록 보존 snapshot |
| Microsoft WebView2 user data folders | https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder | host 종료 뒤 UDF file handle 해제 경계 | app-owned UDF bounded cleanup retry |
| Microsoft WebView2 process events | https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-related-events | browser process와 child process lifecycle | host process exit와 UDF release 구분 |
| Microsoft system error codes | https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499- | `ERROR_SHARING_VIOLATION` 32 / `0x20` | retry 가능한 exact Windows sharing violation |
| GitHub Actions Secure Use | https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions | full-length commit SHA만 immutable action release | release workflow action pinning |
| actions/checkout pinned commit | https://github.com/actions/checkout/commit/11d5960a326750d5838078e36cf38b85af677262 | verified `v4` commit | source checkout pin |
| actions/setup-node pinned commit | https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020 | verified `v4` commit | Node setup pin |
| dtolnay/rust-toolchain pinned commit | https://github.com/dtolnay/rust-toolchain/commit/4360b52568e2003a75bf9bc1d59f33a8e3fc893c | verified `stable` commit | Rust setup action pin |
| Swatinem/rust-cache pinned commit | https://github.com/Swatinem/rust-cache/commit/49a0bdc70d2e1b713ca9e2869b211fcce03d3c1c | verified `v2` commit | Rust cache action pin |
| actions/upload-artifact pinned commit | https://github.com/actions/upload-artifact/commit/ea165f8d65b6e75b540449e92b4886f43607fa02 | verified `v4` commit | production artifact upload pin |
| GitHub workflow artifacts | https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts | Actions artifact 경계 | production installer allowlist |
| GitHub upload-artifact | https://github.com/actions/upload-artifact | upload path와 hidden-file 기본 제외 | 비숨김 staging과 exact three-file upload |
| WebdriverIO Tauri Service | https://webdriver.io/docs/desktop-testing/tauri/ | embedded WebDriver service | 단일 cross-platform E2E 구성 |
| WebdriverIO Tauri Plugin Setup | https://webdriver.io/docs/desktop-testing/tauri/plugin-setup/ | test-only plugin과 권한 | production surface 분리 |
| Vue TypeScript Guide | https://vuejs.org/guide/typescript/overview | Vue 3 TypeScript와 typecheck | vue-tsc 분리 QA |
| Vite Guide | https://vite.dev/guide/ | 개발 서버와 build | frontend bootstrap |
| Vite Features | https://vite.dev/guide/features.html | TypeScript transpile 동작 | typecheck를 별도 gate로 유지 |
| Tailwind with Vite | https://tailwindcss.com/docs/installation/using-vite | Vite 설치 방식 | styling bootstrap |
| Pinia Introduction | https://pinia.vuejs.org/introduction.html | Vue state management | UI/shared state 경계 |
| Vue Router Guide | https://router.vuejs.org/guide/ | Vue 3 routing | feature page routing |
| Prisma ORM | https://www.prisma.io/docs/orm | ORM 개요 | schema/client 검토 |
| Prisma SQLite Quickstart | https://www.prisma.io/docs/prisma-orm/quickstart/sqlite | SQLite 연결 | local DB bootstrap |
| Prisma Migrate | https://www.prisma.io/docs/orm/prisma-migrate | migration workflow | schema 변경 source |
| Prisma Referential Actions | https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions | relation action | Foreign Key 설계 |
| Prisma System Requirements | https://www.prisma.io/docs/orm/reference/system-requirements | 지원 runtime 요구 | Tauri runtime ADR |
| Prisma Generators | https://www.prisma.io/docs/orm/prisma-schema/overview/generators | generator runtime | Tauri runtime ADR |
| Prisma Migrate Limitations | https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues | provider별 migration | PostgreSQL 이전 한계 |
| Prisma Migration Histories | https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories | migration history | provider 전환 계획 |
| Prisma CLI Reference | https://www.prisma.io/docs/orm/reference/prisma-cli-reference | migrate diff와 exit code | schema·runtime DB drift gate |
| Apache ECharts Get Started | https://echarts.apache.org/handbook/en/get-started/ | chart setup | dashboard presentation |
| Apache ECharts Dataset | https://echarts.apache.org/handbook/en/concepts/dataset/ | data/chart 분리 | service 결과 표현 |
| Zod | https://zod.dev/ | TypeScript schema validation | form/import/IPC 경계 |
| Zod Basics | https://zod.dev/basics | parse와 safeParse | 오류 수집 계약 |
| dayjs Parse | https://day.js.org/docs/en/parse/parse | 날짜 parsing | 날짜 service |
| dayjs String Format | https://day.js.org/docs/en/parse/string-format | strict custom format | Excel/CSV 날짜 validation |
| SQLite Online Backup API | https://sqlite.org/backup.html | live database snapshot | WAL DB 자동·수동 backup |
| SQLite PRAGMA | https://sqlite.org/pragma.html#pragma_integrity_check | integrity/foreign key 검사 | backup·restore candidate 검증 |
| SQLite Security | https://sqlite.org/security.html | untrusted database 방어 | restore 파일 first-statement integrity 검사 |

## 확인된 설계 영향

- Vite의 transpile과 TypeScript typecheck는 별도 단계로 둔다.
- Windows installer는 WebView2 offlineInstaller를 포함한다. hosted runner는 WebView2 미설치 환경을 증명하지 못하므로 clean VM 수동 검증을 분리한다.
- Tauri CLI 2.11.4는 NSIS 생성 중 main binary의 첫 `UNK` bundle marker를 `NSS`로 patch한 payload를 담고 이후 build output을 복원한다. installed identity는 이 exact 동길이 치환 외 모든 byte의 equality로 검증하고 실제 installed hash를 별도로 기록한다.
- Tauri core 2.11.5는 configured window를 user setup hook보다 먼저 build한다. 또한 잠긴 PathResolver의 `app_data_dir()`는 `data_dir()/identifier`이고, 잠긴 dirs 6.0.0의 Windows `data_dir()`는 `FOLDERID_RoamingAppData`이므로 BODAM 생산 DB는 exact roaming identifier 경로에 결속된다. window handle만으로 database·IPC readiness를 주장하지 않고, exact roaming DB·renderer daily backup·빈 workspace가 안정된 뒤에만 정상 close를 요청한다.
- Production close smoke는 `CloseMainWindow` 1회와 bounded `WaitForExit`·exit code 0을 요구한다. force stop은 실패 cleanup일 뿐 정상 종료나 exit-backup 성공 증거가 아니다.
- Windows backup은 fixed drive로 분류된 NTFS에서 directory HANDLE 상대 open과 reparse-point 비추적을 사용하고, 열린 volume/file identity를 대사한다. native dialog 선택 순간부터 HANDLE이 이어진다고 주장하지 않는다.
- Windows archive rename·delete는 DELETE 권한으로 연 HANDLE을 대상으로 수행하고, hosted artifact는 production installer·checksum·sanitized evidence의 exact allowlist만 허용한다.
- `FlushFileBuffers` 증거는 지정한 열린 file의 buffered data flush에 한정한다. parent-directory metadata durability, 전원 손실 뒤 rename 영속성 또는 Unix directory `fsync`와 같은 보장을 Windows local NTFS pass에서 주장하지 않는다.
- Hosted WebView2 보존 검사는 production install 직후 Microsoft x64 HKLM/HKCU `pv (REG_SZ)`에서 관찰한 logical record와 version이 uninstall·cleanup 뒤에도 exact-equal임을 증명한다. pre-install version 불변, runtime 파일 전체, updater 동작이나 clean-VM bootstrap까지 증명하지 않는다.
- WebView2 host process 종료만으로 app-owned UDF의 browser/child process handle 해제가 보장되지 않는다. Hosted cleanup은 exact direct-child·no-reparse 검사를 매 attempt 반복하고 `IOException`의 `ERROR_SHARING_VIOLATION`만 20회×250ms 재시도한다. 대상 probe는 exact `ItemNotFoundException`만 부재로 인정하고 provider·access 오류를 전파한다. shared `msedgewebview2` process는 종료하지 않으며 다른 오류와 exhausted lock은 fail-closed다.
- Node의 CVE-2024-27980 완화 이후 Windows `.bat`/`.cmd` shim은 `spawnSync`로 직접 실행할 수 없고, args와 `shell: true`의 결합은 deprecated이자 command-injection 경계다. E2E launcher는 이 보안 변경을 되돌리지 않고 `process.execPath`로 잠긴 Tauri `tauri.js`와 부모 npm의 검증·고정된 `npm-cli.js`를 exact argv로 실행한다.
- 잠긴 Tauri CLI 2.11.4 NSIS renderer는 source `WebviewInstallMode::Skip`을 literal `skip`이 아니라 empty `INSTALLWEBVIEW2MODE ""`로 출력한다. Source config의 exact `skip`과 rendered empty define을 함께 검사하고 download/embed/offline named mode를 허용하지 않는다.
- Tauri는 base 뒤에 platform config와 CLI config를 병합하고 file association 같은 값을 raw helper로 template에 소비할 수 있다. Base/E2E source 전체를 newline-normalized UTF-8 hash로 고정하고 세 Windows platform config 이름을 금지하며, production과 E2E command graph 전체를 고정한다.
- Pinned NSIS preprocessor surface는 directive 이름과 include 순서뿐 아니라 같은 output directory의 `utils.nsh`, `FileAssociation.nsh`, raw `English.nsh` hash에 결속한다. Include 검색 directory 변경, built-in shadow, later include와 임의 plugin/finalizer는 거부한다.
- `UNINSTALLERSIGNCOMMAND`는 empty로, `ADDITIONALPLUGINSPATH`는 regular/non-reparse Tauri NSIS parent shape와 sole `nsis_tauri_utils.dll` official SHA-1로 결속한다. Symbolic directive가 동일해도 참조 define 값으로 finalizer/plugin을 바꾸는 우회를 허용하지 않는다.
- Windows installed suite는 complete `package.json`/`package-lock.json`, entire scripts map, 54개 E2E JavaScript module 및 `wdio.conf.mjs` trust tree를 함께 고정한다. Checkout 직후 `python3 -I` direct gate가 exact reviewed checker를 실행 전 hash로 확인하고 `.npmrc`와 higher-precedence `npm-shrinkwrap.json`을 거부한다. 이 gate는 setup-node의 npm cache 조회보다 먼저 실행되며 이후에만 `npm ci --ignore-scripts`를 실행한다.
- PowerShell `Import-Module -Force`는 기존 module을 제거 후 다시 불러오므로 caller와 nested module이 같은 dependency를 연속 강제 reload하지 않는다. Caller가 dependency를 먼저 로드하고 rendered parser는 module-qualified command로 exact dependency implementation을 호출한다.
- Release workflow의 remote action은 검증한 full-length commit SHA와 사람이 읽는 tag comment를 함께 고정한다. tag comment는 provenance 설명이며 실행 ref가 아니다.
- upload-artifact는 점으로 시작하는 directory 내부 파일도 기본 제외하므로 release staging은 ignored non-hidden `runtime-data/windows-release`를 사용하고 `include-hidden-files: false`를 유지한다.
- Prisma Client는 Rust runtime을 제공하지 않는다. ADR-001은 Prisma schema/migration artifact와 Rust executor의 경계를 명시한다.
- Prisma provider 변경 시 SQLite migration history를 PostgreSQL에 그대로 재사용한다고 가정하지 않는다.
- dayjs는 달력 UI component가 아니다.
- Prisma schema와 migration SQL만 schema source로 사용하고 Rust는 동일 file을 실행한다. executor history가 Prisma와 같다고 주장하지 않는다.
- renderer-only browser test와 실제 Tauri WebDriver E2E 증거를 구분한다.
- WebdriverIO Tauri service의 embedded provider는 macOS·Windows·Linux를 지원한다. WebDriver plugin은 test build에만 등록하고 production release에서는 활성화하지 않는다.
- SQLite online backup API는 live source를 일관된 destination snapshot으로 만들며 WAL 파일을 raw copy할 필요가 없다.
- restore candidate는 업무 query나 migration 전에 integrity와 schema 계약을 먼저 검사한다.
- single-instance plugin은 다른 plugin보다 먼저 등록하고 두 번째 실행의 args·cwd는 사용·기록하지 않으며 기존 main window focus만 수행한다.

## Source Rules

- framework, platform, installer, runtime 요구가 바뀔 수 있으므로 관련 계획 시작 시 재확인한다.
- 블로그보다 공식 문서를 우선한다.
- 이 표를 법률·의료·재무 적합성 판단 근거로 사용하지 않는다.
