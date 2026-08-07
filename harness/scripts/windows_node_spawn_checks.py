#!/usr/bin/env python3
"""Fail-closed Node subprocess contracts for Windows E2E launchers."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


NODE_SPAWN_FILES = (
    "e2e/node-script-runner.mjs",
    "e2e/build-e2e-command.mjs",
    "e2e/build-e2e.mjs",
    "e2e/test-node-script-runner.mjs",
    "e2e/run-e2e.mjs",
    "e2e/run-backup-settings-e2e.mjs",
)
IMMUTABLE_DIGESTS = {
    "e2e/node-script-runner.mjs": "8fd0837377d20d82550889c0ec514cd7af6424bf5ce086ce95b59e0d81c725b7",
    "e2e/build-e2e-command.mjs": "f8f4447e46f8f2c207f9c3263322390e0467d41caac45487a5d712176df3592e",
    "e2e/build-e2e.mjs": "565483bbe7bdb5c91f7990376cfdfff74550b9ad182dbd2fc8900241e4b5f915",
    "e2e/test-node-script-runner.mjs": "857c9fa3d75a0ef56dd4609b0eeb263e55c4c129d03fdef8bb44e79d1a867e64",
    "e2e/run-e2e.mjs": "8f59dc0adb7723ec354a9e05b7ef88ab4f9f4235b91c1e8618bf2ee3aa1f186f",
    "e2e/run-backup-settings-e2e.mjs": "d792db73aecd39f1d117d669fa7503dd3ddba35c803a2c76a02819c0624f2ad5",
}
CONSUMERS = (
    "e2e/run-e2e.mjs",
    "e2e/run-backup-settings-e2e.mjs",
)
RUNNER_IMPORT = 'import { createNpmScriptRunner } from "./node-script-runner.mjs";'
RUNNER_CREATION = "const runScript = createNpmScriptRunner({ projectRoot });"
UNSAFE_CONSUMER_TOKENS = (
    "node:child_process",
    "spawnSync",
    "execSync",
    "execFile",
    "npmCommand",
    "npm.cmd",
    "npm.bat",
    "cmd.exe",
    "ComSpec",
    "shell:",
    "function runScript(",
)
EXPECTED_QA_TOKENS = (
    "run-s",
    "test:e2e:node-spawn",
    "lint",
    "typecheck",
    "test:unit",
    "prisma:validate",
    "database:contract",
    "test:db",
    "build",
    "tauri:check",
    "harness:check",
)


def read_text(root: Path, relative: str, errors: list[str]) -> str:
    try:
        return (root / relative).read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        errors.append(f"missing or invalid Windows Node spawn file: {relative}")
        return ""


def check_immutable_files(root: Path, errors: list[str]) -> None:
    for relative, expected in IMMUTABLE_DIGESTS.items():
        text = read_text(root, relative, errors)
        if hashlib.sha256(text.encode("utf-8")).hexdigest() != expected:
            errors.append(f"immutable Node spawn contract changed: {relative}")


def check_consumers(root: Path, errors: list[str]) -> None:
    for relative in CONSUMERS:
        text = read_text(root, relative, errors)
        lines = text.splitlines()
        if lines.count(RUNNER_IMPORT) != 1 or lines.count(RUNNER_CREATION) != 1:
            errors.append(f"Windows Node spawn consumer contract is incomplete: {relative}")
        if "/*" in text or "*/" in text or any(line.count("`") % 2 for line in lines):
            errors.append(f"Windows Node spawn consumer contract has ambiguous code: {relative}")
        for token in UNSAFE_CONSUMER_TOKENS:
            if token in text:
                errors.append(
                    f"unsafe Windows Node launch token in {relative}: {token}"
                )


def check_package(root: Path, errors: list[str]) -> None:
    relative = "package.json"
    try:
        package = json.loads((root / relative).read_text(encoding="utf-8"))
        scripts = package["scripts"]
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError):
        errors.append("package.json is unavailable for Windows Node spawn checks")
        return
    expected = "node e2e/test-node-script-runner.mjs"
    if scripts.get("test:e2e:node-spawn") != expected:
        errors.append("package.json test:e2e:node-spawn must run the exact actual control")
    qa = scripts.get("qa")
    tokens = qa.split() if isinstance(qa, str) else []
    if tuple(tokens) != EXPECTED_QA_TOKENS:
        errors.append("package.json qa must run the Node spawn control fail-closed first")


def check_windows_node_spawn(root: Path, errors: list[str]) -> None:
    check_immutable_files(root, errors)
    check_consumers(root, errors)
    check_package(root, errors)
