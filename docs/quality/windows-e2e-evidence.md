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
- every official x64 WebView2 `pv` logical record and version observed immediately after
  production install is exact-equal after uninstall and cleanup, recorded as
  `sharedWebViewPreserved: true`;
- production capability and E2E-marker isolation.

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
