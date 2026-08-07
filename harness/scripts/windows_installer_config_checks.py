#!/usr/bin/env python3
"""Exact source configuration contract for Windows NSIS builds."""

from __future__ import annotations

import json
import hashlib
from pathlib import Path


PRODUCTION_CONFIG = "src-tauri/tauri.conf.json"
E2E_CONFIG = "src-tauri/tauri.e2e.conf.json"
WINDOWS_PLATFORM_CONFIGS = (
    "src-tauri/tauri.windows.conf.json",
    "src-tauri/tauri.windows.conf.json5",
    "src-tauri/Tauri.windows.toml",
)
CONFIG_SHA256 = {
    PRODUCTION_CONFIG: "99e3a3eecf63c5ab92e87f509c1996c303c72d070e3a2b1709e972322f55d852",
    E2E_CONFIG: "db01f9c7b74dca7b2bfc30344f976dfdaa1e83c3b30039494cc8b236b8b09699",
}


def read_json(root: Path, relative: str, errors: list[str]) -> dict:
    try:
        value = json.loads((root / relative).read_text(encoding="utf-8"))
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


def expect_equal(actual, expected, label: str, relative: str, errors: list[str]) -> None:
    if actual != expected:
        errors.append(f"{relative} must set {label} to {expected!r}, found {actual!r}")


def expect_exact_keys(
    value, expected: set[str], label: str, relative: str, errors: list[str]
) -> None:
    actual = set(value) if isinstance(value, dict) else set()
    if actual != expected:
        errors.append(f"{relative} must set {label} keys to {sorted(expected)!r}")


def check_one_config(
    value: dict,
    relative: str,
    product_name: str,
    identifier: str,
    webview_mode: str,
    errors: list[str],
) -> None:
    expect_equal(value.get("productName"), product_name, "productName", relative, errors)
    expect_equal(value.get("identifier"), identifier, "identifier", relative, errors)
    nsis = nested(value, "bundle", "windows", "nsis")
    expect_exact_keys(nsis, {"installMode"}, "bundle.windows.nsis", relative, errors)
    expect_equal(
        nested(nsis, "installMode"),
        "currentUser",
        "bundle.windows.nsis.installMode",
        relative,
        errors,
    )
    expect_equal(
        nested(value, "bundle", "windows", "webviewInstallMode", "type"),
        webview_mode,
        "bundle.windows.webviewInstallMode.type",
        relative,
        errors,
    )


def check_installer_configs(root: Path, errors: list[str]) -> None:
    for relative in WINDOWS_PLATFORM_CONFIGS:
        path = root / relative
        if path.exists() or path.is_symlink():
            errors.append("Windows platform-specific Tauri config must be absent")
    for relative, expected in CONFIG_SHA256.items():
        try:
            text = (root / relative).read_text(encoding="utf-8")
            actual = hashlib.sha256(text.encode("utf-8")).hexdigest()
        except (OSError, UnicodeError):
            actual = ""
        if actual != expected:
            errors.append(f"immutable Tauri config changed: {relative}")
    check_one_config(
        read_json(root, PRODUCTION_CONFIG, errors),
        PRODUCTION_CONFIG,
        "BODAM",
        "app.bodam.desktop",
        "offlineInstaller",
        errors,
    )
    check_one_config(
        read_json(root, E2E_CONFIG, errors),
        E2E_CONFIG,
        "BODAM E2E",
        "app.bodam.desktop.e2e",
        "skip",
        errors,
    )
