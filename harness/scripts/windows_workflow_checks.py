#!/usr/bin/env python3
"""Immutable Windows workflow, summary, and artifact contracts."""

from __future__ import annotations

import re
from pathlib import Path


WORKFLOW = ".github/workflows/tauri-e2e-windows.yml"
PRODUCTION_INSTALLER = "runtime-data/windows-release/BODAM_0.1.0_x64-setup.exe"
UPLOAD_ALLOWLIST = (
    PRODUCTION_INSTALLER,
    f"{PRODUCTION_INSTALLER}.sha256",
    "runtime-data/windows-release/evidence.json",
)
ACTION_PINS = {
    "actions/checkout": ("11d5960a326750d5838078e36cf38b85af677262", "v4"),
    "actions/setup-node": ("49933ea5288caeca8642d1e84afbd3f7d6820020", "v4"),
    "dtolnay/rust-toolchain": ("4360b52568e2003a75bf9bc1d59f33a8e3fc893c", "stable"),
    "Swatinem/rust-cache": ("49a0bdc70d2e1b713ca9e2869b211fcce03d3c1c", "v2"),
    "actions/upload-artifact": ("ea165f8d65b6e75b540449e92b4886f43607fa02", "v4"),
}
STEP_IDS = {
    "npm run qa": "cross_layer_qa",
    "e2e/test-windows-host-safety.ps1": "host_safety",
    "cargo test --manifest-path src-tauri/Cargo.toml --all-features": "windows_tests",
    "npm run windows:build:production": "production_build",
    "npm run windows:assert:production": "production_lifecycle",
    "npm run e2e:build:windows-nsis": "e2e_build",
    "npm run test:e2e:windows-installed": "installed_e2e",
    "npm run windows:cleanup": "cleanup",
}
SUMMARY_OUTCOMES = {
    "jobStatus": "${{ job.status }}",
    "crossLayerQa": "${{ steps.cross_layer_qa.outcome }}",
    "hostSafety": "${{ steps.host_safety.outcome }}",
    "windowsTests": "${{ steps.windows_tests.outcome }}",
    "productionBuild": "${{ steps.production_build.outcome }}",
    "productionLifecycle": "${{ steps.production_lifecycle.outcome }}",
    "e2eBuild": "${{ steps.e2e_build.outcome }}",
    "installedE2e": "${{ steps.installed_e2e.outcome }}",
    "cleanup": "${{ steps.cleanup.outcome }}",
}


def action_uses(text: str) -> list[tuple[str, str, str]]:
    return re.findall(
        r"(?m)^\s*(?:-\s+)?uses:\s*([^@\s]+)@([^\s#]+)(?:\s+#\s*(\S+))?\s*$",
        text,
    )


def step_blocks(text: str) -> list[str]:
    lines = text.splitlines()
    blocks: list[str] = []
    for index, line in enumerate(lines):
        if not re.match(r"^\s*-\s+name:\s+", line):
            continue
        indentation = len(line) - len(line.lstrip())
        collected = [line]
        for candidate in lines[index + 1 :]:
            stripped = candidate.lstrip()
            candidate_indent = len(candidate) - len(stripped)
            if stripped.startswith("-") and candidate_indent <= indentation:
                break
            collected.append(candidate)
        blocks.append("\n".join(collected))
    return blocks


def upload_blocks(text: str) -> list[str]:
    return [block for block in step_blocks(text) if "actions/upload-artifact@" in block]


def block_paths(block: str) -> tuple[str, ...]:
    paths: list[str] = []
    collecting = False
    path_indent = 0
    for line in block.splitlines():
        stripped = line.strip()
        indentation = len(line) - len(line.lstrip())
        if stripped == "path: |":
            collecting = True
            path_indent = indentation
            continue
        if collecting:
            if stripped and indentation <= path_indent:
                break
            if stripped and not stripped.startswith("#"):
                paths.append(stripped)
    return tuple(paths)


def check_action_pins(text: str, errors: list[str]) -> None:
    actual = action_uses(text)
    if len(actual) != len(ACTION_PINS):
        errors.append(f"{WORKFLOW} must contain exactly the approved immutable action uses")
    for action, reference, comment in actual:
        expected = ACTION_PINS.get(action)
        if expected != (reference, comment) or not re.fullmatch(r"[0-9a-f]{40}", reference):
            errors.append(
                f"{WORKFLOW} action {action} must use its approved immutable full-length SHA and tag comment"
            )
    missing = sorted(set(ACTION_PINS) - {action for action, _, _ in actual})
    if missing:
        errors.append(f"{WORKFLOW} missing approved action pins: {missing}")


def check_steps_and_summary(text: str, errors: list[str]) -> None:
    blocks = step_blocks(text)
    for command, expected_id in STEP_IDS.items():
        matches = [block for block in blocks if command in block]
        if len(matches) != 1 or f"id: {expected_id}" not in matches[0]:
            errors.append(f"{WORKFLOW} must give {command} the exact step id {expected_id}")
    summaries = [block for block in blocks if "GITHUB_STEP_SUMMARY" in block]
    if len(summaries) != 1 or "if: always()" not in summaries[0]:
        errors.append(f"{WORKFLOW} must contain one always-running hosted evidence summary")
        return
    summary = summaries[0]
    for label, expression in SUMMARY_OUTCOMES.items():
        if f"- {label}: {expression}" not in summary:
            errors.append(f"{WORKFLOW} summary must report {label} from {expression}")
    if "installed application scope: full synthetic E2E" not in summary:
        errors.append(f"{WORKFLOW} must label full synthetic E2E as scope, not unconditional completion")


def check_upload(text: str, errors: list[str]) -> None:
    if "if: success() && github.event_name != 'pull_request'" not in text:
        errors.append(f"{WORKFLOW} must not upload release artifacts from pull requests")
    blocks = upload_blocks(text)
    if len(blocks) != 1:
        errors.append(f"{WORKFLOW} must contain exactly one artifact upload, found {len(blocks)}")
        return
    block = blocks[0]
    if "name: bodam-windows-x64-unsigned" not in block:
        errors.append(f"{WORKFLOW} must use unsigned production artifact name")
    paths = block_paths(block)
    if paths != UPLOAD_ALLOWLIST:
        errors.append(f"{WORKFLOW} upload paths must equal production allowlist, found {paths}")
    hidden = tuple(path for path in paths if any(part.startswith(".") for part in Path(path).parts))
    if hidden:
        errors.append(f"{WORKFLOW} upload paths must not contain dot-prefixed components: {hidden}")
    settings = re.findall(r"(?m)^\s*include-hidden-files:\s*(\S+)", block)
    if settings != ["false"]:
        errors.append(f"{WORKFLOW} artifact upload must set include-hidden-files: false exactly once")
    if "if-no-files-found: error" not in block:
        errors.append(f"{WORKFLOW} artifact upload must fail when evidence is missing")


def check_windows_workflow(root: Path, errors: list[str]) -> None:
    path = root / WORKFLOW
    if not path.is_file():
        errors.append(f"missing Windows release workflow: {WORKFLOW}")
        return
    text = path.read_text(encoding="utf-8")
    for phrase in ("runs-on: windows-2025", "contents: read", "offlineVmAccepted: false"):
        if phrase not in text:
            errors.append(f"{WORKFLOW} missing release contract: {phrase}")
    check_action_pins(text, errors)
    check_steps_and_summary(text, errors)
    check_upload(text, errors)
