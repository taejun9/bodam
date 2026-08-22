# plan-033-app-quality-audit Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-033-app-quality-audit.md`
- reviewed tree: `codex/plan-033-app-quality-audit` before commit
- baseline: main `140003bd81df81bc876176dc4fc4aeaa2ad9d88f`
- reviewers: independent code·accessibility·product/privacy and QA evidence
- reviewed_at: 2026-08-22 KST

## QA Evidence

- final post-finding `npm run verify`: Vitest 89 files/382 tests, Rust 319 tests, Prisma registry/diff, Vite production build, Tauri check, full harness and release-mode macOS Tauri E2E PASS.
- release Tauri native write 6/6 and restart 4/4; Customer, policy, coverage, benchmark, family, consultation, Dashboard, Calendar and Schedule persisted through real UI/IPC/SQLite paths.
- XLSX/CSV import·persistence·export·independent-parser round-trip, transaction rollback and logical DB assertions PASS.
- Settings, custom backup, manual backup, restore-before-open, exact restored DB, re-authorization and exit/idempotency parent orchestration PASS.
- Browser actual desktop and 390×844: all routes, synthetic CRUD, validation/focus, theme, current-route mobile menu, responsive cards, placeholder computed style and native-only safe guidance PASS; console error/warning 0.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`, `git diff --check`, 300-line and sensitive artifact gates PASS.

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P2 | Schedule soft-delete 뒤 Calendar reload 실패 시 agenda action이 사라져 keyboard focus가 유실됨 | agenda 등록 → Calendar 재시도 → 제목 fallback과 별도 actual mount rejection test 추가 |
| resolved P2 | `--text-muted` 위 placeholder opacity 0.75가 light/dark 실제 합성 대비를 4.5:1 아래로 낮춤 | opacity 1과 두 theme·두 form background alpha-composite contrast test, Browser computed-style 확인 |
| resolved P3 | Coverage 관계의 반대 방향 선택 계약과 개선 후보 수 기록이 불완전함 | Policy는 Coverage 없이 가능, 각 Coverage는 Policy/category 필수로 명시하고 후보 수를 7개로 정정 |
| none | 잔여 P0–P3 code, product-scope, privacy or QA evidence finding 없음 | independent post-finding review 승인 |

## Requirements Trace

- 고객·가족·보험계약·보장·Benchmark·상담·Dashboard·Calendar·일정·설정·데이터 교환·백업의 현재 MVP를 기능 매트릭스로 대사했다.
- Browser preview는 시각·keyboard·responsive 증거, release Tauri E2E는 native SQLite·IPC·filesystem·restart 증거로 구분했다.
- 새 저장 필드·migration·보험 판단 규칙·원격 통신을 추가하지 않고 기존 application 계약 안의 오류 복구와 접근성만 개선했다.
- Windows installer 실기동을 현재 macOS 검증으로 과장하지 않고 NOT RUN으로 유지했다.

## Privacy Review

- Browser와 Tauri E2E 모두 합성 고객·계약·파일 fixture만 사용했고 실제 고객 행이나 첨부 원본을 소스·문서·로그·screenshot에 복사하지 않았다.
- 주민등록번호, 보험사 로그인 정보, 민감·상세 병력 저장 필드나 원격 전송, telemetry, broad filesystem 권한을 추가하지 않았다.
- 변경은 UI focus·오류 설명·색 대비·문서 정합성에 한정되며 SQLite, soft delete, backup capability 경계는 바뀌지 않았다.

## Residual Risk

- 기준 npm graph에는 high 17건이 남고 `npm audit --omit=dev`는 transitive `nanoid@3.3.17` 1건을 보고한다. 최소 override도 검증된 Windows npm trust hash를 바꾸므로 현재 plan에서 철회했고 `--force`나 hash 임의 갱신은 하지 않았다.
- Vite production main chunk 532.49 kB와 E2E main chunk 535.40 kB가 500 kB warning을 낸다.
- Windows NSIS wizard, UAC, WebView2 없는 network-blocked offline VM은 현재 macOS 환경에서 NOT RUN이다.
- local SQLite·backup·export는 평문이며 실제 운영은 전용 OS 계정, 전체 디스크 보호와 자동 잠금에 의존한다.
- restore와 세 exit-oriented WDIO reporter session의 `FAILED`는 의도된 app restart/exit이며 성공한 parent runner가 restored state와 cleanup을 검증했다.

## Follow-Ups

- dependency 변경은 Windows trust evidence와 package lock을 함께 재검증하는 별도 승인 plan에서 처리한다.
- 실제 측정에서 startup/navigation 영향이 확인되면 route-based code splitting을 검토한다.
- 실데이터 도입 전 전용 OS 계정, 전체 디스크 보호, 자동 화면 잠금과 보호된 backup/export 위치를 확인한다.
