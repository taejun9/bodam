# plan-010-data-exchange Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-010-data-exchange.md`
- reviewed tree: `codex/plan-010-data-exchange` worktree before commit
- baseline: main `bf7cedb`
- reviewer roles: 독립 domain/data `review_judge`, UI/accessibility reviewer, `privacy_guard`
- review order: 전체 QA, 읽기 전용 리뷰, finding 수정·회귀, 전체 QA 재실행, 세 심사자의 QA 이후 최종 승인
- reviewed_at: 2026-08-07 KST

## QA Evidence

- 최종 `npm run verify`: PASS — ESLint, `vue-tsc`, Vitest 62 files/280 tests, Prisma validate/diff와 migration registry/hash, Rust default 178 tests, Vite/Tauri check, base harness 포함
- `cargo test --locked --all-features`: 188/188 PASS; all-targets/all-features Clippy `-D warnings`, `cargo fmt --check`, `git diff --check` PASS
- `npm audit --audit-level=moderate`: 취약점 0건; 같은 resolved Rust lock set의 선행 audit도 취약점 0건이고 비대상 platform warning만 기록
- 실제 Browser 1280×720 dark/light: 데이터 관리 안내·disabled Browser selector·privacy contract, 문서 overflow 0과 AA 보조 문구 확인
- 실제 Browser 390×844: card layout, drawer 첫 link focus와 background inert, route 뒤 `MAIN#main-content`, sidebar hidden, `scrollWidth=innerWidth=390` 확인
- 실제 macOS native Open dialog: cancel 뒤 무변경, 합성 XLSX select, preview total 3/valid 3/error 0/duplicate 1과 원본 SHA-256 불변 확인
- 실제 macOS release E2E 15/15: 기존 domain write 6, 별도 process restart 4, XLSX write/restart, quoted multiline CSV write/restart, 후속 행 실패 전체 rollback
- XLSX 공격 회귀: forged actual unzip, shared-string reserve/item/logical text, normalized path collision, raw-cell coercion, wrapper와 root 전·내 malformed comment 우회 차단
- 표준 `BODAM.app` 2026-08-07 01:39:53 재생성; app/binary/dist E2E·WDIO·WebDriver·4445 marker 0, normal Cargo WDIO 0, permission `core:default`
- 최종 cleanup: 임시 `bodam-e2e-*`, repository SQLite/WAL/log artifact 0건

## Findings

| severity | finding | resolution |
|---|---|---|
| P1 | repeated update target overwrite | target ID 중복을 write 전 거부하고 atomic no-write 회귀 추가 |
| P1 | ZIP declared-size trust | 실제 해제 byte를 bounded chunk로 entry·total 합산 |
| P1 | shared-string reserve·logical amplification | item·decoded logical text 예산을 preview allocation 전 강제 |
| P2 | quoted CSV bare newline rejection | quote-aware CRLF envelope scanner 적용 |
| P2 | ECMAScript/Rust whitespace drift | duplicate와 Customer에 공용 ECMAScript trim, import NFC 적용 |
| P2 | commit busy dismiss semantics | Escape·X·backdrop·footer 차단, disabled close·busy ARIA 추가 |
| P2 | contrast와 long text bounds | AA secondary token과 4,000-scalar bounded wrappers 적용 |
| P2 | Calamine raw-cell coercion | shared/numeric/inline/formula value shape를 worksheet XML에서 선검사 |
| P2 | wrapper/malformed XML preflight bypass | permissive root discovery·nested `sheetData` 탐지 뒤 strict worksheet scan |
| P2 | mobile drawer focus isolation | 첫 link focus, background inert, Escape trigger와 route main focus 적용 |
| P2 | retry/clean-preview focus loss | stable selector·preview region·error summary focus 계약 추가 |
| P2 | commit summary overflow | count 상한, checked sum과 sourceRow upper bound 추가 |
| P3 | E2E path containment | canonical OS temp child, regular synthetic file, no symlink 계약 적용 |
| P3 | blank CSV field-count bypass | exact 21 field 검사를 blank skip보다 먼저 수행 |
| P3 | NUL duplicate-key collision | JSON tuple encoding으로 schema·service key 통일 |
| P3 | dialog description association | 고유 ID와 `aria-describedby` 연결 |

세 독립 최종 재리뷰에서 미해결 P0–P3 actionable finding은 0건이었다.

## Requirements Trace

- 진입 계약: sidebar `데이터 관리`, `/data-exchange`, Browser 안전 안내와 native pathless selector
- 파일 계약: 10 MiB, XLSX archive/item/logical text bounds, exact sheet/A:U header, CSV BOM·CRLF·RFC 4180·21 fields
- 원본 계약: 21 named string/null DTO와 v8 1:1 source columns, mapped G/H/J/K/N/R/T, raw leading zero 보존
- 결정 계약: explicit existing/new Customer, DB/batch duplicate default skip, exact update와 separate-create
- transaction 계약: raw remap, strict DTO/count, snapshot·active parent·duplicate 재검사, `BEGIN IMMEDIATE` 전체 rollback
- visibility 계약: Policy/Customer soft delete 시 source·duplicate 숨김, update 시 manual Policy field·Coverage·Customer 보존
- UI 계약: table/cards, expandable source, loading/error/result, dialog/focus/inert, 390px no document overflow
- persistence 계약: clean/v7 upgrade/drift tests, release SQLite write·restart와 same-file default skip
- capability 계약: no broad fs/shell/process/network, standard permission `core:default`, E2E seam은 feature+temp synthetic runtime 전용

## Privacy Review

- 실제 고객 workbook·행·경로·계약 식별값을 source/test/docs/log/screenshot에 복사하지 않았다.
- native dialog가 직접 선택한 파일만 읽고 IPC에 arbitrary path를 받지 않으며 원본 bytes와 전체 경로를 보관하지 않는다.
- error/result는 safe code·row·field만 사용하고 rejected cell, Customer/Policy ID와 SQL을 반사하지 않는다.
- 저장하는 21열 원문은 재업로드 duplicate와 같은 열 export 목적의 named record로 제한되고 active parent visibility를 따른다.
- production bundle에는 E2E path/failure seam, WDIO/WebDriver capability와 remote/network 기능이 없다.

## Residual Risk

- SQLite와 WAL은 OS 계정 수준 평문이고 soft-deleted Policy의 21열 source는 parent 수명 동안 보존된다.
- XLSX 방어는 합성 adversarial corpus 중심이며 장시간 OOXML fuzz/differential corpus를 수행하지 않았다.
- snapshot은 millisecond timestamp에 의존해 앱 밖에서 timestamp를 보존한 직접 DB 변경은 탐지 보장 밖이다.
- context의 여러 read는 단일 transaction snapshot이 아니어서 극단적 동시 변경 시 preview가 보수적으로 실패할 수 있다.
- E2E-only path는 canonical temp 검사를 하지만 test feature trust model의 검사 뒤 교체 TOCTOU는 production에 존재하지 않는 잔여 위험이다.
- 자동 axe·실제 VoiceOver 발화·전체 Tab cycle과 Windows 설치 패키지 E2E는 아직 수행하지 않았다.

## Follow-Ups

- plan-011에서 승인된 21열 export, backup/restore, Settings와 배포 마감을 작은 수직 범위로 구현·검증한다.
- 실제 고객 데이터 규모가 커지면 익명화한 corpus, parser fuzzing과 context read snapshot을 별도 승인·증거와 함께 검토한다.
