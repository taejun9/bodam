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
        "docs/quality/windows-e2e-evidence.md",
        "nested reparse point",
        "nested redirect",
        "missing Windows evidence boundary: nested reparse point",
        failures,
    )
    check_mutation(
        fixture,
        run_check,
        "e2e/windows-installer-contract.psm1",
        "# synthetic Windows release contract",
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
