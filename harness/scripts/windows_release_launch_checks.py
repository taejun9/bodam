#!/usr/bin/env python3
"""Production Windows startup-readiness and normal-exit contracts."""

from __future__ import annotations

import re
from pathlib import Path

from windows_release_launch_evidence_checks import (
    check_launch_execution_and_preservation,
)
from windows_release_launch_syntax import (
    active_code,
    function_body,
    require_body_digest,
    require_code_digest,
    require_exact_lines,
    require_once,
    source_code,
)

READINESS_MODULE = "e2e/windows-launch-readiness.psm1"
INSTALLER_MODULE = "e2e/windows-installer-contract.psm1"
DAILY_BASENAME = (
    r"^BODAM-daily-\d{8}T\d{9}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-"
    r"[89ab][0-9a-f]{3}-[0-9a-f]{12}\.bodam-backup$"
)
READINESS_BODY_SHA256 = "5f7e2e181624d544a5fff048d25cffdbececaf47f48c376c1d0abda250110a06"
READINESS_MODULE_SHA256 = "b3ceb81e3e5381a386bcc3b6cfb87417a3f74ac0aa72dd03b03eda614ccd5b46"
LAUNCH_BODY_SHA256 = "501afadf378a6d8eb4004b073c82b0bafb1d05abac21d5882e5e2dd8d0a59afe"
INSTALLER_MODULE_SHA256 = "0bdf853841f05592848059f574307ada97275a3ae5ab017f256e82126560211f"


def check_readiness_module(root: Path, errors: list[str]) -> None:
    relative = READINESS_MODULE
    code = active_code(root / relative)
    require_code_digest(
        source_code(root / relative),
        READINESS_MODULE_SHA256,
        "readiness-module",
        relative,
        errors,
    )
    body = function_body(code, "Get-BodamProductionReadinessToken", relative, errors)
    require_body_digest(body, READINESS_BODY_SHA256, "readiness-token", relative, errors)
    for label, pattern in (
        (
            "exact roaming directory",
            r"^[ \t]*\$directory = Get-Item -LiteralPath \$Contract\.RoamingAppData -Force `\n"
            r"[ \t]*-ErrorAction SilentlyContinue$",
        ),
        (
            "exact roaming database",
            r"^[ \t]*\$database = Get-Item -LiteralPath \$Contract\.DatabasePath -Force `\n"
            r"[ \t]*-ErrorAction SilentlyContinue$",
        ),
        (
            "exact backup directory",
            r"^[ \t]*\$backupDirectory = Get-Item -LiteralPath \$Contract\.BackupDirectory -Force `\n"
            r"[ \t]*-ErrorAction SilentlyContinue$",
        ),
        (
            "exact empty workspace",
            r"^[ \t]*\$workspace = Get-Item -LiteralPath \$Contract\.WorkspaceDirectory -Force `\n"
            r"[ \t]*-ErrorAction SilentlyContinue$",
        ),
        (
            "all readiness paths present",
            r"^[ \t]*if \(\$null -eq \$directory -or \$null -eq \$database -or\n"
            r"[ \t]*\$null -eq \$backupDirectory -or \$null -eq \$workspace\) \{\n"
            r"[ \t]*return \$null\n[ \t]*\}$",
        ),
        (
            "roaming directory type and reparse rejection",
            r"^[ \t]*if \(-not \$directory\.PSIsContainer -or\n"
            r"[ \t]*\(\$directory\.Attributes -band \[IO\.FileAttributes\]::ReparsePoint\) -ne 0\) \{\n"
            r"[ \t]*return \$null\n[ \t]*\}$",
        ),
        (
            "database type, reparse, and length rejection",
            r"^[ \t]*if \(\$database\.PSIsContainer -or\n"
            r"[ \t]*\(\$database\.Attributes -band \[IO\.FileAttributes\]::ReparsePoint\) -ne 0 -or\n"
            r"[ \t]*\$database\.Length -le 0\) \{\n[ \t]*return \$null\n[ \t]*\}$",
        ),
        (
            "backup and workspace directory rejection",
            r"^[ \t]*if \(-not \$backupDirectory\.PSIsContainer -or\n"
            r"[ \t]*\(\$backupDirectory\.Attributes -band \[IO\.FileAttributes\]::ReparsePoint\) -ne 0 -or\n"
            r"[ \t]*-not \$workspace\.PSIsContainer -or\n"
            r"[ \t]*\(\$workspace\.Attributes -band \[IO\.FileAttributes\]::ReparsePoint\) -ne 0\) \{\n"
            r"[ \t]*return \$null\n[ \t]*\}$",
        ),
        (
            "single backup and empty workspace",
            r"^[ \t]*if \(\$backupChildren\.Count -ne 1 -or \$workspaceChildren\.Count -ne 0\) \{ return \$null \}$",
        ),
        (
            "fail-closed child enumeration",
            r"^[ \t]*try \{\n"
            r"[ \t]*\$backupChildren = @\(Get-ChildItem -LiteralPath \$Contract\.BackupDirectory -Force\)\n"
            r"[ \t]*\$workspaceChildren = @\(Get-ChildItem -LiteralPath \$Contract\.WorkspaceDirectory -Force\)\n"
            r"[ \t]*\} catch \{\n[ \t]*return \$null\n[ \t]*\}$",
        ),
        (
            "exact daily backup selection",
            r"^[ \t]*\$dailyBackup = \$backupChildren\[0\]$",
        ),
        (
            "daily backup type, reparse, length, and basename rejection",
            r"^[ \t]*if \(\$dailyBackup\.PSIsContainer -or \$dailyBackup\.Length -le 0 -or\n"
            r"[ \t]*\(\$dailyBackup\.Attributes -band \[IO\.FileAttributes\]::ReparsePoint\) -ne 0 -or\n"
            rf"[ \t]*\$dailyBackup\.Name -cnotmatch {re.escape(chr(39) + DAILY_BASENAME + chr(39))}\) \{{\n"
            r"[ \t]*return \$null\n[ \t]*\}$",
        ),
        (
            "stable readiness token",
            r'^[ \t]*"\$\(\$database\.Length\):\$\(\$dailyBackup\.Name\):\$\(\$dailyBackup\.Length\)"$',
        ),
    ):
        require_once(body, pattern, label, relative, errors)
    if "LocalAppData" in body:
        errors.append(f"{relative} must not accept LocalAppData as production readiness")
    wrapper = function_body(code, "Test-BodamProductionDataReady", relative, errors)
    require_exact_lines(
        wrapper,
        (
            "param([Parameter(Mandatory)][pscustomobject]$Contract)",
            "$null -ne (Get-BodamProductionReadinessToken -Contract $Contract)",
        ),
        "readiness-wrapper",
        relative,
        errors,
    )
    require_once(
        code,
        r'^\s*"Get-BodamProductionReadinessToken", "Test-BodamProductionDataReady"$',
        "exact readiness exports",
        relative,
        errors,
    )


def check_installer_launch(root: Path, errors: list[str]) -> None:
    relative = INSTALLER_MODULE
    code = active_code(root / relative)
    require_code_digest(
        source_code(root / relative),
        INSTALLER_MODULE_SHA256,
        "installer-contract",
        relative,
        errors,
    )
    regular_path = function_body(code, "Assert-BodamRegularPath", relative, errors)
    require_exact_lines(
        regular_path,
        (
            "param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][bool]$Directory)",
            "$item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue",
            'if ($null -eq $item) { throw "installer contract path is missing" }',
            "if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {",
            'throw "installer contract path must not be a reparse point"',
            "}",
            'if ($Directory -and -not $item.PSIsContainer) { throw "expected installer directory" }',
            'if (-not $Directory -and $item.PSIsContainer) { throw "expected installer file" }',
        ),
        "regular-path assertion",
        relative,
        errors,
    )
    body = function_body(code, "Invoke-BodamLaunchSmoke", relative, errors)
    require_body_digest(body, LAUNCH_BODY_SHA256, "launch-smoke", relative, errors)
    for label, pattern in (
        ("readiness module import", r'^Import-Module \(Join-Path \$PSScriptRoot "windows-launch-readiness\.psm1"\) -Force$'),
        ("exact roaming root", r'^\s*\$roamingAppData = Join-Path \$env:APPDATA \$identifier$'),
        ("exact roaming root assignment", r'^\s*RoamingAppData = \$roamingAppData$'),
        ("exact roaming database leaf", r'^\s*DatabasePath = Join-Path \$roamingAppData "bodam\.sqlite3"$'),
        ("exact backup directory leaf", r'^\s*BackupDirectory = Join-Path \$roamingAppData "backups"$'),
        ("exact workspace leaf", r'^\s*WorkspaceDirectory = Join-Path \$roamingAppData "backup-work"$'),
    ):
        require_once(code, pattern, label, relative, errors)
    for label, pattern in (
        (
            "constant-error production start",
            r'^\s*try \{ \$process = Start-Process -FilePath \$Contract\.InstalledBinary '
            r'-WorkingDirectory \$Contract\.InstallDirectory -PassThru \} catch \{ '
            r'throw "installed production executable could not be started" \}$',
        ),
        ("bounded startup deadline", r"^\s*\$deadline = \[DateTime\]::UtcNow\.AddSeconds\(60\)$"),
        (
            "early process-exit rejection",
            r'^\s*if \(\$process\.HasExited\) \{ throw "installed production executable exited before startup readiness" \}$',
        ),
        (
            "exact installed process path rejection",
            r'^\s*if \(-not \(Test-BodamSamePath \$process\.Path \$Contract\.InstalledBinary\)\) \{\n'
            r'\s*throw "installed production executable path changed during launch"\n\s*\}$',
        ),
        ("actual readiness token", r"^\s*\$readinessToken = Get-BodamProductionReadinessToken -Contract \$Contract$"),
        (
            "window, process, and data readiness",
            r"^\s*\$ready = \$process\.MainWindowHandle -ne 0 -and \$process\.Responding -and\n"
            r"\s*\$null -ne \$readinessToken$",
        ),
        ("stable token comparison", r"^\s*if \(\$ready -and \$readinessToken -ceq \$lastReadinessToken\) \{$"),
        ("latest token observation", r"^\s*\$lastReadinessToken = \$readinessToken$"),
        ("four stable samples", r"^\s*\} while \(\$readySamples -lt 4 -and \[DateTime\]::UtcNow -lt \$deadline\)$"),
        (
            "startup readiness success gate",
            r'^\s*if \(\$readySamples -lt 4\) \{\n'
            r'\s*throw "installed production startup readiness check failed"\n\s*\}$',
        ),
        (
            "regular roaming directory assertion",
            r"^\s*Assert-BodamRegularPath -Path \$Contract\.RoamingAppData -Directory \$true$",
        ),
        (
            "regular roaming database assertion",
            r"^\s*Assert-BodamRegularPath -Path \$Contract\.DatabasePath -Directory \$false$",
        ),
        ("normal close", r"^\s*\$closeRequested = \$process\.CloseMainWindow\(\)$"),
        (
            "normal close acceptance",
            r'^\s*if \(-not \$closeRequested\) \{\n'
            r'\s*throw "installed production window refused a normal close request"\n\s*\}$',
        ),
        ("bounded normal exit", r"^\s*\$normalExit = \$process\.WaitForExit\(60000\)$"),
        (
            "bounded normal-exit acceptance",
            r'^\s*if \(-not \$normalExit\) \{\n'
            r'\s*throw "installed production executable did not exit after its normal close request"\n\s*\}$',
        ),
        (
            "zero normal exit",
            r'^\s*if \(\$process\.ExitCode -ne 0\) \{\n'
            r'\s*throw "installed production executable returned a nonzero normal-exit code"\n\s*\}$',
        ),
        (
            "no remaining installed process",
            r'^\s*if \(@\(Get-BodamExactProcesses \$Contract\)\.Count -ne 0\) \{\n'
            r'\s*throw "installed production executable remained after its normal exit"\n\s*\}$',
        ),
        (
            "failure-only force cleanup",
            r"^\s*\} finally \{\n"
            r"\s*try \{\n"
            r"\s*if \(-not \$process\.HasExited -and \(Test-BodamSamePath \$process\.Path \$Contract\.InstalledBinary\)\) \{\n"
            r"\s*Stop-Process -Id \$process\.Id -Force\n"
            r"\s*\$process\.WaitForExit\(15000\) \| Out-Null\n"
            r"\s*\}\n"
            r'\s*\} catch \{ throw "installed production cleanup failed" \}\n'
            r"\s*\}$",
        ),
    ):
        require_once(body, pattern, label, relative, errors)
    ordered = (
        "$readinessToken = Get-BodamProductionReadinessToken",
        "} while ($readySamples -lt 4 -and [DateTime]::UtcNow -lt $deadline)",
        "if ($readySamples -lt 4)",
        "Assert-BodamRegularPath -Path $Contract.RoamingAppData -Directory $true",
        "Assert-BodamRegularPath -Path $Contract.DatabasePath -Directory $false",
        "$closeRequested = $process.CloseMainWindow()",
        "if (-not $closeRequested)",
        "$normalExit = $process.WaitForExit(60000)",
        "if (-not $normalExit)",
        "if ($process.ExitCode -ne 0)",
        "if (@(Get-BodamExactProcesses $Contract).Count -ne 0)",
        "} finally {",
        "Stop-Process -Id $process.Id -Force",
    )
    positions = [body.find(fragment) for fragment in ordered]
    if -1 in positions or positions != sorted(positions):
        errors.append(f"{relative} has invalid readiness, normal-exit, or cleanup order")


def check_windows_release_launch(root: Path, errors: list[str]) -> None:
    check_readiness_module(root, errors)
    check_installer_launch(root, errors)
    check_launch_execution_and_preservation(root, errors)
