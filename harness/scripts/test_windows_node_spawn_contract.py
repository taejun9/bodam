#!/usr/bin/env python3
"""Mutation controls for the Windows Node subprocess boundary."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path


def expect_mutation(
    create_fixture,
    run_check,
    relative: str,
    old: str,
    new: str,
    phrase: str,
    failures: list[str],
) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        path = root / relative
        text = path.read_text(encoding="utf-8")
        changed = text.replace(old, new, 1)
        if changed == text:
            failures.append(f"Node spawn mutation source missing: {relative}")
            return
        path.write_text(changed, encoding="utf-8")
        errors = run_check(root)
        if not any(phrase in error for error in errors):
            failures.append(f"Node spawn mutation was accepted: {relative} / {phrase}")


def package_mutation(
    create_fixture,
    run_check,
    key: str,
    mutate,
    phrase: str,
    failures: list[str],
) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        path = root / "package.json"
        package = json.loads(path.read_text(encoding="utf-8"))
        package["scripts"][key] = mutate(package["scripts"][key])
        path.write_text(json.dumps(package, indent=2), encoding="utf-8")
        if not any(phrase in error for error in run_check(root)):
            failures.append(f"Node spawn package mutation was accepted: {key}")


def empty_file_mutation(create_fixture, run_check, relative: str, failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        (root / relative).write_text("", encoding="utf-8")
        errors = run_check(root)
        if not any("immutable Node spawn contract changed" in error for error in errors):
            failures.append(f"empty Node spawn control was accepted: {relative}")


def npmrc_mutation(create_fixture, run_check, failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        (root / ".npmrc").write_text("script-shell=C:\\synthetic\\fake.cmd\n", encoding="utf-8")
        errors = run_check(root)
        if not any("project .npmrc must be absent" in error for error in errors):
            failures.append("project script-shell .npmrc was accepted")


def dependency_mutations(create_fixture, run_check, failures: list[str]) -> None:
    cases = (
        ("package.json", '"@wdio/cli": "9.30.1"', '"@wdio/cli": "file:./synthetic-wdio"'),
        ("package-lock.json", '"@tauri-apps/cli": "2.11.4"',
         '"@tauri-apps/cli": "file:./synthetic-tauri"'),
    )
    for relative, old, new in cases:
        expect_mutation(
            create_fixture, run_check, relative, old, new,
            "immutable Windows npm source changed", failures,
        )
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        (root / "npm-shrinkwrap.json").write_text("{}\n", encoding="utf-8")
        errors = run_check(root)
        if not any("project npm-shrinkwrap.json must be absent" in error for error in errors):
            failures.append("npm shrinkwrap precedence override was accepted")


def run_windows_node_spawn_negative_controls(create_fixture, run_check) -> list[str]:
    failures: list[str] = []
    cases = (
        (
            "scripts/package/assert-platform.mjs",
            'windows: { actual: "win32", label: "Windows" }',
            'windows: { actual: "darwin", label: "Windows" }',
            "immutable Node spawn contract changed",
        ),
        (
            "scripts/package/inspect-windows-installer.mjs",
            '!== "offlineInstaller"',
            '!== "skip"',
            "immutable Node spawn contract changed",
        ),
        (
            "e2e/node-script-runner.mjs",
            "shell: false",
            "shell: true",
            "immutable Node spawn contract changed",
        ),
        (
            "e2e/build-e2e-command.mjs",
            '"cli", "tauri.js"',
            '".bin", "tauri.cmd"',
            "immutable Node spawn contract changed",
        ),
        (
            "e2e/build-e2e.mjs",
            "const status = runNodeScript(invocation);",
            "const status = 0;",
            "immutable Node spawn contract changed",
        ),
        (
            "e2e/test-node-script-runner.mjs",
            "subprocess controls: PASS",
            "subprocess controls: SKIPPED",
            "immutable Node spawn contract changed",
        ),
        (
            "e2e/run-e2e.mjs",
            'import { createNpmScriptRunner } from "./node-script-runner.mjs";',
            '/*\nimport { createNpmScriptRunner } from "./node-script-runner.mjs";\n*/',
            "consumer contract",
        ),
        (
            "e2e/run-backup-settings-e2e.mjs",
            "const runScript = createNpmScriptRunner({ projectRoot });",
            'const npmCommand = "npm.cmd";',
            "unsafe Windows Node launch token",
        ),
        (
            "e2e/run-e2e.mjs",
            "const runScript = createNpmScriptRunner({ projectRoot });",
            "const runScript = createNpmScriptRunner({ projectRoot });\n"
            'const hidden = await import(["node:child", "_process"].join(""));\n'
            'hidden[["spawn", "Sync"].join("")](["npm", ".c", "md"].join(""), [], '
            '{ [["shell"].join("")]: true });',
            "immutable Node spawn contract changed",
        ),
        (
            "e2e/e2e-app-binary.mjs",
            "return actual;",
            "return expected;",
            "immutable Windows E2E trust tree changed",
        ),
        (
            "e2e/backup-settings-runner.mjs",
            "await assertIndependentBackupArchive({",
            "if (false) await assertIndependentBackupArchive({",
            "immutable Windows E2E trust tree changed",
        ),
        (
            "docs/quality/windows-e2e-evidence.md",
            "`process.execPath`",
            "`process.argv0`",
            "missing Windows evidence boundary",
        ),
        (
            "docs/quality/windows-release-acceptance.md",
            "Tauri `tauri.js`",
            "Tauri shim",
            "missing Windows evidence boundary",
        ),
        (
            "docs/references/official-sources.md",
            "https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2",
            "https://example.invalid/node-security",
            "missing Windows evidence boundary",
        ),
    )
    for case in cases:
        expect_mutation(create_fixture, run_check, *case, failures)
    empty_file_mutation(
        create_fixture,
        run_check,
        "e2e/test-node-script-runner.mjs",
        failures,
    )
    npmrc_mutation(create_fixture, run_check, failures)
    dependency_mutations(create_fixture, run_check, failures)
    package_mutation(
        create_fixture,
        run_check,
        "test:e2e:node-spawn",
        lambda _: "node e2e/other.mjs",
        "test:e2e:node-spawn",
        failures,
    )
    package_mutation(
        create_fixture,
        run_check,
        "test:e2e",
        lambda _: 'node -e "process.exit(0)"',
        "test:e2e must run",
        failures,
    )
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_fixture(root)
        path = root / "package.json"
        package = json.loads(path.read_text(encoding="utf-8"))
        package["scripts"]["postqa"] = "node -e \"process.exit(0)\""
        path.write_text(json.dumps(package, indent=2), encoding="utf-8")
        if not any("immutable E2E command graph" in error for error in run_check(root)):
            failures.append("npm lifecycle script addition was accepted")
    package_mutation(
        create_fixture,
        run_check,
        "qa",
        lambda value: value.replace("test:e2e:node-spawn ", "", 1),
        "qa must run",
        failures,
    )
    package_mutation(
        create_fixture,
        run_check,
        "qa",
        lambda value: f"{value} --npm-path true",
        "qa must run",
        failures,
    )
    return failures
