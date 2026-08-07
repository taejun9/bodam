#!/usr/bin/env python3
"""Execution controls for the isolated pre-npm trust anchor."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


def execute_preflight(root: Path) -> subprocess.CompletedProcess[str]:
    script = root / "harness/scripts/windows_npm_preflight.py"
    return subprocess.run(
        [sys.executable, "-I", str(script)],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


def run_windows_npm_preflight_negative_controls(create_valid_fixture) -> list[str]:
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        result = execute_preflight(root)
        if result.returncode != 0 or "npm trust preflight: PASS" not in result.stdout:
            failures.append("valid isolated npm preflight fixture was rejected")

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        package_path = root / "package.json"
        package = json.loads(package_path.read_text(encoding="utf-8"))
        package["scripts"]["qa"] = 'node -e "process.exit(0)"'
        package_path.write_text(json.dumps(package, indent=2), encoding="utf-8")
        lock_path = root / "package-lock.json"
        lock_path.write_text(lock_path.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        marker = root / "checker-executed"
        checker_path = root / "harness/scripts/windows_node_spawn_checks.py"
        checker_path.write_text(
            checker_path.read_text(encoding="utf-8")
            + f"\nPath({str(marker)!r}).write_text('executed', encoding='utf-8')\n",
            encoding="utf-8",
        )
        result = execute_preflight(root)
        if result.returncode == 0 or "immutable npm trust checker changed" not in result.stdout:
            failures.append("combined checker/package/lock mutation passed npm preflight")
        if marker.exists():
            failures.append("mutated npm trust checker executed before identity rejection")

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        marker = root / "shadow-executed"
        shadow = root / "harness/scripts/json.py"
        shadow.write_text(
            f"open({str(marker)!r}, 'w', encoding='utf-8').write('executed')\n"
            "raise RuntimeError('local stdlib shadow executed')\n",
            encoding="utf-8",
        )
        result = execute_preflight(root)
        if result.returncode != 0:
            failures.append("isolated npm preflight loaded a local stdlib shadow")
        if marker.exists():
            failures.append("isolated npm preflight executed local json.py")
    return failures
