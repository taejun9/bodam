#!/usr/bin/env python3
"""Negative controls for Windows release evidence contracts."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import windows_release_checks
from test_windows_node_spawn_contract import run_windows_node_spawn_negative_controls
from test_windows_npm_preflight_contract import run_windows_npm_preflight_negative_controls
from test_windows_nsis_rendered_contract import run_windows_nsis_rendered_negative_controls
from test_windows_cleanup_contract import run_windows_cleanup_negative_controls
from test_windows_launch_contract import run_windows_launch_negative_controls
from test_windows_launch_lexer_contract import run_windows_launch_lexer_negative_controls
from test_windows_workflow_contract import run_windows_workflow_negative_controls
from windows_release_document_checks import REQUIREMENTS as DOCUMENT_REQUIREMENTS
from windows_installer_config_checks import WINDOWS_PLATFORM_CONFIGS
from windows_release_launch_syntax import strip_comments


SOURCE_ROOT = Path(__file__).resolve().parents[2]


def expect_error(errors: list[str], phrase: str, failures: list[str]) -> None:
    if not any(phrase in error for error in errors):
        failures.append(f"Windows release negative control did not detect: {phrase}")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, value: dict) -> None:
    write(path, json.dumps(value, ensure_ascii=False, indent=2))


def create_valid_fixture(root: Path) -> None:
    relatives = {
        windows_release_checks.PRODUCTION_CONFIG,
        windows_release_checks.E2E_CONFIG,
        windows_release_checks.WORKFLOW,
        "package.json",
        "package-lock.json",
        *windows_release_checks.REQUIRED_RELEASE_FILES,
        *DOCUMENT_REQUIREMENTS,
    }
    for relative in sorted(relatives):
        write(root / relative, (SOURCE_ROOT / relative).read_text(encoding="utf-8"))
    for path in sorted((SOURCE_ROOT / "e2e").rglob("*.mjs")):
        relative = path.relative_to(SOURCE_ROOT)
        write(root / relative, path.read_text(encoding="utf-8"))
    write(root / "wdio.conf.mjs", (SOURCE_ROOT / "wdio.conf.mjs").read_text(encoding="utf-8"))


def run_check(root: Path) -> list[str]:
    original_root = windows_release_checks.ROOT
    try:
        windows_release_checks.ROOT = root
        return windows_release_checks.run_windows_release_checks()
    finally:
        windows_release_checks.ROOT = original_root


def test_valid_contract(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        errors = run_check(root)
        if errors:
            failures.append(f"valid Windows release fixture was rejected: {errors}")


def test_installer_modes(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        production = json.loads(
            (root / windows_release_checks.PRODUCTION_CONFIG).read_text(encoding="utf-8")
        )
        production["bundle"]["windows"]["nsis"]["installMode"] = "perMachine"
        write_json(root / windows_release_checks.PRODUCTION_CONFIG, production)
        errors = run_check(root)
        expect_error(errors, "currentUser", failures)

        create_valid_fixture(root)
        e2e = json.loads(
            (root / windows_release_checks.E2E_CONFIG).read_text(encoding="utf-8")
        )
        e2e["bundle"]["windows"]["webviewInstallMode"]["type"] = "offlineInstaller"
        write_json(root / windows_release_checks.E2E_CONFIG, e2e)
        errors = run_check(root)
        expect_error(errors, "must set bundle.windows.webviewInstallMode.type to 'skip'", failures)

        create_valid_fixture(root)
        production = json.loads(
            (root / windows_release_checks.PRODUCTION_CONFIG).read_text(encoding="utf-8")
        )
        production["bundle"]["windows"]["nsis"]["template"] = "custom.nsi"
        write_json(root / windows_release_checks.PRODUCTION_CONFIG, production)
        expect_error(run_check(root), "bundle.windows.nsis keys", failures)

        create_valid_fixture(root)
        production = json.loads(
            (root / windows_release_checks.PRODUCTION_CONFIG).read_text(encoding="utf-8")
        )
        production["bundle"]["fileAssociations"] = [{"ext": ["safe"]}]
        write_json(root / windows_release_checks.PRODUCTION_CONFIG, production)
        expect_error(run_check(root), "immutable Tauri config changed", failures)

        create_valid_fixture(root)
        e2e = json.loads(
            (root / windows_release_checks.E2E_CONFIG).read_text(encoding="utf-8")
        )
        e2e["bundle"]["windows"]["nsis"]["installerHooks"] = "hooks.nsh"
        write_json(root / windows_release_checks.E2E_CONFIG, e2e)
        expect_error(run_check(root), "bundle.windows.nsis keys", failures)

        for platform_config in WINDOWS_PLATFORM_CONFIGS:
            create_valid_fixture(root)
            write_json(
                root / platform_config,
                {"bundle": {"windows": {"nsis": {"template": "custom.nsi"}}}},
            )
            expect_error(
                run_check(root), "platform-specific Tauri config must be absent", failures
            )

        create_valid_fixture(root)
        package_path = root / "package.json"
        package = json.loads(package_path.read_text(encoding="utf-8"))
        package["scripts"]["windows:build:production"] += (
            " --config src-tauri/release-override.json"
        )
        write_json(package_path, package)
        expect_error(run_check(root), "must equal its exact approved command", failures)


def test_config_line_endings(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        for relative in (
            windows_release_checks.PRODUCTION_CONFIG,
            windows_release_checks.E2E_CONFIG,
        ):
            path = root / relative
            text = path.read_text(encoding="utf-8")
            path.write_bytes(text.replace("\n", "\r\n").encode("utf-8"))
        errors = run_check(root)
        if errors:
            failures.append(f"valid CRLF Tauri configs were rejected: {errors}")


def test_artifact_allowlist(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        workflow = root / windows_release_checks.WORKFLOW
        text = workflow.read_text(encoding="utf-8").replace(
            "            runtime-data/windows-release/evidence.json",
            "            runtime-data/windows-release/evidence.json\n"
            "            runtime-data/windows-release/BODAM-E2E-setup.exe",
        )
        write(workflow, text)
        errors = run_check(root)
        expect_error(errors, "upload paths must equal production allowlist", failures)

        create_valid_fixture(root)
        workflow = root / windows_release_checks.WORKFLOW
        write(workflow, workflow.read_text(encoding="utf-8").replace(
            "if: success() && github.event_name != 'pull_request'", "if: success()"
        ))
        errors = run_check(root)
        expect_error(errors, "must not upload release artifacts from pull requests", failures)

        create_valid_fixture(root)
        workflow = root / windows_release_checks.WORKFLOW
        write(workflow, workflow.read_text(encoding="utf-8").replace(
            "include-hidden-files: false", "include-hidden-files: true"
        ))
        errors = run_check(root)
        expect_error(errors, "must set include-hidden-files: false exactly once", failures)

        create_valid_fixture(root)
        workflow = root / windows_release_checks.WORKFLOW
        write(workflow, workflow.read_text(encoding="utf-8").replace(
            "runtime-data/windows-release", ".runtime/windows-release"
        ))
        errors = run_check(root)
        expect_error(errors, "must not contain dot-prefixed components", failures)


def test_offline_claim(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        assertion = root / "e2e/assert-windows-production.ps1"
        text = assertion.read_text(encoding="utf-8").replace(
            "offlineVmAccepted = $false", "offlineVmAccepted = $true"
        )
        write(assertion, text)
        errors = run_check(root)
        expect_error(errors, "must record offlineVmAccepted as false", failures)


def test_document_outcome_claims(failures: list[str]) -> None:
    evidence = "docs/quality/windows-e2e-evidence.md"
    release = "docs/quality/windows-release-acceptance.md"
    sha = "exact commit `37a5031ce2e107cd36628e54b18c63f6ea417022`"
    cases = (
        (evidence, sha, "exact commit `0000000000000000000000000000000000000000`"),
        (release, sha, "exact commit `0000000000000000000000000000000000000000`"),
        (evidence, "hosted run result is `PASS`", "hosted run result is `FAIL`"),
        (release, "hosted run result is `PASS`", "hosted run result is `FAIL`"),
        (evidence, "installed full E2E result is `PASS`", "installed full E2E result is `FAIL`"),
        (release, "installed full E2E result is `PASS`", "installed full E2E result is `FAIL`"),
        (evidence, "Artifact upload and downloaded-artifact acceptance are `PASS`", "Artifact upload and downloaded-artifact acceptance are `NOT RUN`"),
        (release, "Artifact upload and downloaded-artifact acceptance are `PASS`", "Artifact upload and downloaded-artifact acceptance are `NOT RUN`"),
    )
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        for relative, approved, reversed_claim in cases:
            create_valid_fixture(root)
            path = root / relative
            text = path.read_text(encoding="utf-8")
            if approved not in text:
                failures.append(f"missing approved document control fixture: {approved}")
                continue
            write(path, text.replace(approved, reversed_claim, 1))
            expect_error(
                run_check(root),
                f"{relative} missing Windows evidence boundary: {approved}",
                failures,
            )


def test_comment_parser(failures: list[str]) -> None:
    quoted = '$left = "<#"\n$active = $true\n$right = "#>"\n'
    if strip_comments(quoted) != quoted:
        failures.append("PowerShell comment parser consumed quoted block-comment delimiters")
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_valid_fixture(root)
        path = root / "e2e/test-windows-host-safety.ps1"
        write(path, path.read_text(encoding="utf-8") + "\n<#")
        expect_error(
            run_check(root), "invalid PowerShell comment or string", failures
        )


def run_windows_release_negative_controls() -> list[str]:
    failures: list[str] = []
    test_valid_contract(failures)
    test_installer_modes(failures)
    test_config_line_endings(failures)
    test_artifact_allowlist(failures)
    test_offline_claim(failures)
    test_document_outcome_claims(failures)
    test_comment_parser(failures)
    failures.extend(run_windows_workflow_negative_controls(create_valid_fixture, run_check))
    failures.extend(run_windows_npm_preflight_negative_controls(create_valid_fixture))
    failures.extend(run_windows_node_spawn_negative_controls(create_valid_fixture, run_check))
    failures.extend(run_windows_nsis_rendered_negative_controls(create_valid_fixture, run_check))
    failures.extend(run_windows_cleanup_negative_controls(create_valid_fixture, run_check))
    failures.extend(run_windows_launch_negative_controls(create_valid_fixture, run_check))
    failures.extend(run_windows_launch_lexer_negative_controls(create_valid_fixture, run_check))
    return failures


def main() -> int:
    failures = run_windows_release_negative_controls()
    if failures:
        print("BODAM Windows release contract controls: FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("BODAM Windows release contract controls: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
