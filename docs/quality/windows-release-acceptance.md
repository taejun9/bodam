# Windows release acceptance

## Purpose

This checklist separates repository and hosted evidence from a real offline Windows
acceptance. A checked item is evidence only for the named environment and exact
installer SHA-256. Synthetic data is mandatory throughout.

## Production hosted gate

- [ ] Build exactly one x64 NSIS for `BODAM` / `app.bodam.desktop`.
- [ ] Confirm `installMode: currentUser` and WebView2 `offlineInstaller`.
- [ ] Confirm product version, x64 PE, icon and generated capability `core:default`.
- [ ] Confirm production WebDriver, E2E environment and fixture marker matches are 0.
- [ ] Record installer basename, bytes and SHA-256 without a full temporary path.
- [ ] Record Authenticode as `NotSigned`; do not imply public distribution trust.
- [ ] Silent-install without elevation into the exact LocalAppData product directory.
- [ ] Match the installed executable to the built production executable after applying
      only Tauri's first exact `UNK` to `NSS` NSIS bundle marker substitution; record
      both the restored source SHA-256 and actual installed SHA-256.
- [ ] Verify allowlisted HKCU install/uninstall metadata and the exact installed process.
- [ ] Require the exact roaming `bodam.sqlite3` resolved by Tauri 2.11.5 PathResolver and
      the dirs 6.0.0 Windows roaming mapping; a window or `LocalAppData` alone is not readiness.
- [ ] Require one completed daily backup and empty `backup-work`, all regular and
      reparse-free, with nonempty files and a stable responsive window.
- [ ] Send one `CloseMainWindow()` request, require bounded exit code 0 and treat the
      force-stop fallback as failed-run cleanup only.
- [ ] Silent-uninstall and verify app-owned process, install directory, key and shortcut
      residue is 0 without deleting user data or shared WebView2 state.
- [ ] Hash the exact roaming database and daily backup after normal exit and require
      both hashes unchanged after uninstall before `appDataPreserved: true`.
- [ ] Snapshot documented x64 HKLM/HKCU WebView2 logical records immediately after
      production install; require every record and nonzero `pv` to compare exact-equal
      after uninstall and cleanup before recording `sharedWebViewPreserved: true`.
- [ ] For the exact app-owned WebView2 UDF only, retry `ERROR_SHARING_VIOLATION` with a
      fixed 20×250ms bound while rechecking direct-child/no-reparse safety every attempt.
- [ ] Let every non-sharing deletion error and exhausted lock fail closed; never stop a
      shared `msedgewebview2` process to make hosted cleanup pass.
- [ ] Treat only `ItemNotFoundException` as an absent cleanup target and propagate every
      access or provider probe error before removal and its postcondition.

The authoritative Plan-025 run `31181536529` executed exact corrected commit
`1bd13f23520d75fe3e14d82cf7b4e9ea834626a6` on `windows-2025`. Its checkout, bounded cleanup
retry, installer identity and production launch-readiness controls passed. The rendered
PowerShell fixture failed before its assertions when a nested forced module reload removed
the caller-visible normalized hash helper. Npm trust, setup, QA, Rust, build, production
lifecycle, installed E2E and upload were skipped; artifacts: 0. The replacement
module-qualified wiring remains `NOT RUN` until the next exact-commit hosted run.

## Installed E2E hosted gate

- [ ] Run the actual Node subprocess control on `windows-2025`; require exact argv/env,
      shell-metacharacter preservation, absent injection sentinel and numeric exit handling.
- [ ] Build through `process.execPath` and the locked Tauri `tauri.js` with `shell: false`;
      do not execute `.cmd`/`.bat`, `cmd.exe` or a command-shell fallback.
- [ ] Run installed-suite npm scripts through the parent validated and fixed
      `npm_execpath` JavaScript CLI, never a scenario-provided shim path.
- [ ] Bind the entire `package.json` scripts map, including exact `test:e2e` and Windows
      lifecycle commands; reject added npm pre/post hooks and nested no-op substitutions.
- [ ] Reject a project `.npmrc`; repository `script-shell` configuration must not replace
      the reviewed npm command graph.
- [ ] Before setup-node's npm cache lookup and every later npm command, run the direct
      `python3 -I` trust gate; bind its exact reviewed checker before validating complete
      `package.json`, `package-lock.json`, scripts map and E2E trust tree; reject `npm-shrinkwrap.json`.
- [ ] Install with exact `npm ci --ignore-scripts` so no root or dependency lifecycle script
      can run before cross-layer QA.
- [ ] Run npm cleanup only when the direct trust gate succeeded; a trust rejection must not
      execute an untrusted cleanup lifecycle, and occurs before any setup/build/install state.
- [ ] Bind all 54 `e2e/**/*.mjs` files plus `wdio.conf.mjs` as the transitive installed-suite
      trust tree, not only the six launcher entrypoints.
- [ ] Build and install the private `BODAM E2E` / `app.bodam.desktop.e2e` NSIS.
- [ ] Require source WebView mode `skip` and rendered `INSTALLWEBVIEW2MODE ""` exactly;
      Tauri 2.11.4 gives only download, embed and offline modes named NSIS values.
- [ ] Require the pinned default NSIS template preprocessor surface and pin the complete
      base/E2E Tauri configs by newline-normalized UTF-8 hash; require each source NSIS object
      to contain only `installMode`; reject all Windows platform config overrides, custom
      templates, hooks, languages, resources and associations across JSON/JSON5/TOML.
- [ ] Parse the rendered install/WebView defines as two fixed-order, unconditional
      top-level quoted lines; reject block/continued syntax, conditional or macro targets,
      missing/duplicate values, every `!undef`, switched/dynamic defines and command aliases.
- [ ] Require the pinned preprocessor directive and include order; bind same-directory
      `utils.nsh`, `FileAssociation.nsh` and `English.nsh` hashes, reject built-in include
      shadows, later includes, `!addincludedir`, `!cd`, arbitrary plugin and finalizer lines.
- [ ] Require empty `UNINSTALLERSIGNCOMMAND`; bind `ADDITIONALPLUGINSPATH` to regular,
      non-reparse `NSIS/Plugins/x86-unicode/additional` parents and the sole pinned
      `nsis_tauri_utils.dll` SHA-1.
- [ ] Require the exact installed executable through `BODAM_E2E_APP_BINARY_PATH`.
- [ ] Reject a source-tree, production, missing or path-escaped executable.
- [ ] Run the complete synthetic Customer, policy, coverage, benchmark, family,
      consultation, Dashboard, Calendar, import/export and backup/restore suite.
- [ ] Run Windows local NTFS HANDLE/reparse, replace, restart and file-lock cases.
- [ ] Run the hosted cleanup safety control: reject a nested reparse point and confirm
      its cleanup-tree-external sentinel remains unchanged.
- [ ] Run native persistent/transient UDF lock controls and preserve their sibling sentinel.
- [ ] Run the native missing-drive negative control and require the provider error to escape.
- [ ] Uninstall the E2E package and remove only exact app-owned temporary artifacts.
- [ ] Confirm no E2E installer, database, backup, export or raw log is uploaded.

## Hosted upload gate

- [ ] Artifact name is `bodam-windows-x64-unsigned`.
- [ ] Upload only the production installer, its `.sha256` and `evidence.json`.
- [ ] Pull-request runs upload no artifact; a successful non-pull-request run is required.
- [ ] Evidence reports `hostedRunner: true` and `offlineVmAccepted: false`.
- [ ] Evidence reports `sharedWebViewPreserved: true` from post-install record/version
      exact-equality checks after uninstall and cleanup.
- [ ] Evidence includes no environment dump, full path, row value or secret.
- [ ] Record the exact commit SHA and hosted run URL after main integration.

## Offline clean-VM gate

- [ ] Record Windows edition/build, VM image identifier and clean snapshot.
- [ ] Record that WebView2 is absent before installation.
- [ ] Disable networking before installer launch and record that state.
- [ ] Match the installer to the hosted production SHA-256.
- [ ] Run the interactive current-user NSIS wizard as a standard user.
- [ ] Confirm the installer neither downloads nor requests per-machine elevation.
- [ ] Launch the app and run core synthetic features while networking remains disabled.
- [ ] Exercise native import, export, backup-folder and restore-file dialogs.
- [ ] Confirm restart persistence, changed/unchanged exit backup and restore/restart.
- [ ] Uninstall without deleting user data or shared WebView2 state.

Until every clean-VM item has evidence, the result is `NOT RUN - environment
unavailable`, not an offline acceptance pass.

## Filesystem support statement

Plan-013 hosted evidence covers only the local fixed NTFS environment that actually
runs. Junction/reparse swaps must fail closed and the selected directory/archive must
stay bound to the same Windows HANDLE identity. UNC, network and removable filesystem
support remains undecided and must not be inferred from a local NTFS pass.

## Residual risk statement

An unsigned hosted artifact may trigger Unknown Publisher or SmartScreen warnings and
is not a signed public distribution. Hosted Windows usually already has WebView2 and
does not substitute for the clean-VM gate. Local DB and backup files remain plaintext
and depend on OS-account and disk protection.
