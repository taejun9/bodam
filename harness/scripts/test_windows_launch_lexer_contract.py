#!/usr/bin/env python3
"""String-decoy controls for PowerShell Windows release semantics."""

from __future__ import annotations

from test_windows_workflow_contract import CheckRunner, FixtureFactory, check_mutation
from windows_release_launch_syntax import INVALID_SOURCE, strip_comments


def run_windows_launch_lexer_negative_controls(
    fixture: FixtureFactory, run_check: CheckRunner
) -> list[str]:
    failures: list[str] = []
    here = '$decoy = @"\n$hidden = $true\n"@\n$visible = $true\n'
    if strip_comments(here) != INVALID_SOURCE:
        failures.append("PowerShell here-string syntax was not rejected fail-closed")
    multiline = '$decoy = "\n$hidden = $true\n"\n'
    if strip_comments(multiline) != INVALID_SOURCE:
        failures.append("PowerShell multiline string syntax was not rejected fail-closed")
    mutations = (
        (
            "e2e/windows-installer-contract.psm1",
            "$roamingAppData = Join-Path $env:APPDATA $identifier",
            "$roamingAppData = Join-Path $env:LOCALAPPDATA $identifier\n"
            '$decoy = @"\n$roamingAppData = Join-Path $env:APPDATA $identifier\n"@',
            "exact roaming root",
        ),
        (
            "e2e/test-windows-host-safety.ps1",
            '& (Join-Path $PSScriptRoot "test-windows-launch-readiness.ps1")',
            '$decoy = @"\n& (Join-Path $PSScriptRoot '
            '"test-windows-launch-readiness.ps1")\n"@',
            "actual readiness control invocation",
        ),
        (
            "e2e/test-windows-host-safety.ps1",
            '& (Join-Path $PSScriptRoot "test-windows-launch-readiness.ps1")',
            '$launchDecoy = {\n& (Join-Path $PSScriptRoot '
            '"test-windows-launch-readiness.ps1")\n}',
            "exact host-safety-control script",
        ),
        (
            "e2e/test-windows-host-safety.ps1",
            '& (Join-Path $PSScriptRoot "test-windows-launch-readiness.ps1")',
            '$launchDecoy = "\n& (Join-Path $PSScriptRoot '
            '"test-windows-launch-readiness.ps1")\n"',
            "exact host-safety-control script",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "$roamingAppData = Join-Path $env:APPDATA $identifier",
            "$roamingAppData = Join-Path $env:LOCALAPPDATA $identifier\n"
            "if ($false) { $roamingAppData = Join-Path $env:APPDATA $identifier }",
            "exact installer-contract script",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            'Export-ModuleMember -Function @(\n'
            '  "Get-BodamProductionReadinessToken", "Test-BodamProductionDataReady"\n'
            ')',
            'Export-ModuleMember -Function @(\n'
            '  "Get-BodamProductionReadinessTokenSpoof", '
            '"Test-BodamProductionDataReadySpoof"\n'
            ')\n$exportDecoy = {\n'
            '  "Get-BodamProductionReadinessToken", "Test-BodamProductionDataReady"\n'
            '}',
            "exact readiness-module script",
        ),
        (
            "e2e/windows-launch-readiness.psm1",
            "Set-StrictMode -Version Latest",
            "Set-StrictMode -Version Latest#invalid-version-token",
            "exact readiness-module script",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "  Assert-BodamNsisPayloadIdentity -SourcePath $Contract.SourceBinary `\n"
            "    -InstalledPath $Contract.InstalledBinary",
            "  Assert-BodamNsisPayloadIdentity -SourcePath $Contract.SourceBinary `\n"
            "  # inserted continuation breaker\n"
            "    -InstalledPath $Contract.InstalledBinary",
            "exact installer-contract script",
        ),
        (
            "e2e/windows-installer-contract.psm1",
            "  Assert-BodamNsisPayloadIdentity -SourcePath $Contract.SourceBinary `\n",
            "  Assert-BodamNsisPayloadIdentity -SourcePath $Contract.SourceBinary ` \n",
            "exact installer-contract script",
        ),
        (
            "e2e/test-windows-launch-readiness.ps1",
            'Assert-ReadinessResult $contract $false "local-only"',
            '$decoy = @"\nAssert-ReadinessResult $contract $false "local-only"\n"@',
            "local-only negative",
        ),
        (
            "e2e/test-windows-launch-readiness.ps1",
            '$command = "mklink /J `"$roaming`" `"$foreign`""',
            '$command = "ver >nul"\n$decoy = @"\n'
            '$command = "mklink /J `"$roaming`" `"$foreign`""\n"@',
            "junction setup command",
        ),
        (
            "e2e/test-windows-launch-readiness.ps1",
            "if ($null -ne $roamingItem -and",
            "if ($false -and",
            "junction cleanup guard",
        ),
        (
            "e2e/assert-windows-production.ps1",
            "  if ($preservedDatabaseLength -le 0 -or\n"
            "      $preservedDatabaseSha256 -cne $databaseSha256 -or\n"
            "      $preservedDailyBackupSha256 -cne $dailyBackupSha256) {\n"
            '    throw "NSIS uninstall did not preserve production app-data"\n'
            "  }",
            '  if ($false) { throw "NSIS uninstall did not preserve production app-data" }\n'
            '  $decoy = @"\n'
            "  if ($preservedDatabaseLength -le 0 -or\n"
            "      $preservedDatabaseSha256 -cne $databaseSha256 -or\n"
            "      $preservedDailyBackupSha256 -cne $dailyBackupSha256) {\n"
            '    throw "NSIS uninstall did not preserve production app-data"\n'
            '  }\n"@',
            "nonempty hash-preservation gate",
        ),
        (
            "e2e/assert-windows-production.ps1",
            "  if ($preservedDatabaseLength -le 0 -or\n"
            "      $preservedDatabaseSha256 -cne $databaseSha256 -or\n"
            "      $preservedDailyBackupSha256 -cne $dailyBackupSha256) {\n"
            '    throw "NSIS uninstall did not preserve production app-data"\n'
            "  }",
            '  if ($false) { throw "NSIS uninstall did not preserve production app-data" }\n'
            "  $preservationDecoy = {\n"
            "  if ($preservedDatabaseLength -le 0 -or\n"
            "      $preservedDatabaseSha256 -cne $databaseSha256 -or\n"
            "      $preservedDailyBackupSha256 -cne $dailyBackupSha256) {\n"
            '    throw "NSIS uninstall did not preserve production app-data"\n'
            "  }\n  }",
            "exact production-assertion script",
        ),
    )
    for relative, old, new, expected in mutations:
        check_mutation(fixture, run_check, relative, old, new, expected, failures)
    return failures
