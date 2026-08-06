# plan-009-calendar Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-009-calendar.md`
- reviewed tree: `codex/plan-009-calendar` worktree before commit
- baseline: main `1e2f990`
- reviewer roles: 독립 domain/data `review_judge`, UI·accessibility reviewer, `privacy_guard`
- review order: 전체 QA와 실제 Browser/native 증거 뒤 세 읽기 전용 리뷰, finding 수정·표적/전체 QA, 세 재리뷰, 최종 Browser와 native write/restart 재검증
- reviewed_at: 2026-08-06 KST

## QA Evidence

- 최종 `npm run qa`: PASS — ESLint, `vue-tsc`, Vitest 50 files / 225 tests, Prisma validate/diff, migration registry/hash, Rust default 114 tests, Vite production build, Tauri check와 base harness 포함
- `cargo test --all-features`: 114/114 PASS; `cargo fmt --check`와 all-targets/all-features Clippy `-D warnings` PASS
- `npm audit --audit-level=high`: 취약점 0건; `git diff --check`, 300줄·privacy·architecture·capability harness PASS
- Schedule validation/parity: 실제 date·`9998-12-31` 상한, local `HH:mm`, Unicode scalar 200/4,000, strict/null/boolean/UUID, Browser/Tauri response와 soft delete PASS
- migration v7: clean install, v6 upgrade 보존, idempotence, registry/hash, exact column/index/FK와 drift-before-mutation PASS
- Browser source scenario: 비관리 Customer, excluded Policy, 상담 2건, linked/unlinked Schedule로 상담·다음 연락·상령·만기·사용자 일정 5종과 stable 순서를 확인하고 UI soft delete로 정리
- 최종 Browser desktop: header row + 6 week row, 42 gridcell, selected cell 1, grid tab stop 1, document/body horizontal overflow 0
- 최종 Browser 390×844: `scrollWidth === innerWidth === 390`, agenda 전체 제목, dark/light, 일정 생성·삭제 dialog 취소 autofocus·Escape·trigger 복귀·삭제 reload와 console warning/error 0건
- 실제 macOS release 앱: write process 6/6 PASS, 별도 restart process 4/4 PASS. Schedule ID·날짜·시간·완료·연결과 5종 Calendar read model이 SQLite 재시작 뒤 동일함을 확인
- 최초 E2E 60초 outer timeout은 미완 Promise를 다음 spec과 겹치게 해 후속 Family/Dashboard/Calendar를 오염시켰다. 동작별 10초 guard를 유지하고 180초 envelope로 조정한 최종 실행은 write 27.8초, restart 47.4초로 PASS
- E2E SQLite·state·WDIO output을 하나의 임시 runtime에 두고 성공·실패 정리 뒤 `bodam-e2e-*`, `.runtime` log 잔존 0건 확인
- native E2E 뒤 standard `BODAM.app` 재생성; app·binary·dist에서 E2E DB override, clock/storage, WDIO/WebDriver와 port 4445 marker 0건, production permission `core:default`

## Findings

| severity | finding | resolution |
|---|---|---|
| P1 | Browser linked Schedule의 부모 검사와 Customer soft delete가 다른 lock이라 create/update TOCTOU 가능 | 두 repository mutation을 같은 origin lock에 참여시키고 gated parent-delete 경쟁 테스트 2개 추가 |
| P1 | Rust linked mutation이 commit 뒤 별도 row 조회를 해 Customer delete가 사이에 끼면 성공한 write를 실패로 보고할 수 있음 | create/update/setCompleted의 guard·mutation·response 조회·commit을 하나의 `BEGIN IMMEDIATE` transaction으로 묶고 경쟁 테스트 3개 추가 |
| P2 | column header가 grid 밖이고 week row가 없으며 `aria-selected`가 gridcell이 아닌 button에 있음 | grid 안 header row·6 week row·각 7 gridcell로 고치고 선택을 gridcell, 오늘을 button `aria-current=date`로 표현 |
| P2 | cell event chip/link/+N이 날짜 button 외 추가 tab stop이라 composite grid 탐색 계약을 깨뜨림 | cell action을 `tabindex=-1`로 두고 선택 날짜 button만 roving tab stop, 실제 동작은 agenda에서 keyboard 접근 유지 |
| P3 | Schedule 삭제 확인 dialog가 안전한 취소에 autofocus하지 않음 | 취소 `autofocus`, Escape와 trigger focus return 테스트·실제 Browser 확인 추가 |
| P3 | 0001/9999 canonical URL에서 날짜 이동 예외가 발생하고 9999 Schedule은 저장 후 조회·수정 경로가 없음 | Calendar view와 Schedule input/response 상한을 `9998-12-31`로 통일하고 범위 밖 canonicalize·경계 disabled/no-op·TS/Rust/UI 테스트 추가 |
| P3 | privacy 문서의 Schedule title 표시 위치가 삭제 확인 dialog를 누락 | 허용 표시 위치에 삭제 확인 dialog를 추가 |
| P3 | 실제 IPC write spec의 전역 60초 제한이 timeout 뒤 미완 흐름을 같은 WebDriver session에 남김 | 10초 단계 guard는 유지한 채 outer spec 180초, WDIO output 임시 runtime 정리와 전체 재실행 추가 |

수정 뒤 세 독립 재리뷰에서 신규 또는 미해결 P0–P3 actionable finding은 없었다.

## Requirements Trace

- 진입 계약: sidebar `달력`, `/calendar?month=YYYY-MM&date=YYYY-MM-DD`, invalid/out-of-range canonical replace
- view 계약: `0001-01`–`9998-12`, 일요일 시작 7열·6주, 이전/다음 경계 disabled, keyboard 이동 no-op/clamp
- source 계약: 모든 활성 Customer, 각 Consultation의 상담일·nextContact, excluded Policy maturity, birthDate 상령일, linked/unlinked Schedule
- 날짜 계약: explicit IANA timezone, Consultation UTC instant만 local 날짜·분 변환, date-only와 Schedule wall time 불변, 생일+6개월 month-end clamp
- event 계약: 5 kind, source별 stable ID, date·all-day·time·kind·title·id 안정 정렬, 상담 내용·결과 미복제
- Schedule 계약: title 1–200, real date ≤ `9998-12-31`, nullable minute time·memo ≤ 4,000·active Customer, completed visible, duplicate 허용
- visibility 계약: Customer soft delete 시 retained child·linked Schedule 숨김, unlinked Schedule 유지, Schedule 자체 soft delete
- mutation 계약: Browser origin shared lock, Rust immediate response transaction, strict application/IPC boundary와 safe error
- refresh 계약: mount, route, focus, hidden→visible, local midnight와 request number stale guard, source 하나 실패 시 partial result 없음
- UI 계약: semantic row/gridcell, selected/current, single roving tab stop, agenda keyboard actions, dialog label/error/focus/Escape/return, 390px no overflow
- persistence 계약: Schedule v7 FK `RESTRICT`/`CASCADE`, ordered indexes, migration upgrade/drift, separate native process persistence
- non-goal 준수: 주·일 보기, 반복·우선순위·drag and drop, notification, cache, remote API·sync·telemetry, 새 broad capability 없음

## Privacy Review

- 실제 고객 행, 첨부 원본, 주민등록번호, 보험사 로그인, 민감 병력·상세 병력을 source/test/docs/log/screenshot에 넣지 않았다.
- Schedule title·memo fixture는 명백한 합성 값이고 error/log에 rejected value나 row·SQL을 반사하지 않는다.
- memo 입력에 주민등록번호·보험사 로그인·민감 병력·상세 병력 저장 금지 안내를 제공한다.
- Calendar는 공개 application 결과의 표시 최소 DTO만 만들며 상담 내용·결과나 계산 event를 SQLite/Browser에 저장하지 않는다.
- soft-deleted Schedule와 deleted Customer에 연결된 원본은 DB에 남지만 기본 active read에서 숨긴다.
- production capability는 `core:default`뿐이고 filesystem·shell·network·telemetry·WebDriver 권한을 추가하지 않았다.
- E2E는 합성 데이터와 명시적 임시 SQLite만 사용하며 DB·sidecar·log를 같은 임시 runtime과 함께 정리한다.

## Residual Risk

- Calendar fan-out reader는 여러 공개 application read를 하나의 DB snapshot으로 묶지 않아 읽는 사이 source가 바뀔 수 있다.
- Customer별 Insurance·Consultation fan-out의 대규모 dataset 성능과 long-running stress는 아직 실증하지 않았다.
- Web Locks 미지원 Browser에서는 cross-tab mutation lock이 same-realm fallback으로 축소된다.
- 자동화된 axe/VoiceOver 접근성 트리 검증은 없고 semantic DOM 테스트와 실제 keyboard/visual QA에 의존한다.
- hidden→visible 직후 focus가 이어지면 read fan-out이 두 번 실행될 수 있으나 stale response는 화면을 덮지 않는다.
- 강제 종료는 E2E `finally` 정리를 우회할 수 있고, soft-deleted SQLite 원본과 Browser preview는 암호화되지 않는다.
- Windows x64 NSIS·WebView2 offline VM과 Windows native Calendar E2E는 최종 release 계획에서 검증해야 한다.
- 큰 native write spec은 180초 outer envelope 안에 여러 책임을 포함하므로 향후 단계별 spec 분리가 진단 격리를 개선한다.

## Follow-Ups

- 승인 프로필의 다음 수직 계획에서 Excel/CSV import·export를 parse/normalize/validate/commit과 privacy 경계로 구현한다.
- 이후 backup/restore, Settings와 Windows release를 작은 계획으로 진행한다.
- 실제 데이터 규모가 커지면 공개 batch application query나 명시적 Calendar read adapter를 별도 승인·snapshot·성능 증거와 함께 검토한다.
