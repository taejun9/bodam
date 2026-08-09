# plan-030-portfolio-user-guide Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-030-portfolio-user-guide.md`
- reviewed tree: `codex/plan-030-portfolio-user-guide` before commit
- baseline: main `07ca149331f8bcb93437844567bd8c16a3c29d2e`
- reviewers: independent artifact, product/privacy and QA evidence
- reviewed_at: 2026-08-09 KST

## QA Evidence

- final `npm run qa`: ESLint, vue-tsc, frontend 84 files/370 tests, Prisma registry/diff, Rust 319 tests, Vite production build, Tauri check and base harness PASS.
- portfolio: PPTX 14 slides, PDF 14 pages, all-page render and montage review, `slides_test.py` overflow 0 and 14 source notes PASS.
- user guide: DOCX 15 pages, PDF 15 pages, all-page render and montage review, table geometry PASS, 8 inline images and accessibility high/medium/low 0/0/0.
- PDF `pdfinfo`, Poppler all-page render and `pdftotext` Korean extraction PASS; unresolved placeholder and broken glyph scans PASS.
- Downloads copies are non-empty, Office ZIP integrity passes and all four SHA-256 values match the reviewed final artifacts.
- `python3 harness/scripts/run_review.py`, `git diff --check`, 300-line and sensitive artifact gates PASS.

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P2 | slide 13 speaker notes cited a nonexistent Plan-029 filename | corrected to `plan-029-quality-workflow-validation.md` and verified all 14 source paths |
| resolved P2 | slide 11 `자동 잠금` could imply an implemented app lock | clarified as `OS 화면 자동 잠금` |
| resolved P2 | reviewer edits made the plan's PPTX/PDF hashes stale | replaced them with the final artifact and Downloads copy hashes |
| residual P3 | several data-exchange and restore terms could include plainer Korean equivalents; page 10 omits the otherwise common evidence row | non-blocking editorial follow-up; current instructions remain accurate and executable |
| none | no remaining P0-P2 artifact, product-scope, privacy or QA evidence finding | independent final review approved |

## Product And Documentation Fit

- the 14-slide portfolio presents BODAM as a Windows-first, offline-capable local desktop CRM for one insurance planner without claiming SaaS, official recommendation or unverified outcomes.
- the 15-page guide covers start, privacy, Customer, Policy, Coverage, Benchmark, Consultation, Family, Calendar, Dashboard, data exchange, Settings and backup/restore workflows.
- current functions, native-only behavior, future scope and unresolved product rules are separated instead of presenting requirements as implemented features.
- captions identify synthetic preview data and native import/export/backup controls that browser preview cannot validate.

## Privacy Review

- only synthetic names, contact values, policy examples and screenshots are present; no real customer row or attached import source was found.
- prohibited identifiers, insurer credentials, tokens and detailed medical history are absent from artifacts and metadata.
- the documents explicitly treat SQLite, import/export, temporary files and `.bodam-backup` as sensitive plaintext data.
- OS account, full-disk protection, OS screen locking and protected off-device backup are described as operating controls; no app lock or encryption is claimed.

## Residual Risk

- browser preview screenshots cannot demonstrate native SQLite persistence, import/export file dialogs or backup/restore; those controls are labeled as native-only and repository QA is cited separately.
- Windows installer bootstrap on a clean, network-blocked VM is not verified and is not presented as complete.
- local SQLite, exports and backups remain plaintext; safe operation depends on the user's OS and storage practices.
- advanced notification, purge/retention UI, team collaboration and official insurance suitability recommendations remain outside the current implementation.

## Follow-Ups

- if the guide is revised for first-time non-technical users, pair English implementation terms with plain Korean and add the missing evidence row for page-level consistency.
- before using real data, verify a dedicated Windows account, full-disk protection, OS automatic lock and a protected backup/export location.
- authorize a separate plan before expanding installation claims, app security, notification or insurance-advice behavior.
