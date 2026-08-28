# plan-034-settings-system-theme Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-034-settings-system-theme.md`
- reviewed tree: `codex/plan-034-settings-system-theme` before commit
- baseline: main `8f6c18b764f789aaaf519858d41fec25a5380b37`
- reviewers: independent code·migration·accessibility and product·privacy·Google boundary
- reviewed_at: 2026-08-28 KST

## QA Evidence

- final post-finding `npm run verify`: exit 0 after Vitest 90 files/389 tests, Rust 321 tests, lint, typecheck, Prisma validation·registry·diff, Vite production build, Tauri check and repository harness.
- release Tauri native write 6/6 and restart 4/4; Customer, policy, coverage, benchmark, family, consultation, Dashboard, Calendar and Schedule persisted through real UI/IPC/SQLite paths.
- XLSX/CSV import·persistence·export·independent-parser round-trip, transaction rollback and logical database assertions passed.
- Settings, custom backup, manual backup, restore-before-open, exact restored database, re-authorization and exit/idempotency parent orchestration passed.
- focused frontend: pre-paint production build order, system dark/light cold start, runtime OS change, three-state navigation and concurrent Settings/topbar failure included in 3 files/11 tests.
- focused native: Settings database 8 tests, settings validation/repository/commands 10 tests, database module 48 tests and v9 backup working-copy migration passed.
- `cargo fmt --check`, `git diff --check`, 300-line, sensitive artifact and capability gates passed.

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P2 | theme cache and OS preference were applied only after the Vue module graph loaded, allowing a light flash on system-dark cold start | synchronous same-origin head bootstrap plus source behavior and production build-order regression tests |
| resolved P2 | a failed topbar optimistic rollback could overwrite a newer canonical Settings save | apply topbar theme only after persistence succeeds and retain newer shared-store state on failure, with deferred concurrency regression test |
| none | no remaining or new P0–P3 code, migration, product-scope, privacy or QA evidence finding | two independent post-finding reviews approved the result |

## Requirements Trace

- Existing `/settings` was extended rather than duplicated and now exposes light, dark and system choices.
- SQLite remains canonical; v10 expands only the theme check while preserving v9 rows, timestamps, numeric settings and custom backup path.
- The cached preference can be `light|dark|system`, while DOM theme and `color-scheme` remain resolved `light|dark`.
- System preference follows runtime OS changes without another database write, and listener registration is idempotent and cleaned up.
- Existing Dashboard, backup and Coverage Benchmark settings remain in place.
- Google OAuth, Calendar API traffic, token storage and synchronization were excluded pending explicit data and conflict decisions.

## Privacy Review

- No real customer row, calendar event, attachment, credential or private path was copied into source, fixtures, documentation, logs or screenshots.
- Google tokens and customer/calendar payloads were not added to SQLite, localStorage, backup, IPC or logs.
- No network dependency, remote endpoint or broad Tauri capability was introduced.
- Future refresh tokens must use the OS credential store and disconnect must revoke and permanently delete the local credential.

## Residual Risk

- Google Calendar connection is not implemented; account consent, transmitted fields, sync direction, deletion/conflict rules and external-production verification remain a separate approved plan.
- If localStorage is unavailable, cold start safely uses light until SQLite loads; the canonical setting remains intact.
- Vite reports the existing production main chunk at 533.56 kB, above its 500 kB warning threshold.
- Restore and three exit-oriented WDIO reporter sessions show `FAILED` for intentional restart/termination; the parent runner validates restored state and cleanup and exits 0.

## Follow-Ups

- 향후 별도 승인 plan: BODAM-created secondary Google calendar, BODAM-to-Google one-way manual sync, Schedule-only minimum fields, Desktop OAuth Authorization Code with PKCE/state and OS credential storage.
- Decide whether any customer name or memo may leave the device before expanding transmitted fields or enabling automatic/bidirectional sync.
- Consider route-based code splitting only if measured startup or navigation performance warrants it.
