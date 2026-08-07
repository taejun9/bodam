#!/usr/bin/env python3
"""Windows installer, hosted evidence, and release-claim contracts."""

from __future__ import annotations

import json
import re
from pathlib import Path

from windows_cleanup_checks import check_windows_cleanup
from windows_installer_config_checks import (
    E2E_CONFIG,
    PRODUCTION_CONFIG,
    check_installer_configs,
)
from windows_nsis_rendered_checks import check_windows_nsis_rendered
from windows_node_spawn_checks import NODE_SPAWN_FILES, check_windows_node_spawn
from windows_release_document_checks import check_windows_release_documents
from windows_release_launch_checks import check_windows_release_launch
from windows_release_launch_syntax import INVALID_SOURCE, active_code
from windows_workflow_checks import (
    PRODUCTION_INSTALLER,
    UPLOAD_ALLOWLIST,
    WORKFLOW,
    check_windows_workflow,
)


ROOT = Path(__file__).resolve().parents[2]
REQUIRED_RELEASE_FILES = (
    *NODE_SPAWN_FILES,
    "harness/scripts/windows_npm_preflight.py",
    "harness/scripts/windows_node_spawn_checks.py",
    "harness/scripts/windows_installer_config_checks.py",
    "e2e/windows-installer-contract.psm1",
    "e2e/windows-nsis-dependency-contract.psm1",
    "e2e/windows-nsis-rendered-contract.psm1",
    "e2e/windows-launch-readiness.psm1",
    "e2e/windows-host-safety.psm1",
    "e2e/test-windows-host-safety.ps1",
    "e2e/test-windows-cleanup-retry.ps1",
    "e2e/test-windows-installer-identity.ps1",
    "e2e/test-windows-launch-readiness.ps1",
    "e2e/test-windows-nsis-rendered-contract.ps1",
    "e2e/assert-windows-production.ps1",
    "e2e/run-windows-installed-e2e.ps1",
    "e2e/cleanup-windows-installs.ps1",
)
HOST_SAFETY_MARKERS = {
    "e2e/windows-host-safety.psm1": (
        "nested reparse point",
        "Remove-BodamOwnedTree",
        "Get-BodamSharedWebViewSnapshot",
        "Assert-BodamSharedWebViewPreserved",
        "Pv = $record.Pv",
        "$record.Pv -cne $expected.Pv",
    ),
    "e2e/test-windows-host-safety.ps1": (
        "windows-host-safety.psm1",
        'Join-Path $projectRoot ".npmrc"',
        "System.Management.Automation.Language.Parser",
        "PowerShell syntax contract failed",
        "mklink /J",
        "Remove-BodamOwnedTree",
        "sentinel",
        "test-windows-installer-identity.ps1",
    ),
    "e2e/windows-installer-contract.psm1": (
        "Assert-BodamNsisPayloadIdentity",
        "__TAURI_BUNDLE_TYPE_VAR_UNK",
        "__TAURI_BUNDLE_TYPE_VAR_NSS",
    ),
    "e2e/test-windows-installer-identity.ps1": (
        "Assert-BodamNsisPayloadIdentity",
        "tampered NSIS payload was accepted",
    ),
}
REQUIRED_SCRIPTS = {
    "windows:build:production": "tauri build --ci --no-sign --bundles nsis",
    "windows:assert:production": "pwsh -NoLogo -NoProfile -File e2e/assert-windows-production.ps1",
    "e2e:build:windows-nsis": "node e2e/build-e2e.mjs windows-nsis",
    "test:e2e:windows-installed": "pwsh -NoLogo -NoProfile -File e2e/run-windows-installed-e2e.ps1",
    "windows:cleanup": "pwsh -NoLogo -NoProfile -File e2e/cleanup-windows-installs.ps1",
}
REQUIRED_EVIDENCE_KEYS = (
    "schemaVersion",
    "runner",
    "productName",
    "identifier",
    "version",
    "architecture",
    "bundleType",
    "installMode",
    "webviewInstallMode",
    "installerFile",
    "installerBytes",
    "installerSha256",
    "sourceBinarySha256",
    "installedBinarySha256",
    "binaryPatchAwareMatch",
    "authenticodeStatus",
    "productionMarkerMatches",
    "silentInstallExitCode",
    "silentUninstallExitCode",
    "hostedRunner",
    "offlineVmAccepted",
    "launchSmokePassed",
    "appDataPreserved",
    "sharedWebViewPreserved",
)
EVIDENCE_SEMANTICS = (
    (
        "actual installed binary SHA-256 capture",
        r"^[ \t]*\$installedBinarySha256[ \t]*=[ \t]*Get-BodamSha256[ \t]+"
        r"\$contract\.InstalledBinary[ \t]*$",
    ),
    (
        "actual installed hash forwarding",
        r"^[ \t]*-InstalledBinarySha256[ \t]+\$installedBinarySha256[ \t]+"
        r"-SharedWebViewPreserved[ \t]+\$true[ \t]*$",
    ),
    (
        "actual installed hash evidence assignment",
        r"^[ \t]*installedBinarySha256[ \t]*=[ \t]*"
        r"\$InstalledBinarySha256[ \t]*$",
    ),
    (
        "patch-aware identity evidence",
        r"^[ \t]*binaryPatchAwareMatch[ \t]*=[ \t]*\$true[ \t]*$",
    ),
)
POWERSHELL_NUMERIC_SEPARATOR = re.compile(r"(?<![\w.])\d[\d]*_\d")
def read_json(relative: str, errors: list[str]) -> dict:
    path = ROOT / relative
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        errors.append(f"invalid or missing JSON: {relative}")
        return {}
    if not isinstance(value, dict):
        errors.append(f"JSON root must be an object: {relative}")
        return {}
    return value


def check_package_scripts(errors: list[str]) -> None:
    package = read_json("package.json", errors)
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        errors.append("package.json scripts must be an object")
        return
    for name, expected in REQUIRED_SCRIPTS.items():
        command = scripts.get(name)
        if command != expected:
            errors.append(f"package.json script {name} must equal its exact approved command")


def check_release_files(errors: list[str]) -> None:
    for relative in REQUIRED_RELEASE_FILES:
        if not (ROOT / relative).is_file():
            errors.append(f"missing Windows release script: {relative}")


def check_powershell_portability(errors: list[str]) -> None:
    for path in sorted((ROOT / "e2e").rglob("*.ps*")):
        if path.suffix.lower() not in {".ps1", ".psm1"}:
            continue
        text = active_code(path)
        if text == INVALID_SOURCE:
            errors.append(f"{path.relative_to(ROOT)} has an invalid PowerShell comment or string")
            continue
        if POWERSHELL_NUMERIC_SEPARATOR.search(text):
            errors.append(
                f"{path.relative_to(ROOT)} contains an unsupported PowerShell numeric separator"
            )


def check_host_safety_contract(errors: list[str]) -> None:
    for relative, markers in HOST_SAFETY_MARKERS.items():
        path = ROOT / relative
        if not path.is_file():
            continue
        text = active_code(path)
        missing = [marker for marker in markers if marker not in text]
        if missing:
            errors.append(f"{relative} missing hosted safety contract: {missing}")


def check_evidence_contract(errors: list[str]) -> None:
    relative = "e2e/assert-windows-production.ps1"
    path = ROOT / relative
    if not path.is_file():
        errors.append(f"missing Windows production assertion: {relative}")
        return
    text = active_code(path)
    for key in REQUIRED_EVIDENCE_KEYS:
        if key not in text:
            errors.append(f"{relative} missing sanitized evidence key: {key}")
    for label, pattern in EVIDENCE_SEMANTICS:
        if len(re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)) != 1:
            errors.append(
                f"{relative} missing evidence semantic: {label}; "
                "expected exactly one active statement"
            )
    for marker in (
        "offlineInstaller",
        "currentUser",
        "NotSigned",
        "productionMarkerMatches",
        "offlineVmAccepted",
    ):
        if marker not in text:
            errors.append(f"{relative} missing evidence boundary marker: {marker}")
    if not re.search(r"offlineVmAccepted\s*=\s*\$false", text, re.IGNORECASE):
        errors.append(f"{relative} must record offlineVmAccepted as false")


def run_windows_release_checks() -> list[str]:
    errors: list[str] = []
    check_installer_configs(ROOT, errors)
    check_package_scripts(errors)
    check_release_files(errors)
    check_powershell_portability(errors)
    check_host_safety_contract(errors)
    check_windows_workflow(ROOT, errors)
    check_windows_cleanup(ROOT, errors)
    check_windows_nsis_rendered(ROOT, errors)
    check_windows_node_spawn(ROOT, errors)
    check_evidence_contract(errors)
    check_windows_release_launch(ROOT, errors)
    check_windows_release_documents(ROOT, errors)
    return errors
