#!/usr/bin/env python3
"""Mutation tests for immutable Windows workflow and hosted safety evidence."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Callable

import windows_release_checks


FixtureFactory = Callable[[Path], None]
CheckRunner = Callable[[Path], list[str]]


def expect_error(errors: list[str], phrase: str, failures: list[str]) -> None:
    if not any(phrase in error for error in errors):
        failures.append(f"Windows workflow negative control did not detect: {phrase}")


def mutate_text(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"synthetic mutation source is missing: {old}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def check_mutation(
    fixture: FixtureFactory,
    run_check: CheckRunner,
    relative: str,
    old: str,
    new: str,
    expected: str,
    failures: list[str],
) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        fixture(root)
        mutate_text(root / relative, old, new)
        expect_error(run_check(root), expected, failures)


def test_action_pins(
    fixture: FixtureFactory, run_check: CheckRunner, failures: list[str]
) -> None:
    workflow = windows_release_checks.WORKFLOW
    check_mutation(
        fixture,
        run_check,
        workflow,
        "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4",
        "actions/checkout@v4",
        "immutable full-length SHA",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        workflow,
        "49933ea5288caeca8642d1e84afbd3f7d6820020",
        "59933ea5288caeca8642d1e84afbd3f7d6820020",
        "approved immutable full-length SHA",
        failures,
    )


def test_summary_and_safety(
    fixture: FixtureFactory, run_check: CheckRunner, failures: list[str]
) -> None:
    workflow = windows_release_checks.WORKFLOW
    check_mutation(
        fixture,
        run_check,
        workflow,
        "- jobStatus: ${{ job.status }}",
        "- jobStatus: unknown",
        "summary must report jobStatus",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        workflow,
        "- hostSafety: ${{ steps.host_safety.outcome }}",
        "- hostSafety: unknown",
        "summary must report hostSafety",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        workflow,
        "e2e/test-windows-host-safety.ps1",
        "e2e/missing-host-safety.ps1",
        "exact step id host_safety",
        failures,
    )
    for field in ("if: false", "continue-on-error: true"):
        check_mutation(
            fixture,
            run_check,
            workflow,
            "        id: host_safety",
            f"        id: host_safety\n        {field}",
            "host safety step must run unconditionally and fail closed",
            failures,
        )
    check_mutation(
        fixture,
        run_check,
        workflow,
        "        run: pwsh -NoLogo -NoProfile -File e2e/test-windows-host-safety.ps1",
        "        run: |\n"
        "          <#\n"
        "          run: pwsh -NoLogo -NoProfile -File e2e/test-windows-host-safety.ps1\n"
        "          #>\n"
        '          Write-Output "synthetic bypass"',
        "exact step id host_safety",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        workflow,
        "        run: pwsh -NoLogo -NoProfile -File e2e/test-windows-host-safety.ps1",
        "        run: |\n"
        "          # e2e/test-windows-host-safety.ps1\n"
        '          Write-Output "synthetic bypass"',
        "exact step id host_safety",
        failures,
    )
    for relative in ("e2e/windows-host-safety.psm1", "e2e/test-windows-host-safety.ps1"):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixture(root)
            (root / relative).unlink()
            expect_error(run_check(root), f"missing Windows release script: {relative}", failures)
    check_mutation(
        fixture,
        run_check,
        "e2e/windows-host-safety.psm1",
        "nested reparse point",
        "nested redirect",
        "missing hosted safety contract",
        failures,
    )


def test_evidence_and_document_boundaries(
    fixture: FixtureFactory, run_check: CheckRunner, failures: list[str]
) -> None:
    check_mutation(
        fixture,
        run_check,
        "e2e/windows-host-safety.psm1",
        "$record.Pv -cne $expected.Pv",
        "$false",
        "missing hosted safety contract",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/assert-windows-production.ps1",
        "sharedWebViewPreserved",
        "sharedRuntimeUnknown",
        "missing sanitized evidence key: sharedWebViewPreserved",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/assert-windows-production.ps1",
        "  $installedBinarySha256 = Get-BodamSha256 $contract.InstalledBinary",
        "  # $installedBinarySha256 = Get-BodamSha256 $contract.InstalledBinary\n"
        "  $installedBinarySha256 = Get-BodamSha256 $contract.InstalledBinaryBackup",
        "missing evidence semantic: actual installed binary SHA-256 capture",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/assert-windows-production.ps1",
        "  $installedBinarySha256 = Get-BodamSha256 $contract.InstalledBinary",
        "  $installedBinarySha256 = Get-BodamSha256 $contract.InstalledBinary\n"
        "  $installedBinarySha256 = Get-BodamSha256 $contract.InstalledBinary",
        "missing evidence semantic: actual installed binary SHA-256 capture",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/assert-windows-production.ps1",
        "  -InstalledBinarySha256 $installedBinarySha256 -SharedWebViewPreserved $true",
        "  # -InstalledBinarySha256 $installedBinarySha256 -SharedWebViewPreserved $true\n"
        "  -InstalledBinarySha256 $installedBinarySha256Spoof -SharedWebViewPreserved $true",
        "missing evidence semantic: actual installed hash forwarding",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/assert-windows-production.ps1",
        "    installedBinarySha256 = $InstalledBinarySha256",
        "    # installedBinarySha256 = $InstalledBinarySha256\n"
        "    installedBinarySha256 = $InstalledBinarySha256Spoof",
        "missing evidence semantic: actual installed hash evidence assignment",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/assert-windows-production.ps1",
        "    binaryPatchAwareMatch = $true",
        "    # binaryPatchAwareMatch = $true\n"
        "    binaryPatchAwareMatch = $trueOverride",
        "missing evidence semantic: patch-aware identity evidence",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "docs/quality/windows-e2e-evidence.md",
        "nested reparse point",
        "nested redirect",
        "missing Windows evidence boundary: nested reparse point",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "docs/quality/windows-e2e-evidence.md",
        "every other byte",
        "most other bytes",
        "missing Windows evidence boundary: every other byte",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "docs/quality/windows-release-acceptance.md",
        "first exact `UNK` to `NSS`",
        "raw source/install equality",
        "missing Windows evidence boundary: first exact `UNK` to `NSS`",
        failures,
    )
    source_url = (
        "https://github.com/tauri-apps/tauri/blob/"
        "8909f221d1515955fc843808032bdc5d62209c96/"
        "crates/tauri-bundler/src/bundle.rs"
    )
    check_mutation(
        fixture,
        run_check,
        "docs/references/official-sources.md",
        source_url,
        source_url.replace("8909f", "9909f", 1),
        "missing Windows evidence boundary: " + source_url,
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/windows-installer-contract.psm1",
        "__TAURI_BUNDLE_TYPE_VAR_NSS",
        "__TAURI_BUNDLE_TYPE_VAR_BAD",
        "missing hosted safety contract",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/windows-installer-contract.psm1",
        "Set-StrictMode -Version Latest",
        "$null = 15_000",
        "unsupported PowerShell numeric separator",
        failures,
    )


def run_windows_workflow_negative_controls(
    fixture: FixtureFactory, run_check: CheckRunner
) -> list[str]:
    failures: list[str] = []
    test_action_pins(fixture, run_check, failures)
    test_summary_and_safety(fixture, run_check, failures)
    test_evidence_and_document_boundaries(fixture, run_check, failures)
    return failures
