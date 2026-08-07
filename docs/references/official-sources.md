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
| Microsoft NtCreateFile | https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntcreatefile | directory HANDLE 상대 open과 reparse 동작 | Windows backup 경로 결속 |
| Microsoft file handle information | https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getfileinformationbyhandleex | 열린 file/directory identity와 entry 정보 | Windows identity 대사 |
| Microsoft SetFileInformationByHandle | https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle | HANDLE 기반 rename/delete | Windows archive publish와 cleanup |
| Microsoft GetVolumeInformationByHandleW | https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getvolumeinformationbyhandlew | 열린 객체의 filesystem·volume 정보 | local NTFS 경계 |
| Microsoft FlushFileBuffers | https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers | 열린 file HANDLE의 buffered data flush | file 내용 flush와 metadata durability 주장 경계 |
| Microsoft WebView2 Distribution | https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#detect-if-a-suitable-webview2-runtime-is-already-installed | x64 HKLM/HKCU `pv (REG_SZ)` runtime 탐지 | shared WebView2 등록 보존 snapshot |
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
- Windows backup은 fixed drive로 분류된 NTFS에서 directory HANDLE 상대 open과 reparse-point 비추적을 사용하고, 열린 volume/file identity를 대사한다. native dialog 선택 순간부터 HANDLE이 이어진다고 주장하지 않는다.
- Windows archive rename·delete는 DELETE 권한으로 연 HANDLE을 대상으로 수행하고, hosted artifact는 production installer·checksum·sanitized evidence의 exact allowlist만 허용한다.
- `FlushFileBuffers` 증거는 지정한 열린 file의 buffered data flush에 한정한다. parent-directory metadata durability, 전원 손실 뒤 rename 영속성 또는 Unix directory `fsync`와 같은 보장을 Windows local NTFS pass에서 주장하지 않는다.
- Hosted WebView2 보존 검사는 production install 직후 Microsoft x64 HKLM/HKCU `pv (REG_SZ)`에서 관찰한 logical record와 version이 uninstall·cleanup 뒤에도 exact-equal임을 증명한다. pre-install version 불변, runtime 파일 전체, updater 동작이나 clean-VM bootstrap까지 증명하지 않는다.
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
