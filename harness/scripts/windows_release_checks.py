#!/usr/bin/env python3
"""Windows installer, hosted evidence, and release-claim contracts."""

from __future__ import annotations

import json
import re
from pathlib import Path

from windows_release_document_checks import check_windows_release_documents
from windows_workflow_checks import (
    PRODUCTION_INSTALLER,
    UPLOAD_ALLOWLIST,
    WORKFLOW,
    check_windows_workflow,
)


ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_CONFIG = "src-tauri/tauri.conf.json"
E2E_CONFIG = "src-tauri/tauri.e2e.conf.json"
REQUIRED_RELEASE_FILES = (
    "e2e/windows-installer-contract.psm1",
    "e2e/windows-host-safety.psm1",
    "e2e/test-windows-host-safety.ps1",
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
        "mklink /J",
        "Remove-BodamOwnedTree",
        "sentinel",
    ),
}
REQUIRED_SCRIPTS = {
    "windows:build:production": ("tauri build", "--ci", "--no-sign", "--bundles nsis"),
    "windows:assert:production": ("assert-windows-production.ps1",),
    "e2e:build:windows-nsis": ("build-e2e.mjs windows-nsis",),
    "test:e2e:windows-installed": ("run-windows-installed-e2e.ps1",),
    "windows:cleanup": ("cleanup-windows-installs.ps1",),
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
    "installedBinarySha256",
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


def nested(value: dict, *keys: str):
    current = value
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def expect_equal(
    actual, expected, label: str, relative: str, errors: list[str]
) -> None:
    if actual != expected:
        errors.append(f"{relative} must set {label} to {expected!r}, found {actual!r}")


def check_installer_configs(errors: list[str]) -> None:
    production = read_json(PRODUCTION_CONFIG, errors)
    expect_equal(production.get("productName"), "BODAM", "productName", PRODUCTION_CONFIG, errors)
    expect_equal(
        production.get("identifier"),
        "app.bodam.desktop",
        "identifier",
        PRODUCTION_CONFIG,
        errors,
    )
    expect_equal(
        nested(production, "bundle", "windows", "nsis", "installMode"),
        "currentUser",
        "bundle.windows.nsis.installMode",
        PRODUCTION_CONFIG,
        errors,
    )
    expect_equal(
        nested(production, "bundle", "windows", "webviewInstallMode", "type"),
        "offlineInstaller",
        "bundle.windows.webviewInstallMode.type",
        PRODUCTION_CONFIG,
        errors,
    )

    e2e = read_json(E2E_CONFIG, errors)
    expect_equal(e2e.get("productName"), "BODAM E2E", "productName", E2E_CONFIG, errors)
    expect_equal(
        e2e.get("identifier"),
        "app.bodam.desktop.e2e",
        "identifier",
        E2E_CONFIG,
        errors,
    )
    expect_equal(
        nested(e2e, "bundle", "windows", "nsis", "installMode"),
        "currentUser",
        "bundle.windows.nsis.installMode",
        E2E_CONFIG,
        errors,
    )
    expect_equal(
        nested(e2e, "bundle", "windows", "webviewInstallMode", "type"),
        "skip",
        "bundle.windows.webviewInstallMode.type",
        E2E_CONFIG,
        errors,
    )


def check_package_scripts(errors: list[str]) -> None:
    package = read_json("package.json", errors)
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        errors.append("package.json scripts must be an object")
        return
    for name, fragments in REQUIRED_SCRIPTS.items():
        command = scripts.get(name)
        missing = [fragment for fragment in fragments if not isinstance(command, str) or fragment not in command]
        if missing:
            errors.append(f"package.json script {name} missing contract fragments: {missing}")


def check_release_files(errors: list[str]) -> None:
    for relative in REQUIRED_RELEASE_FILES:
        if not (ROOT / relative).is_file():
            errors.append(f"missing Windows release script: {relative}")


def check_host_safety_contract(errors: list[str]) -> None:
    for relative, markers in HOST_SAFETY_MARKERS.items():
        path = ROOT / relative
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        missing = [marker for marker in markers if marker not in text]
        if missing:
            errors.append(f"{relative} missing hosted safety contract: {missing}")


def check_evidence_contract(errors: list[str]) -> None:
    relative = "e2e/assert-windows-production.ps1"
    path = ROOT / relative
    if not path.is_file():
        errors.append(f"missing Windows production assertion: {relative}")
        return
    text = path.read_text(encoding="utf-8")
    for key in REQUIRED_EVIDENCE_KEYS:
        if key not in text:
            errors.append(f"{relative} missing sanitized evidence key: {key}")
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
    check_installer_configs(errors)
    check_package_scripts(errors)
    check_release_files(errors)
    check_host_safety_contract(errors)
    check_windows_workflow(ROOT, errors)
    check_evidence_contract(errors)
    check_windows_release_documents(ROOT, errors)
    return errors
