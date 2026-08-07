#!/usr/bin/env python3
"""Ordering controls for direct trust checks before hosted npm execution."""

from __future__ import annotations

import tempfile
from pathlib import Path


HOST_BLOCK = (
    "      - name: Run hosted cleanup safety negative controls\n"
    "        id: host_safety\n"
    "        shell: pwsh\n"
    "        run: pwsh -NoLogo -NoProfile -File e2e/test-windows-host-safety.ps1\n\n"
)
TRUST_BLOCK = (
    "      - name: Verify npm command trust before npm execution\n"
    "        id: npm_trust\n"
    "        run: python3 -I harness/scripts/windows_npm_preflight.py\n\n"
)
SETUP_NODE_BLOCK = (
    "      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4\n"
    "        with:\n"
    "          node-version: 24\n"
    "          cache: npm\n"
)
INSTALL_BLOCK = (
    "      - name: Install locked dependencies\n"
    "        id: dependencies\n"
    "        run: npm ci --ignore-scripts\n\n"
)


def run_workflow_order_negative_controls(fixture, run_check) -> list[str]:
    failures: list[str] = []
    for label, block in (("host safety", HOST_BLOCK), ("npm trust", TRUST_BLOCK)):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixture(root)
            path = root / ".github/workflows/tauri-e2e-windows.yml"
            text = path.read_text(encoding="utf-8")
            changed = text.replace(block, "", 1).replace(
                INSTALL_BLOCK, INSTALL_BLOCK + block, 1
            )
            if changed == text:
                failures.append(f"workflow order mutation source missing: {label}")
                continue
            path.write_text(changed, encoding="utf-8")
            errors = run_check(root)
            if not any("direct trust steps must precede every npm command" in e for e in errors):
                failures.append(f"workflow allowed {label} after npm execution")
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        fixture(root)
        path = root / ".github/workflows/tauri-e2e-windows.yml"
        text = path.read_text(encoding="utf-8")
        changed = text.replace(TRUST_BLOCK, "", 1).replace(
            SETUP_NODE_BLOCK, SETUP_NODE_BLOCK + "\n" + TRUST_BLOCK, 1
        )
        if changed == text:
            failures.append("setup-node order mutation source missing")
        else:
            path.write_text(changed, encoding="utf-8")
            errors = run_check(root)
            expected = "direct trust gates must follow checkout and precede setup-node cache"
            if not any(expected in error for error in errors):
                failures.append("workflow allowed npm trust after setup-node cache")
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        fixture(root)
        path = root / ".github/workflows/tauri-e2e-windows.yml"
        text = path.read_text(encoding="utf-8")
        changed = text.replace(
            "python3 -I harness/scripts/windows_npm_preflight.py",
            "python3 harness/scripts/windows_npm_preflight.py",
            1,
        )
        path.write_text(changed, encoding="utf-8")
        errors = run_check(root)
        if not any("exact step id npm_trust" in error for error in errors):
            failures.append("workflow allowed non-isolated npm trust execution")
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        fixture(root)
        path = root / ".github/workflows/tauri-e2e-windows.yml"
        text = path.read_text(encoding="utf-8")
        changed = text.replace(
            "if: always() && steps.npm_trust.outcome == 'success'", "if: always()", 1
        )
        path.write_text(changed, encoding="utf-8")
        errors = run_check(root)
        if not any("cleanup must run only after the direct trust gate succeeds" in e for e in errors):
            failures.append("workflow allowed npm cleanup after a failed trust gate")
    return failures
