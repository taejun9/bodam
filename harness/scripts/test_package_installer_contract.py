#!/usr/bin/env python3
"""Negative controls for user-installer package contracts."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import package_installer_checks


SOURCE_ROOT = Path(__file__).resolve().parents[2]


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def create_fixture(root: Path) -> None:
    for relative in package_installer_checks.PACKAGE_FILES:
        write(root / relative, (SOURCE_ROOT / relative).read_text(encoding="utf-8"))


def expect_error(errors: list[str], phrase: str, failures: list[str]) -> None:
    if not any(phrase in error for error in errors):
        failures.append(f"installer negative control did not detect: {phrase}")


def run_mutation(
    mutate,
    expected: str,
    failures: list[str],
) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        mutate(root)
        expect_error(
            package_installer_checks.run_package_installer_checks(root),
            expected,
            failures,
        )


def mutate_json(root: Path, relative: str, update) -> None:
    path = root / relative
    value = json.loads(path.read_text(encoding="utf-8"))
    update(value)
    write(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def run_package_installer_negative_controls() -> list[str]:
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        errors = package_installer_checks.run_package_installer_checks(root)
        if errors:
            failures.append(f"valid installer fixture was rejected: {errors}")

    run_mutation(
        lambda root: mutate_json(
            root,
            "package.json",
            lambda value: value["scripts"].__setitem__("package:macos", "tauri build"),
        ),
        "package:macos must equal",
        failures,
    )
    run_mutation(
        lambda root: mutate_json(
            root,
            package_installer_checks.MACOS_CONFIG,
            lambda value: value["bundle"]["macOS"].__setitem__("signingIdentity", None),
        ),
        "ad-hoc signing identity",
        failures,
    )
    run_mutation(
        lambda root: mutate_json(
            root,
            "src-tauri/tauri.conf.json",
            lambda value: value["bundle"]["windows"]["webviewInstallMode"].__setitem__(
                "type", "skip"
            ),
        ),
        "offline WebView2",
        failures,
    )
    run_mutation(
        lambda root: write(
            root / "scripts/package/inspect-windows-installer.mjs",
            (root / "scripts/package/inspect-windows-installer.mjs")
            .read_text(encoding="utf-8")
            .replace(
                '0x014c, "the NSIS setup EXE"',
                '0x8664, "the NSIS setup EXE"',
            ),
        ),
        "0x014c",
        failures,
    )
    run_mutation(
        lambda root: write(
            root / package_installer_checks.INSPECTOR,
            (root / package_installer_checks.INSPECTOR).read_text(encoding="utf-8")
            + "\nprocess.env.HOME = '/tmp/synthetic';\n",
        ),
        "forbidden token: process.env.HOME",
        failures,
    )
    run_mutation(
        lambda root: write(
            root / "README.md",
            (root / "README.md").read_text(encoding="utf-8").replace(
                "Apple Developer ID notarization", "automatic trust"
            ),
        ),
        "Apple Developer ID notarization",
        failures,
    )
    return failures


if __name__ == "__main__":
    failures = run_package_installer_negative_controls()
    for failure in failures:
        print(f"- {failure}")
    raise SystemExit(bool(failures))
