#!/usr/bin/env python3
"""Negative controls for the BODAM repository harness."""

from __future__ import annotations

import tempfile
from pathlib import Path

import application_checks
import base_checks
import repository_checks


def expect_error(errors: list[str], phrase: str, failures: list[str]) -> None:
    if not any(phrase in error for error in errors):
        failures.append(f"negative control did not detect: {phrase}")


def test_sensitive_artifacts(failures: list[str]) -> None:
    original_root = repository_checks.ROOT
    try:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repository_checks.ROOT = root
            (root / "customer.db-wal").write_bytes(b"synthetic")
            (root / "customer.csv").write_text("synthetic\n", encoding="utf-8")
            recovery = root / "custom-recovery/BODAM-manual-synthetic.bodam-backup"
            recovery.parent.mkdir(parents=True)
            recovery.write_bytes(b"synthetic full database archive")
            errors: list[str] = []
            repository_checks.check_sensitive_artifacts(errors)
            expect_error(errors, "customer.db-wal", failures)
            expect_error(errors, "customer.csv", failures)
            expect_error(errors, "custom-recovery/BODAM-manual-synthetic.bodam-backup", failures)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repository_checks.ROOT = root
            fixture = root / "tests/fixtures/synthetic/synthetic-contract.xlsx"
            fixture.parent.mkdir(parents=True)
            fixture.write_bytes(b"synthetic")
            errors = []
            repository_checks.check_sensitive_artifacts(errors)
            if errors:
                failures.append(f"synthetic fixture was incorrectly rejected: {errors}")
    finally:
        repository_checks.ROOT = original_root


def test_sensitive_ignore_rule(failures: list[str]) -> None:
    original_root = repository_checks.ROOT
    try:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repository_checks.ROOT = root
            (root / ".gitignore").write_text("backups/\n", encoding="utf-8")
            errors: list[str] = []
            repository_checks.check_sensitive_ignore_rules(errors)
            expect_error(errors, "must ignore *.bodam-backup", failures)
    finally:
        repository_checks.ROOT = original_root


def test_line_limit_extensions(failures: list[str]) -> None:
    original_root = repository_checks.ROOT
    try:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repository_checks.ROOT = root
            content = "\n".join("model X {}" for _ in range(300))
            (root / "schema.prisma").write_text(content, encoding="utf-8")
            (root / "worker.mjs").write_text(content, encoding="utf-8")
            (root / "contract.psm1").write_text(content, encoding="utf-8")
            errors: list[str] = []
            repository_checks.check_line_limits(errors)
            expect_error(errors, "schema.prisma has 300 lines", failures)
            expect_error(errors, "worker.mjs has 300 lines", failures)
            expect_error(errors, "contract.psm1 has 300 lines", failures)
    finally:
        repository_checks.ROOT = original_root


def test_generated_cache_and_vue_sql_detection(failures: list[str]) -> None:
    original_repository_root = repository_checks.ROOT
    original_application_root = application_checks.ROOT
    try:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repository_checks.ROOT = root
            generated = root / "src-tauri/gen/schemas/desktop-schema.json"
            generated.parent.mkdir(parents=True)
            generated.write_text("\n".join("{}" for _ in range(300)), encoding="utf-8")
            errors: list[str] = []
            repository_checks.check_line_limits(errors)
            if errors:
                failures.append(f"transient Tauri cache was incorrectly scanned: {errors}")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            component = root / "src/features/customer/TestForm.vue"
            component.parent.mkdir(parents=True)
            component.write_text(
                '<script setup lang="ts">const label = "safe";</script>\n'
                '<template><select><option>{{ label }}</option></select></template>\n',
                encoding="utf-8",
            )
            application_checks.ROOT = root
            errors = []
            application_checks.check_layers(errors)
            if errors:
                failures.append(f"Vue select element was incorrectly treated as SQL: {errors}")

            component.write_text(
                '<script setup lang="ts">const query = "SELECT * FROM customers";</script>\n',
                encoding="utf-8",
            )
            errors = []
            application_checks.check_layers(errors)
            expect_error(errors, "Vue UI contains raw SQL", failures)
    finally:
        repository_checks.ROOT = original_repository_root
        application_checks.ROOT = original_application_root


def test_plan_approval_and_qa(failures: list[str]) -> None:
    plan_text = """# plan-999-negative-control

## Status

review

## User Request

Synthetic control.

## Approval

- 승인 근거:

## Goal

Synthetic control.

## Non-Goals

- None.

## Implementation Plan

- [x] Synthetic work.

## QA Plan

- Synthetic QA.

## Review Plan

Synthetic review.

## Decision Log

| date | decision | reason |
|---|---|---|
| 2026-08-05 | Synthetic | Control |

## QA Evidence

pending

## Review Findings

pending

## Completion Notes

pending
"""
    original_root = base_checks.ROOT
    try:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            base_checks.ROOT = root
            plan = root / "plan-999-negative-control.md"
            plan.write_text(plan_text, encoding="utf-8")
            errors: list[str] = []
            base_checks.check_plan_content(plan, "active", errors)
            expect_error(errors, "without an approval record", failures)
            expect_error(errors, "without PASS QA evidence", failures)
    finally:
        base_checks.ROOT = original_root


def test_main_worktree_rejection(failures: list[str]) -> None:
    original_root = base_checks.ROOT
    original_git_branch = base_checks.git_branch
    try:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            active = root / "docs/exec_plans/active"
            active.mkdir(parents=True)
            (active / "plan-999-negative-control.md").write_text(
                "# synthetic\n", encoding="utf-8"
            )
            base_checks.ROOT = root
            base_checks.git_branch = lambda: "main"
            errors: list[str] = []
            base_checks.check_worktree_flow(errors)
            expect_error(errors, "must not be implemented or validated on main", failures)
    finally:
        base_checks.ROOT = original_root
        base_checks.git_branch = original_git_branch


def run_negative_controls() -> list[str]:
    failures: list[str] = []
    test_sensitive_artifacts(failures)
    test_sensitive_ignore_rule(failures)
    test_line_limit_extensions(failures)
    test_generated_cache_and_vue_sql_detection(failures)
    test_plan_approval_and_qa(failures)
    test_main_worktree_rejection(failures)
    return failures


def main() -> int:
    failures = run_negative_controls()
    if failures:
        print("BODAM harness negative controls: FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("BODAM harness negative controls: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
