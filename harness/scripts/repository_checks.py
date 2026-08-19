#!/usr/bin/env python3
"""Repository structure, size, and sensitive-artifact checks."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RESIDENT_ID = re.compile(r"(?<!\d)\d{6}-[1-4]\d{6}(?!\d)")
SQLITE_ARTIFACT = re.compile(
    r"\.(?:db|sqlite|sqlite3)(?:-(?:journal|wal|shm))?$",
    re.IGNORECASE,
)

REQUIRED_FILES = (
    ".gitattributes",
    "README.md",
    "AGENTS.md",
    "docs/product/product.md",
    "docs/product/requirements.md",
    "docs/product/open-questions.md",
    "docs/architecture/harness.md",
    "docs/architecture/system-overview.md",
    "docs/architecture/data-model.md",
    "docs/architecture/import-export.md",
    "docs/architecture/calendar-notification.md",
    "docs/architecture/backup-restore.md",
    "docs/architecture/decisions/adr-001-prisma-tauri-runtime.md",
    "docs/quality/rules.md",
    "docs/quality/test-strategy.md",
    "docs/quality/review-checklist.md",
    "docs/quality/windows-e2e-evidence.md",
    "docs/quality/windows-release-acceptance.md",
    "docs/privacy/principles.md",
    "docs/references/official-sources.md",
    "docs/references/input-artifacts.md",
    "harness/scripts/base_checks.py",
    "harness/scripts/database_contract_checks.py",
    "harness/scripts/package_installer_checks.py",
    "harness/scripts/repository_checks.py",
    "harness/scripts/run_qa.py",
    "harness/scripts/run_review.py",
    "harness/scripts/test_harness.py",
    "harness/scripts/test_database_contract.py",
    "harness/scripts/test_package_installer_contract.py",
    "harness/scripts/windows_release_checks.py",
    "harness/scripts/windows_release_document_checks.py",
    "harness/scripts/windows_release_launch_evidence_checks.py",
    "harness/scripts/windows_release_launch_checks.py",
    "harness/scripts/windows_release_launch_syntax.py",
    "harness/scripts/test_windows_release_contract.py",
    "harness/scripts/windows_cleanup_checks.py",
    "harness/scripts/test_windows_cleanup_contract.py",
    "harness/scripts/test_windows_launch_contract.py",
    "harness/scripts/test_windows_launch_lexer_contract.py",
    "harness/scripts/windows_node_spawn_checks.py",
    "harness/scripts/test_windows_node_spawn_contract.py",
    "harness/scripts/windows_workflow_checks.py",
    "harness/scripts/test_windows_workflow_contract.py",
    "harness/templates/exec-plan.md",
    "harness/templates/review.md",
    "harness/templates/meeting.md",
    "scripts/package/assert-platform.mjs",
    "scripts/package/build-macos-installer.mjs",
    "scripts/package/inspect-macos-installer.mjs",
    "scripts/package/inspect-windows-installer.mjs",
    "src-tauri/tauri.macos.conf.json",
)
REQUIRED_DIRS = (
    "docs/exec_plans/active",
    "docs/exec_plans/completed",
    "docs/reviews",
    "docs/meetings",
    "harness/scripts",
)
SKIP_PARTS = {".git", ".worktree", "node_modules", "target", "dist"}
SKIP_PATH_PREFIXES = (("src-tauri", "gen"),)
LINE_LIMIT_EXEMPT_SUFFIXES = {".lock"}
LINE_LIMIT_EXEMPT_NAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
}
SOURCE_SUFFIXES = {
    ".md",
    ".py",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".vue",
    ".rs",
    ".prisma",
    ".sql",
    ".json",
    ".jsonc",
    ".toml",
    ".yaml",
    ".yml",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".sh",
    ".ps1",
    ".psm1",
}
TABULAR_SUFFIXES = {".xlsx", ".xls", ".xlsm", ".xlsb", ".ods", ".csv", ".tsv"}
BACKUP_ARTIFACT_SUFFIX = ".bodam-backup"


def source_files() -> list[Path]:
    return [
        path
        for path in ROOT.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SOURCE_SUFFIXES
        and not SKIP_PARTS.intersection(path.relative_to(ROOT).parts)
        and not any(
            path.relative_to(ROOT).parts[: len(prefix)] == prefix
            for prefix in SKIP_PATH_PREFIXES
        )
    ]


def check_required(errors: list[str]) -> None:
    for relative in REQUIRED_FILES:
        if not (ROOT / relative).is_file():
            errors.append(f"missing required file: {relative}")
    for relative in REQUIRED_DIRS:
        if not (ROOT / relative).is_dir():
            errors.append(f"missing required directory: {relative}")


def check_root_markdown(errors: list[str]) -> None:
    actual = {path.name for path in ROOT.glob("*.md")}
    expected = {"README.md", "AGENTS.md"}
    if actual != expected:
        errors.append(f"root Markdown must be {sorted(expected)}, found {sorted(actual)}")


def check_line_limits(errors: list[str]) -> None:
    for path in source_files():
        relative = path.relative_to(ROOT)
        if (
            path.suffix in LINE_LIMIT_EXEMPT_SUFFIXES
            or path.name in LINE_LIMIT_EXEMPT_NAMES
        ):
            continue
        line_count = len(path.read_text(encoding="utf-8").splitlines())
        if line_count >= 300:
            errors.append(f"{relative.as_posix()} has {line_count} lines; split before 300")


def is_synthetic_fixture(relative: Path) -> bool:
    parts = relative.parts
    expected_prefix = ("tests", "fixtures", "synthetic")
    in_fixture_path = len(parts) >= 4 and parts[:3] == expected_prefix
    return in_fixture_path and relative.name.startswith("synthetic-")


def check_sensitive_artifacts(errors: list[str]) -> None:
    for path in source_files():
        text = path.read_text(encoding="utf-8")
        if RESIDENT_ID.search(text):
            relative = path.relative_to(ROOT).as_posix()
            errors.append(f"resident registration number pattern found: {relative}")

    for path in ROOT.rglob("*"):
        relative = path.relative_to(ROOT)
        if not path.is_file() or SKIP_PARTS.intersection(relative.parts):
            continue
        is_tabular = path.suffix.lower() in TABULAR_SUFFIXES
        is_sqlite = bool(SQLITE_ARTIFACT.search(path.name))
        is_backup = path.suffix.lower() == BACKUP_ARTIFACT_SUFFIX
        if not is_tabular and not is_sqlite and not is_backup:
            continue
        if is_tabular and is_synthetic_fixture(relative):
            continue
        errors.append(
            "sensitive/runtime artifact must not be committed: "
            f"{relative.as_posix()}"
        )


def check_sensitive_ignore_rules(errors: list[str]) -> None:
    ignore = ROOT / ".gitignore"
    if not ignore.is_file():
        errors.append("missing required file: .gitignore")
        return
    rules = {
        line.strip()
        for line in ignore.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    if f"*{BACKUP_ARTIFACT_SUFFIX}" not in rules:
        errors.append(".gitignore must ignore *.bodam-backup at every repository path")


def check_migration_line_endings(errors: list[str]) -> None:
    attributes = ROOT / ".gitattributes"
    if not attributes.is_file():
        return
    rules = {
        line.strip()
        for line in attributes.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    required = "database/prisma/migrations/**/migration.sql text eol=lf"
    if required not in rules:
        errors.append(".gitattributes must keep migration.sql files at LF")


def check_readme_commands(errors: list[str]) -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for command in (
        "python3 harness/scripts/run_qa.py",
        "python3 harness/scripts/run_review.py",
    ):
        if command not in readme:
            errors.append(f"README missing runnable command: {command}")


def run_repository_checks() -> list[str]:
    errors: list[str] = []
    check_required(errors)
    check_root_markdown(errors)
    check_line_limits(errors)
    check_sensitive_artifacts(errors)
    check_sensitive_ignore_rules(errors)
    check_migration_line_endings(errors)
    check_readme_commands(errors)
    return errors
