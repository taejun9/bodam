#!/usr/bin/env python3
"""Durable Windows release evidence wording checks."""

from __future__ import annotations

from pathlib import Path


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
    ),
    "docs/quality/windows-release-acceptance.md": (
        "offlineVmAccepted: false",
        "UNC, network and removable",
        "production installer, its `.sha256` and `evidence.json`",
        "sharedWebViewPreserved",
        "nested reparse point",
        "first exact `UNK` to `NSS`",
        "actual installed SHA-256",
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
    ),
}


def check_windows_release_documents(root: Path, errors: list[str]) -> None:
    for relative, phrases in REQUIREMENTS.items():
        path = root / relative
        if not path.is_file():
            errors.append(f"missing Windows release evidence document: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for phrase in phrases:
            if phrase not in text:
                errors.append(f"{relative} missing Windows evidence boundary: {phrase}")
    open_questions = root / "docs/product/open-questions.md"
    if open_questions.is_file() and "Windows installer가 인터넷 없이" in open_questions.read_text(encoding="utf-8"):
        errors.append("offline Windows installer decision must be in the resolved profile section")
