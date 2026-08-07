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
