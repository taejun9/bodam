# 공식 자료

확인일: 2026-08-06 KST

현재 변경 가능성이 있는 기술 사실은 아래 공식/1차 문서를 기준으로 한다. 링크를 재확인하지 않고 버전·요구사항을 단정하지 않는다.

| source | url | scope | used_for |
|---|---|---|---|
| Tauri 2 Start | https://v2.tauri.app/start/ | Desktop shell 개요 | Vue UI와 Rust core 경계 |
| Tauri Vite | https://v2.tauri.app/start/frontend/vite/ | Vite frontend 연동 | project bootstrap 후보 |
| Tauri Prerequisites | https://v2.tauri.app/start/prerequisites/ | Windows 개발 요구사항 | Build Tools와 WebView2 준비 |
| Tauri Windows Installer | https://v2.tauri.app/distribute/windows-installer/ | MSI/NSIS와 WebView2 방식 | offline installer 결정 |
| Tauri Dialog Plugin | https://v2.tauri.app/plugin/dialog/ | native open/save dialog | import/export/backup 경로 선택 |
| Tauri File System Plugin | https://v2.tauri.app/plugin/file-system/ | local file 접근 | 파일 adapter |
| Tauri Capabilities | https://v2.tauri.app/security/capabilities/ | command와 scope 권한 | 최소 권한 설계 |
| Tauri SQL Plugin | https://v2.tauri.app/plugin/sql/ | SQLite driver와 migration 선택지 | Prisma와 이중 migration 방지 검토 |
| Tauri Node Sidecar | https://v2.tauri.app/learn/sidecar-nodejs/ | Node sidecar packaging | Prisma runtime option A |
| Tauri Rust Commands | https://v2.tauri.app/develop/calling-rust/ | typed custom command | feature IPC adapter |
| Tauri Permissions | https://v2.tauri.app/security/permissions/ | app command permission | main window command 제한 |
| Tauri WebDriver | https://v2.tauri.app/develop/tests/webdriver/ | 실제 desktop UI 자동화 | macOS·Windows E2E |
| Tauri WebDriver CI | https://v2.tauri.app/develop/tests/webdriver/ci/ | Windows runner 예제 | Windows release app QA |
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

## 확인된 설계 영향

- Vite의 transpile과 TypeScript typecheck는 별도 단계로 둔다.
- Windows installer는 WebView2 offlineInstaller를 포함한다. hosted runner는 WebView2 미설치 환경을 증명하지 못하므로 clean VM 수동 검증을 분리한다.
- Prisma Client는 Rust runtime을 제공하지 않는다. ADR-001은 Prisma schema/migration artifact와 Rust executor의 경계를 명시한다.
- Prisma provider 변경 시 SQLite migration history를 PostgreSQL에 그대로 재사용한다고 가정하지 않는다.
- dayjs는 달력 UI component가 아니다.
- Prisma schema와 migration SQL만 schema source로 사용하고 Rust는 동일 file을 실행한다. executor history가 Prisma와 같다고 주장하지 않는다.
- renderer-only browser test와 실제 Tauri WebDriver E2E 증거를 구분한다.
- WebdriverIO Tauri service의 embedded provider는 macOS·Windows·Linux를 지원한다. WebDriver plugin은 test build에만 등록하고 production release에서는 활성화하지 않는다.

## Source Rules

- framework, platform, installer, runtime 요구가 바뀔 수 있으므로 관련 계획 시작 시 재확인한다.
- 블로그보다 공식 문서를 우선한다.
- 이 표를 법률·의료·재무 적합성 판단 근거로 사용하지 않는다.
