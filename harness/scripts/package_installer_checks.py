#!/usr/bin/env python3
"""Static contracts for user-facing macOS and Windows installers."""

from __future__ import annotations

import json
from pathlib import Path

from repository_checks import ROOT


MACOS_CONFIG = "src-tauri/tauri.macos.conf.json"
INSPECTOR = "scripts/package/inspect-macos-installer.mjs"
PACKAGE_FILES = (
    "package.json",
    "README.md",
    "src-tauri/tauri.conf.json",
    MACOS_CONFIG,
    "scripts/package/assert-platform.mjs",
    "scripts/package/build-macos-installer.mjs",
    INSPECTOR,
    "scripts/package/inspect-windows-installer.mjs",
)
EXPECTED_SCRIPTS = {
    "package:preflight:macos": "node scripts/package/assert-platform.mjs macos",
    "package:preflight:windows": "node scripts/package/assert-platform.mjs windows",
    "package:build:macos": "node scripts/package/build-macos-installer.mjs",
    "package:inspect:macos": "node scripts/package/inspect-macos-installer.mjs",
    "package:build:windows": "tauri build --ci --no-sign --bundles nsis",
    "package:inspect:windows": "node scripts/package/inspect-windows-installer.mjs",
    "package:macos": (
        "run-s package:preflight:macos package:build:macos package:inspect:macos"
    ),
    "package:windows": (
        "run-s package:preflight:windows package:build:windows package:inspect:windows"
    ),
}
README_MARKERS = (
    "npm run package:macos",
    "npm run package:windows",
    "BODAM_0.1.0_universal.dmg",
    "BODAM_0.1.0_x64-setup.exe",
    "Node.js, npm, Rust 또는 Prisma를 따로 설치하지 않습니다.",
    "Apple Developer ID notarization",
    "Windows code-signing",
)
INSPECTOR_MARKERS = (
    'process.platform !== "darwin"',
    '"/usr/bin/hdiutil", ["verify", installer]',
    '"arm64"',
    '"x86_64"',
    '"Signature=adhoc"',
    '"Identifier=app.bodam.desktop"',
    'readlinkSync(applicationsLink) !== "/Applications"',
    'const expectedEntries = [".VolumeIcon.icns", "Applications", "BODAM.app"]',
    'const allowedPrefixes = ["bodam-macos-package-", "bodam-macos-installed-"]',
)
FORBIDDEN_INSPECTOR_TOKENS = (
    "process.env.HOME",
    "CFFIXED_USER_HOME",
    "shell: true",
    "execSync(",
    "rm -rf",
)
PLATFORM_MARKERS = (
    'macos: { actual: "darwin", label: "macOS" }',
    'windows: { actual: "win32", label: "Windows" }',
    "process.platform !== contract.actual",
)
WINDOWS_INSPECTOR_MARKERS = (
    'process.platform !== "win32"',
    '!== "offlineInstaller"',
    '!== "currentUser"',
    'endsWith("-setup.exe")',
    "100 * 1024 * 1024",
    'resolve(projectRoot, "src-tauri/target/release/bodam.exe")',
    '0x014c, "the NSIS setup EXE"',
    '0x8664, "the BODAM application"',
)
MACOS_BUILDER_MARKERS = (
    '["aarch64-apple-darwin", "x86_64-apple-darwin"]',
    '["which", "cargo", "--toolchain", "stable"]',
    '"--target",\n    "universal-apple-darwin"',
    '"--runner",\n    cargo',
    "CARGO: cargo",
    'CI: "true"',
    "RUSTC: rustc",
    "RUSTDOC: rustdoc",
)


def read_json(root: Path, relative: str, errors: list[str]) -> dict:
    try:
        value = json.loads((root / relative).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        errors.append(f"invalid or missing installer JSON: {relative}")
        return {}
    if not isinstance(value, dict):
        errors.append(f"installer JSON root must be an object: {relative}")
        return {}
    return value


def nested(value: dict, *keys: str):
    current = value
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def check_package_scripts(root: Path, errors: list[str]) -> None:
    scripts = read_json(root, "package.json", errors).get("scripts")
    if not isinstance(scripts, dict):
        errors.append("package.json scripts must be an object for installer checks")
        return
    for name, expected in EXPECTED_SCRIPTS.items():
        if scripts.get(name) != expected:
            errors.append(f"package.json installer script {name} must equal its reviewed command")


def check_bundle_configs(root: Path, errors: list[str]) -> None:
    production = read_json(root, "src-tauri/tauri.conf.json", errors)
    macos = read_json(root, MACOS_CONFIG, errors)
    if nested(production, "bundle", "windows", "webviewInstallMode", "type") != "offlineInstaller":
        errors.append("Windows user installer must bundle the offline WebView2 installer")
    if nested(production, "bundle", "windows", "nsis", "installMode") != "currentUser":
        errors.append("Windows user installer must remain currentUser NSIS")
    if nested(macos, "bundle", "macOS", "signingIdentity") != "-":
        errors.append("macOS user installer must use the reviewed ad-hoc signing identity")
    if (
        set(macos) != {"bundle"}
        or set(macos.get("bundle", {})) != {"macOS"}
        or set(nested(macos, "bundle", "macOS") or {}) != {"signingIdentity"}
    ):
        errors.append("macOS platform config must contain only the reviewed bundle override")


def check_inspector(root: Path, errors: list[str]) -> None:
    try:
        text = (root / INSPECTOR).read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        errors.append(f"missing macOS installer inspector: {INSPECTOR}")
        return
    for marker in INSPECTOR_MARKERS:
        if marker not in text:
            errors.append(f"macOS installer inspector missing contract: {marker}")
    for token in FORBIDDEN_INSPECTOR_TOKENS:
        if token in text:
            errors.append(f"macOS installer inspector contains forbidden token: {token}")
    for relative, markers in (
        ("scripts/package/assert-platform.mjs", PLATFORM_MARKERS),
        ("scripts/package/build-macos-installer.mjs", MACOS_BUILDER_MARKERS),
        ("scripts/package/inspect-windows-installer.mjs", WINDOWS_INSPECTOR_MARKERS),
    ):
        try:
            source = (root / relative).read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            errors.append(f"missing installer helper: {relative}")
            continue
        for marker in markers:
            if marker not in source:
                errors.append(f"installer helper {relative} missing contract: {marker}")


def check_documentation(root: Path, errors: list[str]) -> None:
    try:
        readme = (root / "README.md").read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        errors.append("README is missing for installer checks")
        return
    for marker in README_MARKERS:
        if marker not in readme:
            errors.append(f"README missing installer contract: {marker}")


def run_package_installer_checks(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    check_package_scripts(root, errors)
    check_bundle_configs(root, errors)
    check_inspector(root, errors)
    check_documentation(root, errors)
    return errors


if __name__ == "__main__":
    failures = run_package_installer_checks()
    for failure in failures:
        print(f"- {failure}")
    raise SystemExit(bool(failures))
