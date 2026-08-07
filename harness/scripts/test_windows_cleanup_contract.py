#!/usr/bin/env python3
"""Mutation controls for bounded Windows app-owned cleanup retries."""

from __future__ import annotations

from test_windows_workflow_contract import CheckRunner, FixtureFactory, check_mutation


def run_windows_cleanup_negative_controls(
    fixture: FixtureFactory, run_check: CheckRunner
) -> list[str]:
    failures: list[str] = []
    body_mutations = (
        (
            "Get-Item -LiteralPath $Path -Force -ErrorAction Stop",
            "Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue",
            "exact cleanup-item probe function body",
        ),
        (
            "} catch [Management.Automation.ItemNotFoundException] {",
            "} catch [Exception] {",
            "exact cleanup-item probe function body",
        ),
        (
            "$Exception -is [IO.IOException] -and $Exception.HResult -eq -2147024864",
            "$Exception -is [Exception] -and $Exception.HResult -eq -1",
            "exact cleanup-sharing predicate function body",
        ),
        (
            "for ($attempt = 1; $attempt -le 20; $attempt += 1)",
            "for ($attempt = 1; $attempt -le [int]::MaxValue; $attempt += 0)",
            "exact bounded-owned-tree function body",
        ),
        (
            "if ($null -eq (Get-BodamCleanupItem -Path $target)) { return }",
            "if ($null -eq (Get-Item -LiteralPath $target -ErrorAction SilentlyContinue)) { return }",
            "exact bounded-owned-tree function body",
        ),
        (
            "Assert-BodamOwnedTreeSafe -Path $target",
            "# Assert-BodamOwnedTreeSafe -Path $target\n    $null = $target",
            "exact bounded-owned-tree function body",
        ),
        (
            "Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop",
            "Remove-Item -Path \"$Root\\*\" -Recurse -Force -ErrorAction SilentlyContinue",
            "exact bounded-owned-tree function body",
        ),
        (
            "if ($null -ne (Get-BodamCleanupItem -Path $target)) {",
            "if ($false) {",
            "exact bounded-owned-tree function body",
        ),
        (
            "if (-not (Test-BodamCleanupSharingViolation -Exception $_.Exception)) { throw }",
            "if ($false) { throw }",
            "exact bounded-owned-tree function body",
        ),
        (
            "if ($attempt -eq 20) { throw \"CI cleanup target remained locked after bounded retries\" }",
            "if ($false) { return }",
            "exact bounded-owned-tree function body",
        ),
        (
            "Start-Sleep -Milliseconds 250",
            "Start-Sleep -Milliseconds 0",
            "exact bounded-owned-tree function body",
        ),
    )
    for old, new, expected in body_mutations:
        check_mutation(
            fixture,
            run_check,
            "e2e/windows-host-safety.psm1",
            old,
            new,
            expected,
            failures,
        )
    check_mutation(
        fixture,
        run_check,
        "e2e/test-windows-host-safety.ps1",
        '& (Join-Path $PSScriptRoot "test-windows-cleanup-retry.ps1")',
        '# & (Join-Path $PSScriptRoot "test-windows-cleanup-retry.ps1")\n'
        '$cleanupDecoy = { & (Join-Path $PSScriptRoot "test-windows-cleanup-retry.ps1") }',
        "exact host-safety-control script",
        failures,
    )
    for old, new in (
        (
            '$providerErrorRejected = $true',
            '$providerErrorRejected = $false',
        ),
        (
            '$boundedFailure = $true',
            '$boundedFailure = $false',
        ),
        (
            'Start-Sleep -Milliseconds 750',
            'Start-Sleep -Milliseconds 0',
        ),
        (
            '[IO.File]::ReadAllText($foreignSentinel) -cne "synthetic foreign sentinel"',
            '$false',
        ),
    ):
        check_mutation(
            fixture,
            run_check,
            "e2e/test-windows-cleanup-retry.ps1",
            old,
            new,
            "exact cleanup-retry-control script",
            failures,
        )
    for relative, old, new, expected in (
        (
            "docs/quality/windows-e2e-evidence.md",
            "20 attempts at 250ms intervals",
            "an unbounded retry",
            "missing Windows evidence boundary: 20 attempts at 250ms intervals",
        ),
        (
            "docs/quality/windows-release-acceptance.md",
            "fixed 20×250ms bound",
            "dynamic wait",
            "missing Windows evidence boundary: fixed 20×250ms bound",
        ),
        (
            "docs/references/official-sources.md",
            "https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder",
            "https://example.invalid/webview-user-data-folder",
            "missing Windows evidence boundary: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder",
        ),
    ):
        check_mutation(
            fixture,
            run_check,
            relative,
            old,
            new,
            expected,
            failures,
        )
    return failures
