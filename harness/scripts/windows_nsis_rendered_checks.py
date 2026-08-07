#!/usr/bin/env python3
"""Immutable rendered-NSIS preflight contract for the installed Windows suite."""

from __future__ import annotations

import hashlib
from pathlib import Path


INSTALLED_RUNNER = "e2e/run-windows-installed-e2e.ps1"
IMMUTABLE_DIGESTS = {
    "harness/scripts/windows_installer_config_checks.py": "ab203f0907e825d9375065f4ae3caa5217541d8bf8f246d84372c6fa558d2d65",
    "e2e/windows-nsis-dependency-contract.psm1": "dbd2b388e719506920d78b176d6e7e0622accfc9e2747f107089c505053537a6",
    "e2e/windows-nsis-rendered-contract.psm1": "5531f225790cc1eac908899d4d59699828947da0cb4e055ffc2d2e1cbe91ceda",
    "e2e/test-windows-nsis-rendered-contract.ps1": "b223d9715702a1a4266771d777539ba61402dedb2a666df50ec70b47b4848777",
    "e2e/test-windows-host-safety.ps1": "3e01926ad7624dfd8453d531ed9e8acac94bbfc4b95bef5df1554a25cb3f6db3",
    "e2e/assert-windows-production.ps1": "a20b35c6bbb37ae0940f95b127e691f8e03de1287dace047fa830afcc7a5a9ca",
    INSTALLED_RUNNER: "e6a7735f9aef50383459963c7b53103a26d90ec55c9ed0ab25824692367aafcd",
}
INSTALLED_REQUIRED_LINES = (
    '$config.bundle.windows.webviewInstallMode.type -cne "skip" -or',
    '"tauri.windows.conf.json", "tauri.windows.conf.json5", "Tauri.windows.toml"',
    'Assert-ExactSet @($baseConfig.bundle.windows.nsis.PSObject.Properties.Name) `',
    'Assert-ExactSet @($config.bundle.windows.nsis.PSObject.Properties.Name) `',
    '"English.nsh" = "1dad40b023707a61f828db1e184d9c1b029cb530c2dbbc4790db265872ef7b5e"',
    'Assert-BodamRenderedNsisContract $contract.NsisScript "currentUser" "" $includeSha256 `',
    '"75197fee3c6a814fe035788d1c34ead39349b860"',
)
REQUIRED_LINES = {
    INSTALLED_RUNNER: INSTALLED_REQUIRED_LINES,
    "e2e/assert-windows-production.ps1": (
        '"tauri.windows.conf.json", "tauri.windows.conf.json5", "Tauri.windows.toml"',
        'Assert-ExactStringArray @($config.bundle.windows.nsis.PSObject.Properties.Name) `',
        '"English.nsh" = "1dad40b023707a61f828db1e184d9c1b029cb530c2dbbc4790db265872ef7b5e"',
        'Assert-BodamRenderedNsisContract $contract.NsisScript "currentUser" `',
        '"offlineInstaller" $includeSha256 "75197fee3c6a814fe035788d1c34ead39349b860"',
    ),
    "e2e/test-windows-host-safety.ps1": (
        '& (Join-Path $PSScriptRoot "test-windows-nsis-rendered-contract.ps1")',
    ),
}


def check_windows_nsis_rendered(root: Path, errors: list[str]) -> None:
    texts: dict[str, str] = {}
    for relative, expected in IMMUTABLE_DIGESTS.items():
        try:
            text = (root / relative).read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            errors.append(f"missing or invalid rendered NSIS contract: {relative}")
            text = ""
        texts[relative] = text
        if hashlib.sha256(text.encode("utf-8")).hexdigest() != expected:
            errors.append(f"immutable rendered NSIS contract changed: {relative}")
    for relative, required in REQUIRED_LINES.items():
        lines = [line.strip() for line in texts.get(relative, "").splitlines()]
        for line in required:
            if lines.count(line) != 1:
                errors.append(f"rendered NSIS contract missing exact active line: {line}")
