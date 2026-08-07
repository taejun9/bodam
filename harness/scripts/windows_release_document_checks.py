#!/usr/bin/env python3
"""Durable Windows release evidence wording checks."""

from __future__ import annotations

import re
from pathlib import Path


HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


REQUIREMENTS = {
    "docs/product/open-questions.md": (
        "WebView2 `offlineInstaller`",
        "removable·network filesystem",
    ),
    "docs/quality/windows-e2e-evidence.md": (
        "NOT RUN - environment unavailable",
        "bodam-windows-x64-unsigned",
        "NotSigned",
        "local NTFS",
        "sharedWebViewPreserved",
        "nested reparse point",
        "external sentinel",
        "first bundle-type marker",
        "every other byte",
        "actual installed hash",
        "exact roaming `bodam.sqlite3`",
        "`LocalAppData` alone as readiness",
        "one `CloseMainWindow()`",
        "force-stop fallback",
        "`ERROR_SHARING_VIOLATION`",
        "20 attempts at 250ms intervals",
        "shared `msedgewebview2` process",
        "direct `.cmd`",
        "`process.execPath`",
        "`npm_execpath`",
        "`shell: false`",
        "empty `INSTALLWEBVIEW2MODE \"\"`",
        "four protected unconditional",
        "dependency define must precede its symbolic use",
        "all three Tauri-supported Windows platform config filenames",
        "entire `package.json` scripts map",
        "project `.npmrc` is forbidden",
        "isolated `python3 -I` trust steps",
        "exact reviewed checker source hash",
        "setup-node's npm cache lookup",
        "`package-lock.json`",
        "`npm-shrinkwrap.json`",
        "`npm ci --ignore-scripts`",
        "npm cleanup step also requires a successful trust outcome",
        "all 54 `e2e/**/*.mjs` files plus",
        "newline-normalized UTF-8 hashes",
        "`FileAssociation.nsh` and `English.nsh`",
        "built-in include shadows",
        "`!addincludedir`",
        "empty `UNINSTALLERSIGNCOMMAND`",
        "`nsis_tauri_utils.dll` SHA-1",
        "no PowerShell",
        "Plan-025 run `31181536529`",
        "artifacts: 0",
        "module-qualified wiring",
        "NOT RUN",
    ),
    "docs/quality/windows-release-acceptance.md": (
        "offlineVmAccepted: false",
        "UNC, network and removable",
        "production installer, its `.sha256` and `evidence.json`",
        "sharedWebViewPreserved",
        "nested reparse point",
        "first exact `UNK` to `NSS`",
        "actual installed SHA-256",
        "exact roaming `bodam.sqlite3`",
        "one `CloseMainWindow()`",
        "appDataPreserved: true",
        "fixed 20×250ms bound",
        "shared `msedgewebview2` process",
        "actual Node subprocess control",
        "Tauri `tauri.js`",
        "`npm_execpath`",
        "rendered `INSTALLWEBVIEW2MODE \"\"` exactly",
        "pinned default NSIS template",
        "Windows platform config overrides",
        "fixed-order, unconditional",
        "entire `package.json` scripts map",
        "Reject a project `.npmrc`",
        "Before setup-node's npm cache lookup and every later npm command",
        "`python3 -I` trust gate",
        "exact reviewed checker",
        "`npm-shrinkwrap.json`",
        "`npm ci --ignore-scripts`",
        "Run npm cleanup only when the direct trust gate succeeded",
        "all 54 `e2e/**/*.mjs` files plus",
        "newline-normalized UTF-8 hash",
        "built-in include",
        "`!addincludedir`",
        "empty `UNINSTALLERSIGNCOMMAND`",
        "`nsis_tauri_utils.dll` SHA-1",
        "Plan-025 run `31181536529`",
        "artifacts: 0",
        "module-qualified wiring remains `NOT RUN`",
    ),
    "docs/privacy/principles.md": (
        "Hosted artifact",
        "shared WebView2 runtime",
        "local fixed NTFS",
        "WebView2 `pv`",
        "nested reparse point",
        "external sentinel",
    ),
    "docs/references/official-sources.md": (
        "full-length commit SHA",
        "pv (REG_SZ)",
        "FlushFileBuffers",
        "parent-directory metadata durability",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle.rs",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-cli/src/helpers/config.rs#L154-L188",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-utils/src/config/parse.rs#L42-L72",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L563-L580",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L593-L603",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L636-L654",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi#L621-L626",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L425-L450",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L829-L857",
        "https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs#L32-L70",
        "https://nsis.sourceforge.io/Docs/Chapter4.html#4.1",
        "https://nsis.sourceforge.io/Docs/Chapter5.html#5.4.1",
        "https://docs.npmjs.com/cli/v11/configuring-npm/npmrc/",
        "https://docs.npmjs.com/cli/v11/commands/npm-ci/",
        "https://docs.npmjs.com/cli/v11/commands/npm-shrinkwrap/",
        "https://docs.python.org/3/using/cmdline.html#cmdoption-I",
        "https://github.com/actions/setup-node/blob/49933ea5288caeca8642d1e84afbd3f7d6820020/src/cache-utils.ts#L19-L25",
        "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/import-module?view=powershell-7.6",
        "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_command_precedence?view=powershell-7.6",
        "https://github.com/tauri-apps/tauri/blob/7cd71369c00978a3783b6ae3e9972358abbe4ae6/crates/tauri/src/app.rs",
        "https://github.com/tauri-apps/tauri/blob/7cd71369c00978a3783b6ae3e9972358abbe4ae6/crates/tauri/src/path/desktop.rs",
        "https://docs.rs/tauri/2.11.5/tauri/path/struct.PathResolver.html#method.app_data_dir",
        "https://docs.rs/dirs/6.0.0/dirs/fn.data_dir.html",
        "https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.closemainwindow",
        "https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder",
        "https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-related-events",
        "https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-",
        "https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2",
        "https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html#spawning-bat-and-cmd-files-on-windows",
        "https://nodejs.org/download/release/v24.18.1/docs/api/deprecations.html#DEP0190",
        "https://nodejs.org/download/release/v24.18.1/docs/api/process.html#processexecpath",
    ),
}


def check_windows_release_documents(root: Path, errors: list[str]) -> None:
    for relative, phrases in REQUIREMENTS.items():
        path = root / relative
        if not path.is_file():
            errors.append(f"missing Windows release evidence document: {relative}")
            continue
        text = HTML_COMMENT.sub("", path.read_text(encoding="utf-8"))
        for phrase in phrases:
            if phrase not in text:
                errors.append(f"{relative} missing Windows evidence boundary: {phrase}")
    open_questions = root / "docs/product/open-questions.md"
    if open_questions.is_file() and "Windows installer가 인터넷 없이" in open_questions.read_text(encoding="utf-8"):
        errors.append("offline Windows installer decision must be in the resolved profile section")
