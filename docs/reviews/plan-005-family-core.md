# plan-005-family-core Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-005-family-core.md`
- reviewed tree: `codex/plan-005-family-core` worktree before commit
- baseline: main `ddb0494`
- reviewer roles: 독립 정확성 `review_judge`, UI/접근성 reviewer, `privacy_guard`
- review order: 전체 QA PASS 후 1차 리뷰, findings 해결·회귀 검증, 최종 읽기 전용 재리뷰
- reviewed_at: 2026-08-06 KST

## QA Evidence

- 최종 `npm run qa`: PASS — Vitest 17 files / 70 tests, Rust 63 tests, Prisma validate/diff, Vite build, cargo check와 harness 포함
- `cargo test --all-features`: 63/63 PASS; rustfmt와 all-targets/all-features clippy `-D warnings` PASS
- v4 migration SHA-256 `d57399a43d17ff5b9a9f22975ab925f1bd217d6e78b950471015084ec692671e`; v3 upgrade 보존·history/runtime schema/FK/unique drift PASS
- `npm audit --audit-level=low`: 취약점 0건; `git diff --check`, line/privacy/artifact scan PASS
- in-app Browser: Family 생성·Customer 연결·123,456원 합계·Escape 복귀·reload·삭제 PASS
- 390×844 Browser: card 전환, 가로 overflow 0, dialog 358px 내부 overflow 0, console warning/error 0건
- release-mode macOS 앱: write 2/2 PASS(14.4s), 새 프로세스 persistence 2/2 PASS(10.4s)
- native E2E에서 다대다 200,000원 합계, 중복 이름 ID, active pair conflict, membership ID 재사용, Policy/Customer/Family soft delete와 restart를 검증
- 표준 `BODAM.app` 재빌드 뒤 binary·Info.plist·dist·default Cargo feature tree에서 E2E DB override, WDIO/WebDriver와 4445 표식 0건

## Findings

| severity | finding | resolution |
|---|---|---|
| P2 | Browser locale lowercase와 SQLite ASCII `NOCASE`의 비ASCII 검색 불일치 | Browser를 SQLite-compatible ASCII fold로 통일하고 Browser/Rust parity 테스트 추가 |
| P2 | 중복 Family/Customer ID가 light theme에서 3.64:1 대비 | `--text-secondary` 적용으로 light 5.65:1, dark 8.78:1 확보 |
| P2 | 모든 활성 고객 연결 뒤 추가 불가 이유가 disabled button `title`에만 존재 | 보이는 status와 `aria-describedby`, unit/native E2E 추가 |
| P2 | 삭제·필터 밖 rename 뒤 호출 행 제거 시 focus가 body로 유실 | 갱신 뒤 존속 검색 입력으로 focus 이동, page/native E2E 추가 |
| P1 | 최종 E2E 직후 계측용 DB override·WebDriver app artifact 잔존 | feature 없는 표준 앱 재빌드와 binary/Info.plist/dist/default feature 무검출 재검사 |

모든 finding 해결 뒤 세 독립 재리뷰에서 신규 또는 미해결 P0–P3 finding이 없음을 확인했다.

## Requirements Trace

- 승인 범위: Family CRUD, Customer 다대다 membership, 선택 관계명, Family별 월보험료 합계, v4 migration, Browser/native persistence
- 저장 계약: Family 이름과 membership 연결·관계명·timestamps·`deletedAt`만 저장하며 파생 합계는 저장하지 않음
- 합계 계약: 활성 Family·membership·Customer와 활성 `isIncluded=true` Policy만 TypeScript `bigint`로 합산
- 삭제 계약: Family·Customer·membership 원본 유지, active read·합계 숨김, hard delete FK `RESTRICT`
- 재활성화 계약: 같은 `(familyId, customerId)` pair 재추가는 기존 membership ID와 createdAt을 재사용
- adapter 계약: Browser/Tauri strict validation, active-parent, conflict, reactivation과 ASCII `NOCASE` 검색 parity
- migration 계약: v3 행 보존, version/order/hash/history와 table·column·index·FK·unique runtime drift 검사
- non-goal 준수: 대표자·관계 enum·가족 보장 합계·원격 통신·민감 병력 필드를 추가하지 않음

## Privacy Review

- Family 이름·관계명 외 대표·법적 관계·성별·민감 병력·보험사 로그인 정보를 저장하지 않는다.
- Zod/Rust strict payload, canonical UUID와 Unicode scalar 100자 경계가 적용된다.
- validation/repository 오류는 거부값·SQL·DB 행 원문 대신 고정 사용자 메시지만 노출한다.
- Browser/native E2E는 명시적인 합성 데이터와 종료 시 제거되는 임시 SQLite만 사용했다.
- production capability는 `core:default`만 보유하며 broad filesystem, shell, network, telemetry, WebDriver 권한이 없다.

## Residual Risk

- Windows x64 NSIS·WebView2 미설치·network-offline VM 설치와 native E2E는 아직 실증하지 않았다.
- 로컬 SQLite는 암호화되지 않아 OS 계정·디스크 보호에 의존한다.
- 자유 입력 안내는 금지 민감정보 입력을 기술적으로 차단하지 않는다.
- soft-deleted 업무 데이터는 원본을 유지하며 별도 보존기간·purge 기능이 없다.
- Browser preview localStorage는 개발용이며 여러 탭 동시 갱신에 CAS/lock이 없다.
- Family 합계는 여러 공개 application/IPC 조회를 조합하므로 단일 DB snapshot은 아니다.

## Follow-Ups

- 다음 수직 계획에서 Consultation 기록과 후속 일정 핵심 흐름을 구현한다.
- 이후 Benchmark, Dashboard, Calendar, Import/Export, Backup/Restore를 작은 승인 계획으로 진행한다.
- 최종 release에서 Windows x64 NSIS와 offline VM 전체 회귀를 수행한다.
