# Windows E2E evidence boundary

## Hosted runner

`.github/workflows/tauri-e2e-windows.yml` runs on `windows-2025` and keeps production
and E2E packages separate. The production path builds one x64 current-user NSIS with
WebView2 `offlineInstaller`, installs it silently, checks its executable, HKCU metadata,
hash and production capability, and uninstalls it. The private `BODAM E2E` NSIS uses
the hosted image's existing WebView2 and runs the complete synthetic WebDriver suite
against the installed executable rather than a source-tree binary.

A passing hosted run proves only the following in that runner image:

- the x64 NSIS build and current-user silent install/uninstall path;
- the installed executable's WebView2 rendering, Tauri IPC and local SQLite behavior;
- the full synthetic Customer-to-backup/restore E2E suite;
- local NTFS HANDLE identity and reparse-point regression cases that actually ran;
- the hosted safety negative control rejects a nested reparse point before recursive
  cleanup and leaves its external sentinel unchanged;
- native persistent/transient lock controls prove that exact app-owned cleanup rejects
  an exhausted sharing violation and recovers only after a transient handle release;
- every official x64 WebView2 `pv` logical record and version observed immediately after
  production install is exact-equal after uninstall and cleanup, recorded as
  `sharedWebViewPreserved: true`;
- production capability and E2E-marker isolation.

The production launch smoke rejects a window handle alone and `LocalAppData` alone as readiness.
Tauri 2.11.5 builds the configured window before BODAM's
setup hook. Its version-pinned PathResolver maps `app_data_dir()` through `data_dir()` plus
the identifier, and version-pinned dirs 6.0.0 maps Windows `data_dir()` to
`FOLDERID_RoamingAppData`. The gate therefore waits for the exact roaming `bodam.sqlite3`,
one completed daily backup and an empty `backup-work`; every item must be regular,
reparse-free and nonempty where it is
a file. The exact database length, backup basename and backup length must remain stable
with a responsive window and exact installed process before one `CloseMainWindow()`
request. A bounded normal exit with code 0 is required; the force-stop fallback is
cleanup after failure only. This is a production renderer-to-IPC, SQLite/daily-backup
and OS-close smoke, while the private installed suite remains the full feature proof.
The database and observed daily-backup hashes must also survive normal NSIS uninstall
before evidence may record `appDataPreserved: true`.

WebView2 can retain files in an app-owned user data folder after the host process exits.
The hosted cleanup therefore retries only `IOException` with exact Windows
`ERROR_SHARING_VIOLATION` for 20 attempts at 250ms intervals. Every attempt revalidates
the exact direct-child target and scans the tree for reparse points; other deletion
errors fail immediately and an exhausted lock fails with a pathless error. Cleanup never
terminates a shared `msedgewebview2` process. The native controls also require a sibling
sentinel to remain unchanged. Target probes treat only `ItemNotFoundException` as
absence; access and provider errors propagate, and the hosted control exercises this
boundary with a real missing PowerShell drive.

The workflow contract binds each evidence step to one exact active `run:` command and
its exact step id. A filename left only in a YAML comment or multiline bypass is rejected,
so the hosted safety outcome cannot be populated by a synthetic replacement command.

## Node launcher boundary

Node 24 intentionally rejects direct `.cmd` and `.bat` execution through `spawnSync`
without an explicit shell. The private build and installed suite do not weaken that
security boundary with a command shell. They invoke the absolute current Node executable
from `process.execPath`, pass an absolute regular JavaScript entrypoint and argv array,
and force `shell: false`.

The build resolves the locked Tauri `tauri.js` entrypoint rather than a platform shim.
The installed suite captures the parent npm `npm_execpath` once, validates an absolute
regular `npm/bin/npm-cli.js`, and overwrites child npm provenance with that fixed value.
Scenario environment changes cannot redirect it. Spawn errors, signal termination and
missing numeric exit status always fail; only an expected numeric nonzero scenario exit
may use the existing failure allowance.

`npm run qa` starts with an actual Node subprocess control. It executes fake JavaScript
CLIs from a temporary directory containing spaces, `&` and `%`, requires shell-like argv
and environment values to remain exact, proves a shell-injection sentinel is absent, and
checks Tauri Windows/macOS/no-bundle construction plus invalid path and exit controls.
This runs on each QA host. Plan-024 proved that control and the new JavaScript launcher on
`windows-2025`, including a complete private NSIS build past the former `.cmd` failure.

Immediately after checkout, direct PowerShell and isolated `python3 -I` trust steps run before
setup-node's npm cache lookup and every later npm command. The isolated Python gate verifies the
exact reviewed checker source hash before executing it, and a project `.npmrc` is forbidden. The steps
pin the complete newline-normalized `package.json` and `package-lock.json`, reject higher-precedence
`npm-shrinkwrap.json`, and bind the entire `package.json` scripts map as one canonical command graph.
The install uses `npm ci --ignore-scripts`, so repository `script-shell`, package pre/post lifecycle
hooks, dependency install scripts or a no-op nested E2E command cannot run ahead of the gate.
The npm cleanup step also requires a successful trust outcome; when the gate rejects checkout
content, cleanup is skipped because no setup, build or install step has yet created app state.
This also pins the reviewed WDIO and Tauri CLI dependency graph, not only their command names.
The transitive installed-suite trust tree covers all 54 `e2e/**/*.mjs` files plus
`wdio.conf.mjs`; changing an imported binary-path, backup, spec or helper module fails even
when the six launcher entrypoints are unchanged.

Tauri CLI 2.11.4 parses the private source config `type: "skip"` but renders that mode as
an empty `INSTALLWEBVIEW2MODE ""` NSIS value; only download, embed and offline modes receive
named values. The source-config `skip` guard and the rendered empty-value guard are both
required so a different mode cannot pass. Both complete Tauri source configs have exact
newline-normalized UTF-8 hashes, their NSIS objects permit only `installMode`, and
all three Tauri-supported Windows platform config filenames must be absent. This catches any base,
E2E or automatically merged file-association, resource, custom-template, hook or language
surface while remaining valid for LF, CRLF and CR checkouts.

Against the pinned default template, a shared parser requires four protected unconditional
top-level quoted defines, including empty `UNINSTALLERSIGNCOMMAND`. Install/WebView order is fixed,
and each dependency define must precede its symbolic use. It permits nine preprocessor directive
names and the exact include sequence. The generated `utils.nsh`,
`FileAssociation.nsh` and `English.nsh` must be regular files with pinned normalized hashes;
English must be in the actual `installer.nsi` directory and built-in include shadows must be
absent there. The parser rejects block or continued syntax, condition/macro targets,
duplicates, all `!undef`, switched or dynamic defines, command aliases, later includes,
`!addincludedir`, `!cd`, arbitrary plugin/finalizer directives, inline suffixes and malformed
nesting. `ADDITIONALPLUGINSPATH` must resolve through regular, non-reparse
`NSIS/Plugins/x86-unicode/additional` directories containing only the pinned
`nsis_tauri_utils.dll` SHA-1, so the approved symbolic plugin line cannot redirect compilation.

The authoritative Plan-025 run `31181536529` executed exact corrected commit
`1bd13f23520d75fe3e14d82cf7b4e9ea834626a6` on `windows-2025`. Checkout, bounded cleanup
retry, installer identity and production launch-readiness controls passed. The rendered
PowerShell fixture then failed before its assertions because a nested forced dependency-module
reload removed the caller-visible normalized hash helper. Isolated npm trust, setup, QA,
Rust, build, install, installed E2E and upload were skipped; artifacts: 0. Those downstream
steps are `NOT RUN`, not failures or passes.

The current remediation removes the rendered module's nested reload and invokes the
caller-loaded dependency command by its module-qualified name. Python source digests, exact
wiring and negative mutations pass locally, but this new module-qualified wiring and its
LF/CRLF/CR PowerShell positives and negatives remain `NOT RUN` until the next exact-commit
`windows-2025` run. This macOS host has no PowerShell.

Tauri CLI 2.11.4 temporarily changes the main executable's first bundle-type marker
from `__TAURI_BUNDLE_TYPE_VAR_UNK` to `..._NSS` while NSIS captures it, then restores
the build output. The hosted identity gate therefore hashes a memory projection with
that one exact substitution and requires every other byte to match the installed
executable. Evidence records both the restored source hash and actual installed hash;
raw equality between those two hashes is not expected.

It does not prove a WebView2-missing bootstrap, a network-disabled installation,
interactive NSIS wizard/UAC behavior, Authenticode trust, SmartScreen reputation,
consumer Windows hardware, or removable/network filesystem support.
The shared-runtime result covers only exact equality of the post-install observed
Microsoft HKLM/HKCU logical records and versions. It does not prove the pre-install
version stayed unchanged or that runtime files and updater state are immutable.

## Offline clean VM

Offline Windows acceptance is separate evidence. It requires a Windows 11 x64 clean
VM where WebView2 absence and network-disabled state are recorded before launching the
exact hosted production installer SHA-256. The acceptance record must include the VM
image/build, installer hash, standard-user interactive install result, wizard/UAC
result, first launch, synthetic feature smoke, native file/folder dialogs, restart
persistence, backup/restore and uninstall results.

If that environment is unavailable, record `NOT RUN - environment unavailable`.
A hosted-runner pass must never be reported as an offline installer or clean-VM pass.
The detailed checklist is in `docs/quality/windows-release-acceptance.md`.

## Signing boundary

The Plan-013 production artifact is unsigned because no distribution credential is
provided. Evidence records Authenticode as `NotSigned`; it must not describe the file
as trusted, signed or ready for public distribution. Certificate acquisition,
timestamping, SmartScreen reputation and a public release channel require separate
authority and evidence.

## Artifact and data boundary

The hosted upload allowlist is exactly:

- `runtime-data/windows-release/BODAM_0.1.0_x64-setup.exe`;
- `runtime-data/windows-release/BODAM_0.1.0_x64-setup.exe.sha256`;
- `runtime-data/windows-release/evidence.json`.

The artifact name is `bodam-windows-x64-unsigned`. The E2E installer, runtime DB,
`.bodam-backup`, import/export output, phase markers, screenshots and raw WDIO/backend
logs are never uploaded. Evidence contains only allowlisted package metadata, sizes,
hashes, status codes and counts; it contains no full temporary path or row value.
The evidence also records `sharedWebViewPreserved` only after every documented WebView2
logical record and nonzero `pv` observed after production install compares exact-equal
after uninstall and the exact cleanup pass.
The ignored staging root is intentionally non-hidden, while upload-artifact keeps
`include-hidden-files: false`; none of the three allowlisted paths has a dot-prefixed
component.
Pull-request runs upload no artifact; only a successful non-pull-request main or
manually dispatched run may upload the three-file production allowlist.

Both hosted and clean-VM scenarios use synthetic data only. The E2E feature requires
absolute, validated temporary paths and deletes its runtime after the test. Production
builds omit the E2E feature, embedded server, environment override and WebDriver
capability.
