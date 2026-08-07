# plan-024-windows-hosted-acceptance Review

## Verdict

pass-with-residual-risk

## Scope

- plan: `docs/exec_plans/completed/plan-024-windows-hosted-acceptance.md`
- reviewed tree: `codex/plan-024-windows-hosted-acceptance` before commit
- baseline: main `79b23f98eb3604247bf64188b5cd62f2025b9ecb`
- reviewers: independent evidence/lifecycle, installer/privacy/security, adversarial harness
- reviewed_at: 2026-08-07 KST

## QA Evidence

- authoritative run `31170168961`, job `92839996499`, exact baseline SHA, main push
  attempt 1, `windows-2025`, conclusion failure
- hosted scoped PASS: cross-layer QA, actual PowerShell controls, Rust all-features,
  unsigned production NSIS build, actual production lifecycle/preservation, private NSIS
  build, unconditional cleanup and summary
- hosted FAIL: installed preflight expected literal WebView `skip` although the pinned
  Tauri renderer correctly emitted empty `INSTALLWEBVIEW2MODE ""`
- hosted NOT RUN: private installed UI/native E2E and artifact upload/download; artifacts 0
- local current-tree gates: repeated full `npm run qa`, frontend 83/366, Rust default 319,
  Rust all-features 335/335, database/build/Tauri/full harness, isolated pre-npm controls,
  dependency audit 0, review prerequisites and diff check all PASS
- corrected PowerShell runtime fixture: `NOT RUN` because this host has no PowerShell and
  no hosted run contains the corrected commit

## Findings

| severity | finding | resolution |
|---|---|---|
| resolved P2 | rendered WebView literal expectation contradicted pinned Tauri output | source `skip` plus rendered empty value contracts |
| resolved P2 | comments, conditionals, macros, redefinition and include surfaces could spoof protected NSIS state | pinned lexical/directive/include parser and mutation controls |
| resolved P1 | platform config, complete config bytes and npm/E2E command graph were not fully bound | absent platform overrides plus normalized full config/package/lock/scripts/E2E hashes |
| resolved P2 | plugin and finalizer symbolic directives left their referenced values free | empty sign command and exact regular plugin tree with sole official DLL SHA-1 |
| resolved P1 | mutable imported checker, local Python shadows and setup-node cache could precede or bypass trust | isolated `python3 -I`, checker hash-before-exec and pre-setup-node ordering |
| resolved P1 | always-running npm cleanup could execute after trust rejection | cleanup requires exact successful trust outcome and has a negative mutation |
| resolved P3 | plugin branches and official-source wording/ranges lacked direct coverage or accuracy | byte/extra/junction negatives and pinned raw-source anchor corrections |
| none | No remaining P0–P3 code, evidence, privacy, security or lifecycle finding | three final independent reviews approved |

## Requirements Trace

- source config still requires private WebView `skip`; rendered NSIS requires the pinned
  empty value and exact protected top-level state.
- generated includes, language bytes, plugin directory/DLL and disabled finalizer are
  bound to the pinned renderer/toolchain before production or private installation.
- every npm execution path follows direct PowerShell and isolated Python trust checks;
  complete package/lock/scripts/E2E sources are fixed before setup-node cache or install.
- a rejected npm trust gate cannot reach setup, build, install or npm cleanup lifecycle.
- hosted baseline scoped passes remain separate from the corrected tree's unexecuted
  Windows PowerShell, installed suite and uploaded artifact acceptance.

## Privacy Review

- no customer rows, credentials, raw database, backup, export, installer, E2E artifact or
  full runner path was copied into source, documents, screenshots or logs.
- controls use synthetic temporary content, bounded metadata and pathless failures.
- artifact boundary remains the exact production installer/checksum/evidence allowlist.

## Residual Risk

- the corrected PowerShell fixture and private installed suite are actual Windows
  `NOT RUN` until the follow-up exact `windows-2025` run.
- GitHub artifact packaging, metadata, digest and downloaded inner allowlist/evidence
  acceptance require that successful run.
- WebView2-absent network-blocked clean VM, Authenticode trust, SmartScreen reputation and
  public distribution remain outside scope.

## Follow-Ups

- Plan-025 must bind this completion commit's automatic main-push run by exact SHA and
  require every Windows step plus the downloaded production artifact to pass.
- any new failure remains FAIL/NOT RUN and receives a new plan with QA and independent review.
