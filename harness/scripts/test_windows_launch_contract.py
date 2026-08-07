#!/usr/bin/env python3
"""Mutation controls for Windows production startup-readiness semantics."""

from __future__ import annotations

import tempfile
from pathlib import Path

from test_windows_workflow_contract import CheckRunner, FixtureFactory, check_mutation


def run_windows_launch_negative_controls(
    fixture: FixtureFactory, run_check: CheckRunner
) -> list[str]:
    failures: list[str] = []
    mutations = (
        (
            "e2e/windows-installer-contract.psm1",
            "      $readinessToken = Get-BodamProductionReadinessToken -Contract $Contract",
            "      # $readinessToken = Get-BodamProductionReadinessToken -Contract $Contract\n"
            "      $readinessToken = Get-BodamProductionReadinessTokenSpoof -Contract $Contract",
            "actual readiness token",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "$Contract.DatabasePath -Force `",
            "$Contract.LocalAppData -Force `",
            "exact roaming database",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "$database.Length -le 0) {",
            "$database.Length -lt 0) {",
            "database type, reparse, and length rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "$backupDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint",
            "$backupDirectorySpoof.Attributes -band [IO.FileAttributes]::ReparsePoint",
            "backup and workspace directory rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "[89ab][0-9a-f]{3}-[0-9a-f]{12}",
            ".+",
            "daily backup type, reparse, length, and basename rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "$workspaceChildren.Count -ne 0",
            "$workspaceChildren.Count -lt 0",
            "single backup and empty workspace",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {",
            "($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {",
            "roaming directory type and reparse rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "($database.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "($database.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or",
            "database type, reparse, and length rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "($backupDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "($backupDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or",
            "backup and workspace directory rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "($workspace.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {",
            "($workspace.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {",
            "backup and workspace directory rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "($dailyBackup.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "($dailyBackup.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or",
            "daily backup type, reparse, length, and basename rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "      ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {",
            "      $false) { # ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0",
            "roaming directory type and reparse rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "      ($database.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "      $false -or # ($database.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "database type, reparse, and length rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "      ($backupDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "      $false -or # ($backupDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "backup and workspace directory rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "      ($workspace.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {",
            "      $false) { # ($workspace.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0",
            "backup and workspace directory rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "      ($dailyBackup.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "      $false -or # ($dailyBackup.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or",
            "daily backup type, reparse, length, and basename rejection",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "    -ErrorAction SilentlyContinue",
            "    -ErrorAction Stop",
            "exact roaming directory",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "$null -ne (Get-BodamProductionReadinessToken -Contract $Contract)",
            "$true",
            "exact readiness-wrapper function body",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "$dailyBackup.PSIsContainer -or",
            "-not $dailyBackup.PSIsContainer -or",
            "daily backup type, reparse, length, and basename rejection",
        ),
        (
            "e2e/test-windows-host-safety.ps1",
            '& (Join-Path $PSScriptRoot "test-windows-launch-readiness.ps1")',
            '# & (Join-Path $PSScriptRoot "test-windows-launch-readiness.ps1")\n'
            '& (Join-Path $PSScriptRoot "test-windows-launch-readiness.ps1.backup")',
            "actual readiness control invocation",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "$roamingAppData = Join-Path $env:APPDATA $identifier",
            "$roamingAppData = Join-Path $env:LOCALAPPDATA $identifier",
            "exact roaming root",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "      $readinessToken = Get-BodamProductionReadinessToken -Contract $Contract",
            "      $readinessToken = Get-BodamProductionReadinessToken -Contract $Contract\n"
            "      $readinessToken = Get-BodamProductionReadinessToken -Contract $Contract",
            "actual readiness token",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "$null -ne $readinessToken",
            "$null -eq $readinessToken",
            "window, process, and data readiness",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "if ($process.HasExited) {",
            "if (-not $process.HasExited) {",
            "early process-exit rejection",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "$deadline = [DateTime]::UtcNow.AddSeconds(60)",
            "$deadline = [DateTime]::UtcNow.AddSeconds(1)",
            "bounded startup deadline",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "if (-not $closeRequested) {",
            "if ($false) {",
            "normal close acceptance",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "if (-not $normalExit) {",
            "if ($false) {",
            "bounded normal-exit acceptance",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "      $lastReadinessToken = $readinessToken\n"
            "    } while ($readySamples -lt 4 -and [DateTime]::UtcNow -lt $deadline)\n"
            "    if ($readySamples -lt 4) {\n"
            "      throw \"installed production startup readiness check failed\"\n"
            "    }\n"
            "    Assert-BodamRegularPath -Path $Contract.RoamingAppData -Directory $true\n"
            "    Assert-BodamRegularPath -Path $Contract.DatabasePath -Directory $false\n"
            "    $closeRequested = $process.CloseMainWindow()",
            "      $lastReadinessToken = $readinessToken\n"
            "      $closeRequested = $process.CloseMainWindow()\n"
            "    } while ($readySamples -lt 4 -and [DateTime]::UtcNow -lt $deadline)\n"
            "    if ($readySamples -lt 4) {\n"
            "      throw \"installed production startup readiness check failed\"\n"
            "    }\n"
            "    Assert-BodamRegularPath -Path $Contract.RoamingAppData -Directory $true\n"
            "    Assert-BodamRegularPath -Path $Contract.DatabasePath -Directory $false",
            "invalid readiness, normal-exit, or cleanup order",
        ),
        (
            "e2e/test-windows-launch-readiness.ps1",
            "if ((Test-BodamProductionDataReady -Contract $Contract) -ne $Expected) {",
            "if ($false) {",
            "exact readiness-control oracle function body",
        ),
        (
            "e2e/test-windows-launch-readiness.ps1",
            '$command = "mklink /J `"$roaming`" `"$foreign`""',
            '$command = "mklink /J-spoof `"$roaming`" `"$foreign`""',
            "junction setup command",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "$closeRequested = $process.CloseMainWindow()",
            "# $closeRequested = $process.CloseMainWindow()\n"
            "    $closeRequested = $process.CloseMainWindowSpoof()",
            "normal close",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "$normalExit = $process.WaitForExit(60000)",
            "$normalExit = $process.WaitForExit(1)",
            "bounded normal exit",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "} while ($readySamples -lt 4 -and [DateTime]::UtcNow -lt $deadline)",
            "} while ($readySamples -lt 1 -and [DateTime]::UtcNow -lt $deadline)",
            "four stable samples",
        ),
        (
            "e2e/test-windows-launch-readiness.ps1",
            'Assert-ReadinessResult $contract $false "local-only"',
            'Assert-ReadinessResult $contract $true "local-only"',
            "local-only negative",
        ),
        (
            "e2e/assert-windows-production.ps1",
            "if ($dailyBackups.Count -ne 1) {",
            "if ($dailyBackups.Count -eq 1) {",
            "single observed daily backup",
        ),
        (
            "e2e/assert-windows-production.ps1",
            "$preservedDailyBackupSha256 -cne $dailyBackupSha256) {",
            "$preservedDailyBackupSha256 -ceq $dailyBackupSha256) {",
            "nonempty hash-preservation gate",
        ),
        (
            "e2e/assert-windows-production.ps1",
            "$databaseSha256 = Get-BodamSha256 $contract.DatabasePath",
            "$databaseSha256 = Get-BodamSha256 $contract.DatabasePathSpoof",
            "invalid app-data preservation order",
        ),
        (
            "docs/quality/windows-e2e-evidence.md",
            "exact roaming `bodam.sqlite3`",
            "generic app data\n<!-- exact roaming `bodam.sqlite3` -->",
            "missing Windows evidence boundary: exact roaming `bodam.sqlite3`",
        ),
        (
            "docs/references/official-sources.md",
            "7cd71369c00978a3783b6ae3e9972358abbe4ae6/crates/tauri/src/app.rs",
            "8cd71369c00978a3783b6ae3e9972358abbe4ae6/crates/tauri/src/app.rs",
            "missing Windows evidence boundary: https://github.com/tauri-apps/tauri/blob/7cd71369",
        ),
        (
            "docs/references/official-sources.md",
            "https://docs.rs/tauri/2.11.5/tauri/path/struct.PathResolver.html#method.app_data_dir",
            "https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html#method.app_data_dir",
            "missing Windows evidence boundary: https://docs.rs/tauri/2.11.5/tauri/path/struct.PathResolver.html#method.app_data_dir",
        ),
        (
            "docs/references/official-sources.md",
            "https://docs.rs/dirs/6.0.0/dirs/fn.data_dir.html",
            "https://docs.rs/dirs/latest/dirs/fn.data_dir.html",
            "missing Windows evidence boundary: https://docs.rs/dirs/6.0.0/dirs/fn.data_dir.html",
        ),
    )
    for relative, old, new, expected in mutations:
        check_mutation(fixture, run_check, relative, old, new, expected, failures)
    for relative in (
        "e2e/windows-launch-readiness.psm1",
        "e2e/test-windows-launch-readiness.ps1",
    ):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixture(root)
            (root / relative).unlink()
            errors = run_check(root)
            if not any(f"missing Windows release script: {relative}" in error for error in errors):
                failures.append(f"Windows launch negative control did not detect missing: {relative}")
    return failures
