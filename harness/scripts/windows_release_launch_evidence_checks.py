#!/usr/bin/env python3
"""Execution controls and app-data preservation checks for Windows release evidence."""

from __future__ import annotations

import re
from pathlib import Path

from windows_release_launch_syntax import (
    active_code,
    function_body,
    require_code_digest,
    require_exact_lines,
    require_once,
    source_code,
)


READINESS_TEST = "e2e/test-windows-launch-readiness.ps1"
HOST_SAFETY_TEST = "e2e/test-windows-host-safety.ps1"
PRODUCTION_ASSERTION = "e2e/assert-windows-production.ps1"
READINESS_TEST_SHA256 = "a205e94d7ff8e45de6b26e9ce1eda8ce506bf99ee0f2dd433dceebda3258339b"
HOST_SAFETY_TEST_SHA256 = "3e01926ad7624dfd8453d531ed9e8acac94bbfc4b95bef5df1554a25cb3f6db3"
PRODUCTION_ASSERTION_SHA256 = "a20b35c6bbb37ae0940f95b127e691f8e03de1287dace047fa830afcc7a5a9ca"


def check_control_oracle(root: Path, errors: list[str]) -> None:
    host = active_code(root / HOST_SAFETY_TEST)
    require_code_digest(
        source_code(root / HOST_SAFETY_TEST),
        HOST_SAFETY_TEST_SHA256,
        "host-safety-control",
        HOST_SAFETY_TEST,
        errors,
    )
    require_once(
        host,
        r'^& \(Join-Path \$PSScriptRoot "test-windows-launch-readiness\.ps1"\)$',
        "actual readiness control invocation",
        HOST_SAFETY_TEST,
        errors,
    )
    test = active_code(root / READINESS_TEST)
    require_code_digest(
        source_code(root / READINESS_TEST),
        READINESS_TEST_SHA256,
        "actual-readiness-control",
        READINESS_TEST,
        errors,
    )
    oracle = function_body(test, "Assert-ReadinessResult", READINESS_TEST, errors)
    require_exact_lines(
        oracle,
        (
            "param([pscustomobject]$Contract, [bool]$Expected, [string]$Label)",
            "if ((Test-BodamProductionDataReady -Contract $Contract) -ne $Expected) {",
            'throw "production launch readiness control failed: $Label"',
            "}",
        ),
        "readiness-control oracle",
        READINESS_TEST,
        errors,
    )
    assertions = (
        ("absent negative", "absent", "false"),
        ("local-only negative", "local-only", "false"),
        ("directory-only negative", "directory-only", "false"),
        ("wrong basename negative", "wrong-basename", "false"),
        ("zero database negative", "zero-byte", "false"),
        ("database-only negative", "database-only", "false"),
        ("zero backup negative", "zero-byte-daily-backup", "false"),
        ("missing workspace negative", "missing-workspace", "false"),
        ("complete positive", "database-and-daily-backup", "true"),
        ("ready zero database negative", "ready-zero-byte-database", "false"),
        ("ready zero backup negative", "ready-zero-byte-daily-backup", "false"),
        ("restored complete positive", "restored-database-and-daily-backup", "true"),
        ("workspace negative", "nonempty-workspace", "false"),
        ("database directory negative", "database-directory", "false"),
        ("reparse negative", "roaming-reparse", "false"),
    )
    for label, value, expected in assertions:
        require_once(
            test,
            rf'^\s*Assert-ReadinessResult \$contract \${expected} "{value}"$',
            label,
            READINESS_TEST,
            errors,
        )
    for label, pattern in (
        ("junction setup command", r'^\s*\$command = "mklink /J `"\$roaming`" `"\$foreign`""$'),
        ("junction setup execution", r"^\s*& cmd\.exe /D /C \$command 2>\$null \| Out-Null$"),
        (
            "junction setup exit guard",
            r'^\s*if \(\$LASTEXITCODE -ne 0\) \{ throw "launch readiness junction setup failed" \}$',
        ),
        (
            "junction cleanup guard",
            r"^\s*\$roamingItem = Get-Item -LiteralPath \$roaming -Force -ErrorAction SilentlyContinue\n"
            r"\s*if \(\$null -ne \$roamingItem -and\n"
            r"\s*\(\$roamingItem\.Attributes -band \[IO\.FileAttributes\]::ReparsePoint\) -ne 0\) \{\n"
            r"\s*\[IO\.Directory\]::Delete\(\$roaming\)\n\s*\}$",
        ),
        (
            "junction-first cleanup",
            r"^\s*\[IO\.Directory\]::Delete\(\$roaming\)$",
        ),
        (
            "approved-tree cleanup",
            r"^\s*Remove-BodamOwnedTree -Root \$env:RUNNER_TEMP -Path \$testRoot$",
        ),
    ):
        require_once(test, pattern, label, READINESS_TEST, errors)
    ordered = (
        '$command = "mklink /J',
        "& cmd.exe /D /C $command",
        "if ($LASTEXITCODE -ne 0)",
        'Assert-ReadinessResult $contract $false "roaming-reparse"',
        "[IO.Directory]::Delete($roaming)",
        "Remove-BodamOwnedTree -Root $env:RUNNER_TEMP -Path $testRoot",
    )
    positions = [test.find(fragment) for fragment in ordered]
    if -1 in positions or positions != sorted(positions):
        errors.append(f"{READINESS_TEST} has invalid junction control or cleanup order")


def check_app_data_preservation(root: Path, errors: list[str]) -> None:
    production = active_code(root / PRODUCTION_ASSERTION)
    require_code_digest(
        source_code(root / PRODUCTION_ASSERTION),
        PRODUCTION_ASSERTION_SHA256,
        "production-assertion",
        PRODUCTION_ASSERTION,
        errors,
    )
    required = (
        (
            "single observed daily backup",
            r'^\s*if \(\$dailyBackups\.Count -ne 1\) \{ throw "production daily backup readiness is invalid" \}$',
        ),
        (
            "constant-error database hash inspection",
            r"^\s*try \{ \$databaseSha256 = Get-BodamSha256 \$contract\.DatabasePath \} catch \{\n"
            r'\s*throw "production database hash inspection failed"\n\s*\}$',
        ),
        (
            "constant-error daily backup enumeration",
            r"^\s*try \{\n"
            r"\s*\$dailyBackups = @\(Get-ChildItem -LiteralPath \$contract\.BackupDirectory -Force -File `\n"
            r'\s*-Filter "BODAM-daily-\*\.bodam-backup"\)\n'
            r'\s*\} catch \{ throw "production daily backup enumeration failed" \}$',
        ),
        (
            "observed backup regular-path assertion",
            r"^\s*Assert-BodamRegularPath -Path \$dailyBackups\[0\]\.FullName -Directory \$false$",
        ),
        (
            "constant-error daily backup hash inspection",
            r"^\s*try \{ \$dailyBackupSha256 = Get-BodamSha256 \$dailyBackups\[0\]\.FullName \} catch \{\n"
            r'\s*throw "production daily backup hash inspection failed"\n\s*\}$',
        ),
        (
            "preserved roaming regular-path assertion",
            r"^\s*Assert-BodamRegularPath -Path \$contract\.RoamingAppData -Directory \$true$",
        ),
        (
            "preserved backup regular-path assertion",
            r"^\s*Assert-BodamRegularPath -Path \$preservedDailyBackup -Directory \$false$",
        ),
        (
            "constant-error preservation inspection",
            r"^\s*try \{\n"
            r"\s*\$preservedDatabaseLength = \(Get-Item -LiteralPath \$contract\.DatabasePath\)\.Length\n"
            r"\s*\$preservedDatabaseSha256 = Get-BodamSha256 \$contract\.DatabasePath\n"
            r"\s*\$preservedDailyBackupSha256 = Get-BodamSha256 \$preservedDailyBackup\n"
            r'\s*\} catch \{ throw "production app-data preservation inspection failed" \}$',
        ),
        (
            "nonempty hash-preservation gate",
            r"^\s*if \(\$preservedDatabaseLength -le 0 -or\n"
            r"\s*\$preservedDatabaseSha256 -cne \$databaseSha256 -or\n"
            r"\s*\$preservedDailyBackupSha256 -cne \$dailyBackupSha256\) \{\n"
            r'\s*throw "NSIS uninstall did not preserve production app-data"\n\s*\}$',
        ),
    )
    for label, pattern in required:
        require_once(production, pattern, label, PRODUCTION_ASSERTION, errors)
    database_assertion = (
        r"^\s*Assert-BodamRegularPath -Path \$contract\.DatabasePath -Directory \$false$"
    )
    if len(re.findall(database_assertion, production, re.MULTILINE)) != 2:
        errors.append(
            f"{PRODUCTION_ASSERTION} missing launch readiness semantic: "
            "observed and preserved database regular-path assertions"
        )
    ordered = (
        r"^\s*\$observedAppData = @\(Invoke-BodamLaunchSmoke -Contract \$contract\)$",
        r"^\s*try \{ \$databaseSha256 = Get-BodamSha256 \$contract\.DatabasePath \} catch \{$",
        r"^\s*if \(\$dailyBackups\.Count -ne 1\)",
        r"^\s*Assert-BodamRegularPath -Path \$dailyBackups\[0\]\.FullName -Directory \$false$",
        r"^\s*try \{ \$dailyBackupSha256 = Get-BodamSha256 \$dailyBackups\[0\]\.FullName \} catch \{$",
        r"^\s*\$uninstallExitCode = Invoke-BodamNsisUninstall -Contract \$contract$",
        r"^\s*Assert-BodamRegularPath -Path \$contract\.RoamingAppData -Directory \$true$",
        r"^\s*\$preservedDailyBackup = Join-Path \$contract\.BackupDirectory \$dailyBackupName$",
        r"^\s*Assert-BodamRegularPath -Path \$preservedDailyBackup -Directory \$false$",
        r"^\s*\$preservedDailyBackupSha256 -cne \$dailyBackupSha256\) \{$",
        r"^\s*\$webViewAfterUninstall = \$true$",
        r"^\s*\$uninstalled = \$true$",
        r"^\s*if \(-not \$uninstalled -or \$installed -or$",
        r"^Write-ReleaseEvidence -InstallExitCode \$installExitCode ",
    )
    matched = [list(re.finditer(pattern, production, re.MULTILINE)) for pattern in ordered]
    database_matches = list(re.finditer(database_assertion, production, re.MULTILINE))
    positions = [found[0].start() for found in matched if len(found) == 1]
    if len(positions) == len(ordered) and len(database_matches) == 2:
        positions.insert(1, database_matches[0].start())
        positions.insert(8, database_matches[1].start())
    if len(positions) != len(ordered) + 2 or positions != sorted(positions):
        errors.append(f"{PRODUCTION_ASSERTION} has invalid app-data preservation order")


def check_launch_execution_and_preservation(root: Path, errors: list[str]) -> None:
    check_control_oracle(root, errors)
    check_app_data_preservation(root, errors)
