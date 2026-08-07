#!/usr/bin/env python3
"""Negative controls for Windows release evidence contracts."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import windows_release_checks
from test_windows_workflow_contract import run_windows_workflow_negative_controls


def expect_error(errors: list[str], phrase: str, failures: list[str]) -> None:
    if not any(phrase in error for error in errors):
        failures.append(f"Windows release negative control did not detect: {phrase}")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, value: dict) -> None:
    write(path, json.dumps(value, ensure_ascii=False, indent=2))


def create_valid_fixture(root: Path) -> None:
    for relative in windows_release_checks.REQUIRED_RELEASE_FILES:
        write(root / relative, "# synthetic Windows release contract\n")
    for relative, markers in windows_release_checks.HOST_SAFETY_MARKERS.items():
        write(root / relative, "\n".join(markers))
    write_json(
        root / "src-tauri/tauri.conf.json",
        {
            "productName": "BODAM",
            "identifier": "app.bodam.desktop",
            "bundle": {
                "windows": {
                    "nsis": {"installMode": "currentUser"},
                    "webviewInstallMode": {"type": "offlineInstaller"},
                }
            },
        },
    )
    write_json(
        root / "src-tauri/tauri.e2e.conf.json",
        {
            "productName": "BODAM E2E",
            "identifier": "app.bodam.desktop.e2e",
            "bundle": {
                "windows": {
                    "nsis": {"installMode": "currentUser"},
                    "webviewInstallMode": {"type": "skip"},
                }
            },
        },
    )
    write_json(
        root / "package.json",
        {
            "scripts": {
                "windows:build:production": (
                    "tauri build --ci --no-sign --bundles nsis"
                ),
                "windows:assert:production": (
                    "pwsh -File e2e/assert-windows-production.ps1"
                ),
                "e2e:build:windows-nsis": "node e2e/build-e2e.mjs windows-nsis",
                "test:e2e:windows-installed": (
                    "pwsh -File e2e/run-windows-installed-e2e.ps1"
                ),
                "windows:cleanup": "pwsh -File e2e/cleanup-windows-installs.ps1",
            }
        },
    )
    write(
        root / windows_release_checks.WORKFLOW,
        """name: Windows release
on: workflow_dispatch
permissions:
  contents: read
jobs:
  release:
    runs-on: windows-2025
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
      - uses: dtolnay/rust-toolchain@4360b52568e2003a75bf9bc1d59f33a8e3fc893c # stable
      - uses: Swatinem/rust-cache@49a0bdc70d2e1b713ca9e2869b211fcce03d3c1c # v2
      - name: Install
        run: npm ci
      - name: QA
        id: cross_layer_qa
        run: npm run qa
      - name: Safety
        id: host_safety
        run: pwsh -File e2e/test-windows-host-safety.ps1
      - name: Windows tests
        id: windows_tests
        run: cargo test --manifest-path src-tauri/Cargo.toml --all-features
      - name: Production build
        id: production_build
        run: npm run windows:build:production
      - name: Production lifecycle
        id: production_lifecycle
        run: npm run windows:assert:production
      - name: E2E build
        id: e2e_build
        run: npm run e2e:build:windows-nsis
      - name: Installed E2E
        id: installed_e2e
        run: npm run test:e2e:windows-installed
      - name: Cleanup
        id: cleanup
        if: always()
        run: npm run windows:cleanup
      - name: Summary
        if: always()
        run: |
          '- jobStatus: ${{ job.status }}'
          '- crossLayerQa: ${{ steps.cross_layer_qa.outcome }}'
          '- hostSafety: ${{ steps.host_safety.outcome }}'
          '- windowsTests: ${{ steps.windows_tests.outcome }}'
          '- productionBuild: ${{ steps.production_build.outcome }}'
          '- productionLifecycle: ${{ steps.production_lifecycle.outcome }}'
          '- e2eBuild: ${{ steps.e2e_build.outcome }}'
          '- installedE2e: ${{ steps.installed_e2e.outcome }}'
          '- cleanup: ${{ steps.cleanup.outcome }}'
          '- installed application scope: full synthetic E2E'
          'offlineVmAccepted: false' >> $env:GITHUB_STEP_SUMMARY
      - name: Upload
        if: success() && github.event_name != 'pull_request'
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: bodam-windows-x64-unsigned
          path: |
            runtime-data/windows-release/BODAM_0.1.0_x64-setup.exe
            runtime-data/windows-release/BODAM_0.1.0_x64-setup.exe.sha256
            runtime-data/windows-release/evidence.json
          include-hidden-files: false
          if-no-files-found: error
""",
    )
    evidence = "\n".join(windows_release_checks.REQUIRED_EVIDENCE_KEYS)
    write(
        root / "e2e/assert-windows-production.ps1",
        f"""{evidence}
offlineInstaller
currentUser
NotSigned
productionMarkerMatches = 0
offlineVmAccepted = $false
""",
    )
    write(
        root / "docs/product/open-questions.md",
        "WebView2 `offlineInstaller`\nremovable·network filesystem\n",
    )
    write(
        root / "docs/quality/windows-e2e-evidence.md",
        "NOT RUN - environment unavailable\n"
        "bodam-windows-x64-unsigned\nNotSigned\nlocal NTFS\n"
        "sharedWebViewPreserved\nnested reparse point\nexternal sentinel\n",
    )
    write(
        root / "docs/quality/windows-release-acceptance.md",
        "offlineVmAccepted: false\nUNC, network and removable\n"
        "production installer, its `.sha256` and `evidence.json`\n"
        "sharedWebViewPreserved\nnested reparse point\n",
    )
    write(
        root / "docs/privacy/principles.md",
        "Hosted artifact\nshared WebView2 runtime\nlocal fixed NTFS\n"
        "WebView2 `pv`\nnested reparse point\nexternal sentinel\n",
    )
    write(
        root / "docs/references/official-sources.md",
        "full-length commit SHA\npv (REG_SZ)\nFlushFileBuffers\n"
        "parent-directory metadata durability\n",
    )


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


def run_windows_release_negative_controls() -> list[str]:
    failures: list[str] = []
    test_valid_contract(failures)
    test_installer_modes(failures)
    test_artifact_allowlist(failures)
    test_offline_claim(failures)
    failures.extend(run_windows_workflow_negative_controls(create_valid_fixture, run_check))
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
