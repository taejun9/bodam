#!/usr/bin/env python3
"""Negative controls for the rendered NSIS installed-suite preflight."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Callable

from windows_nsis_rendered_checks import (
    IMMUTABLE_DIGESTS,
    INSTALLED_REQUIRED_LINES,
    INSTALLED_RUNNER,
)


FixtureWriter = Callable[[Path], None]
ContractRunner = Callable[[Path], list[str]]
SOURCE_ROOT = Path(__file__).resolve().parents[2]


def run_windows_nsis_rendered_negative_controls(
    create_valid_fixture: FixtureWriter,
    run_check: ContractRunner,
) -> list[str]:
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        source = (root / INSTALLED_RUNNER).read_text(encoding="utf-8")

    parser = "e2e/windows-nsis-rendered-contract.psm1"
    parser_source = (SOURCE_ROOT / parser).read_text(encoding="utf-8")
    dependency = "e2e/windows-nsis-dependency-contract.psm1"
    dependency_source = (SOURCE_ROOT / dependency).read_text(encoding="utf-8")
    control = "e2e/test-windows-nsis-rendered-contract.ps1"
    control_source = (SOURCE_ROOT / control).read_text(encoding="utf-8")
    expected = next(line for line in INSTALLED_REQUIRED_LINES if "RenderedNsisContract" in line)
    mutations = (
        ("literal skip regression", INSTALLED_RUNNER, source.replace(
            expected, expected.replace('""', '"skip"', 1), 1
        )),
        ("missing runtime assertion", INSTALLED_RUNNER, source.replace(expected, "", 1)),
        ("inactive runtime assertion", INSTALLED_RUNNER, source.replace(
            expected, f"if ($false) {{ {expected} }}", 1
        )),
        ("duplicate runtime assertion", INSTALLED_RUNNER, source + "\n" + expected + "\n"),
        ("weakened unique parser", parser, parser_source.replace(
            "$values.Count -ne 4 -or", "$values.Count -lt 1 -and", 1
        )),
        ("reintroduced nested dependency reload", parser, parser_source.replace(
            '$ErrorActionPreference = "Stop"\n',
            '$ErrorActionPreference = "Stop"\nImport-Module '
            '(Join-Path $PSScriptRoot "windows-nsis-dependency-contract.psm1") -Force\n',
            1,
        )),
        ("unqualified dependency call", parser, parser_source.replace(
            "windows-nsis-dependency-contract\\Assert-BodamNsisDependencyContract",
            "Assert-BodamNsisDependencyContract", 1
        )),
        ("provider-only parent directory check", dependency, dependency_source.replace(
            "$pluginItem -isnot [IO.DirectoryInfo] -or",
            "-not $pluginItem.PSIsContainer -or", 1
        )),
        ("ungrouped CRLF positive", control, control_source.replace(
            '    ($valid.Replace("`n", "`r`n") + "`r`n"),\n',
            '    $valid.Replace("`n", "`r`n") + "`r`n",\n', 1
        )),
        ("removed newline scalar count", control, control_source.replace(
            "  if ($newlineContracts.Count -ne 3 -or\n"
            "      @($newlineContracts | Where-Object { $_ -isnot [string] }).Count -ne 0) {\n"
            '    throw "rendered NSIS newline positive setup failed"\n'
            "  }\n", "", 1
        )),
        ("removed block-comment control", control, control_source.replace(
            "  (New-RenderedContract -Body @($mode, '/*', $webView, '*/')),\n",
            "", 1
        )),
        ("removed redefinition control", control, control_source.replace(
            "    '!define /redef INSTALLWEBVIEW2MODE \"offlineInstaller\"')),\n", "", 1
        )),
        ("removed multi-undef control", control, control_source.replace(
            "    '!undef /noerrors OTHER INSTALLWEBVIEW2MODE')),\n", "", 1
        )),
        ("removed command-alias control", control, control_source.replace(
            "    '${OP} INSTALLWEBVIEW2MODE \"offlineInstaller\"')),\n", "", 1
        )),
        ("removed include control", control, control_source.replace(
            "  (New-RenderedContract -Body @($mode, $webView) "
            "-BeforeEnglish @('!include \"mutate.nsh\"')),\n", "", 1
        )),
        ("removed plugin-byte control", control, control_source.replace(
            '  [IO.File]::WriteAllText($pluginPath, "tampered plugin", $utf8)\n'
            "  Assert-RejectedContract $valid\n", "", 1
        )),
        ("removed extra-plugin control", control, control_source.replace(
            '  [IO.File]::WriteAllText($extraPlugin, "synthetic extra", $utf8)\n'
            "  Assert-RejectedContract $valid\n", "", 1
        )),
        ("removed plugin-reparse control", control, control_source.replace(
            "  $pluginJunctionPath = $pluginDirectory\n"
            "  Assert-RejectedContract $valid\n", "", 1
        )),
        ("removed parent plugin-reparse control", control, control_source.replace(
            "  $pluginJunctionPath = $pluginUnicodeDirectory\n"
            "  Assert-RejectedContract $valid\n", "", 1
        )),
    )
    for relative in IMMUTABLE_DIGESTS:
        mutations += ((f"empty {relative}", relative, ""),)
    for label, relative, mutated in mutations:
        original = (SOURCE_ROOT / relative).read_text(encoding="utf-8")
        if mutated == original:
            failures.append(f"rendered NSIS mutation was not applied: {label}")
            continue
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            create_valid_fixture(root)
            (root / relative).write_text(mutated, encoding="utf-8")
            errors = run_check(root)
            if not any("immutable rendered NSIS contract changed" in error for error in errors):
                failures.append(f"rendered NSIS mutation was not rejected: {label}")
    return failures
