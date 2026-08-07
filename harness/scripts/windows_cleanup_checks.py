#!/usr/bin/env python3
"""Fail-closed checks for bounded Windows app-owned cleanup retries."""

from __future__ import annotations

import re
from pathlib import Path

from windows_release_launch_syntax import (
    active_code,
    function_body,
    require_body_digest,
    require_code_digest,
    require_exact_lines,
    require_once,
    source_code,
)


HOST_MODULE = "e2e/windows-host-safety.psm1"
HOST_CONTROL = "e2e/test-windows-host-safety.ps1"
CLEANUP_CONTROL = "e2e/test-windows-cleanup-retry.ps1"
HOST_MODULE_SHA256 = "728e8dae7fce04ac4e47c0653f27c1ed6ed65c07e1c9425606a8150ae180563e"
PROBE_BODY_SHA256 = "8c4f7078782ab466f69b276b264b4b5005add355540990fba78df2d47edd231e"
SHARING_BODY_SHA256 = "a22b463070b663ca33332b10acfb137da6bd289b4db8f141f668fe679defa136"
OWNED_TREE_BODY_SHA256 = "53613e0aa14f768f12872778f889565649144cd4dc035e7b29000d17a629a69c"
CLEANUP_CONTROL_SHA256 = "7e5c73b5e4f836e93296e0da814ca2311ab1674b918b8fa048fc884a63cac81a"


def check_owned_tree_retry(root: Path, errors: list[str]) -> None:
    require_code_digest(
        source_code(root / HOST_MODULE),
        HOST_MODULE_SHA256,
        "host-cleanup-module",
        HOST_MODULE,
        errors,
    )
    code = active_code(root / HOST_MODULE)
    probe = function_body(code, "Get-BodamCleanupItem", HOST_MODULE, errors)
    require_body_digest(
        probe, PROBE_BODY_SHA256, "cleanup-item probe", HOST_MODULE, errors
    )
    require_exact_lines(
        probe,
        (
            "param([Parameter(Mandatory)][string]$Path)",
            "try {",
            "Get-Item -LiteralPath $Path -Force -ErrorAction Stop",
            "} catch [Management.Automation.ItemNotFoundException] {",
            "return $null",
            "}",
        ),
        "cleanup-item probe",
        HOST_MODULE,
        errors,
    )
    sharing = function_body(code, "Test-BodamCleanupSharingViolation", HOST_MODULE, errors)
    require_body_digest(
        sharing, SHARING_BODY_SHA256, "cleanup-sharing predicate", HOST_MODULE, errors
    )
    require_exact_lines(
        sharing,
        (
            "param([Parameter(Mandatory)][Exception]$Exception)",
            "$Exception -is [IO.IOException] -and $Exception.HResult -eq -2147024864",
        ),
        "cleanup-sharing predicate",
        HOST_MODULE,
        errors,
    )
    body = function_body(code, "Remove-BodamOwnedTree", HOST_MODULE, errors)
    require_body_digest(
        body, OWNED_TREE_BODY_SHA256, "bounded-owned-tree", HOST_MODULE, errors
    )
    required = (
        (
            "fixed cleanup attempt bound",
            r"^\s*for \(\$attempt = 1; \$attempt -le 20; \$attempt \+= 1\) \{$",
        ),
        (
            "per-attempt exact path assertion",
            r"^\s*\$target = Assert-BodamExactCleanupPath -Root \$Root -Path \$Path "
            r"-Directory \$true$",
        ),
        (
            "not-found-only absence probe",
            r"^\s*if \(\$null -eq \(Get-BodamCleanupItem -Path \$target\)\) \{ return \}$",
        ),
        (
            "per-attempt reparse scan",
            r"^\s*Assert-BodamOwnedTreeSafe -Path \$target$",
        ),
        (
            "literal fail-closed removal",
            r"^\s*Remove-Item -LiteralPath \$target -Recurse -Force -ErrorAction Stop$",
        ),
        (
            "removal postcondition",
            r"^\s*if \(\$null -ne \(Get-BodamCleanupItem -Path \$target\)\) \{$",
        ),
        (
            "sharing-only retry",
            r"^\s*if \(-not \(Test-BodamCleanupSharingViolation -Exception \$_\.Exception\)\) "
            r"\{ throw \}$",
        ),
        (
            "bounded lock exhaustion",
            r'^\s*if \(\$attempt -eq 20\) \{ throw "CI cleanup target remained locked after bounded retries" \}$',
        ),
        ("fixed retry delay", r"^\s*Start-Sleep -Milliseconds 250$"),
    )
    for label, pattern in required:
        require_once(body, pattern, label, HOST_MODULE, errors)
    ordered = (
        "for ($attempt = 1; $attempt -le 20; $attempt += 1)",
        "$target = Assert-BodamExactCleanupPath",
        "if ($null -eq (Get-BodamCleanupItem -Path $target))",
        "Assert-BodamOwnedTreeSafe -Path $target",
        "Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop",
        "if ($null -ne (Get-BodamCleanupItem -Path $target))",
        "Test-BodamCleanupSharingViolation -Exception $_.Exception",
        "if ($attempt -eq 20)",
        "Start-Sleep -Milliseconds 250",
    )
    positions = [body.find(fragment) for fragment in ordered]
    if -1 in positions or positions != sorted(positions):
        errors.append(f"{HOST_MODULE} has invalid bounded cleanup retry order")
    if re.search(r"msedgewebview2|taskkill", code, re.IGNORECASE):
        errors.append(f"{HOST_MODULE} must not terminate shared WebView processes")


def check_native_controls(root: Path, errors: list[str]) -> None:
    host = active_code(root / HOST_CONTROL)
    require_once(
        host,
        r'^& \(Join-Path \$PSScriptRoot "test-windows-cleanup-retry\.ps1"\)$',
        "actual bounded cleanup control invocation",
        HOST_CONTROL,
        errors,
    )
    relative = CLEANUP_CONTROL
    code = active_code(root / relative)
    require_code_digest(
        source_code(root / relative),
        CLEANUP_CONTROL_SHA256,
        "cleanup-retry-control",
        relative,
        errors,
    )
    for label, pattern in (
        (
            "private fail-closed probe invocation",
            r"^\s*\$missingProbe = & \$hostModule \{$",
        ),
        (
            "native provider-error rejection",
            r"^\s*\} catch \[Management\.Automation\.DriveNotFoundException\] \{$",
        ),
        ("provider rejection oracle", r"^\s*\$providerErrorRejected = \$true$"),
        ("persistent bounded rejection", r"^\s*\$boundedFailure = \$true$"),
        (
            "exact exhausted-lock oracle",
            r'^\s*if \(\$_.Exception.Message -cne "CI cleanup target remained locked after bounded retries"\) \{$',
        ),
        ("actual transient lock process", r"^\s*\$holder = Start-Job -ScriptBlock \{$"),
        (
            "transient retry invocation",
            r"^\s*Remove-BodamOwnedTree -Root \$testRoot -Path \$transientTree$",
        ),
        (
            "foreign sibling preservation",
            r'^\s*if \(\[IO\.File\]::ReadAllText\(\$foreignSentinel\) -cne "synthetic foreign sentinel"\) \{$',
        ),
        (
            "cleanup retry PASS token",
            r'^Write-Output "BODAM Windows bounded cleanup retry controls: PASS"$',
        ),
    ):
        require_once(code, pattern, label, relative, errors)
    if len(re.findall(r"\[IO\.FileShare\]::None", code)) != 2:
        errors.append(f"{relative} must exercise persistent and transient native locks")


def check_windows_cleanup(root: Path, errors: list[str]) -> None:
    check_owned_tree_retry(root, errors)
    check_native_controls(root, errors)
