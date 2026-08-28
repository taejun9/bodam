#!/usr/bin/env python3
"""Negative and positive controls for plan checkout locations."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import base_checks


BRANCH = "codex/plan-999-negative-control"
PLAN = "plan-999-negative-control.md"
SHA = "a" * 40


def create_plan(root: Path) -> None:
    active = root / "docs/exec_plans/active"
    active.mkdir(parents=True)
    (active / PLAN).write_text("# synthetic\n", encoding="utf-8")


def has_error(errors: list[str], phrase: str) -> bool:
    return any(phrase in error for error in errors)


def hosted_environment(root: Path) -> dict[str, str]:
    return {
        "CI": "true",
        "GITHUB_ACTIONS": "true",
        "GITHUB_REF_NAME": BRANCH,
        "GITHUB_RUN_ID": "123456",
        "GITHUB_SHA": SHA,
        "GITHUB_WORKSPACE": str(root),
        "RUNNER_ENVIRONMENT": "github-hosted",
    }


def test_main_rejection(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_plan(root)
        base_checks.ROOT = root
        base_checks.git_branch = lambda: "main"
        errors: list[str] = []
        base_checks.check_worktree_flow(errors)
        if not has_error(errors, "must not be implemented or validated on main"):
            failures.append("main checkout accepted an active implementation plan")


def test_local_mismatch_rejection(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_plan(root)
        base_checks.ROOT = root
        base_checks.git_branch = lambda: BRANCH
        with patch.dict(os.environ, {}, clear=True):
            errors: list[str] = []
            base_checks.check_worktree_flow(errors)
        if not has_error(errors, "current location does not match"):
            failures.append("local codex branch escaped its required worktree")
        if str(root) in "\n".join(errors):
            failures.append("worktree rejection exposed the absolute root")


def test_exact_hosted_checkout(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        create_plan(root)
        base_checks.ROOT = root
        base_checks.git_branch = lambda: BRANCH
        environment = hosted_environment(root)
        with (
            patch.dict(os.environ, environment, clear=True),
            patch.object(
                base_checks,
                "git_checkout_identity",
                return_value=(SHA, str(root)),
            ),
        ):
            errors: list[str] = []
            base_checks.check_worktree_flow(errors)
        if errors:
            failures.append(f"exact GitHub Actions checkout was rejected: {errors}")

        invalid_environments = (
            {**environment, "CI": "false"},
            {**environment, "GITHUB_ACTIONS": "false"},
            {**environment, "RUNNER_ENVIRONMENT": "self-hosted"},
            {**environment, "GITHUB_REF_NAME": "codex/plan-998-other"},
            {**environment, "GITHUB_RUN_ID": "not-a-run"},
            {**environment, "GITHUB_RUN_ID": "0"},
            {**environment, "GITHUB_RUN_ID": "00"},
            {**environment, "GITHUB_RUN_ID": "１２３"},
            {**environment, "GITHUB_SHA": "not-a-sha"},
            {**environment, "GITHUB_WORKSPACE": str(root / "near-match")},
            {
                **environment,
                "GITHUB_WORKSPACE": "relative-workspace",
            },
        )
        for invalid in invalid_environments:
            with (
                patch.dict(os.environ, invalid, clear=True),
                patch.object(
                    base_checks,
                    "git_checkout_identity",
                    return_value=(SHA, str(root)),
                ),
            ):
                errors = []
                base_checks.check_worktree_flow(errors)
            if not has_error(errors, "current location does not match"):
                failures.append("incomplete GitHub Actions identity bypassed worktree flow")
                break

        invalid_identities = (
            ("b" * 40, str(root)),
            (SHA, str(root / "near-match")),
            ("", ""),
        )
        for identity in invalid_identities:
            with (
                patch.dict(os.environ, environment, clear=True),
                patch.object(
                    base_checks,
                    "git_checkout_identity",
                    return_value=identity,
                ),
            ):
                errors = []
                base_checks.check_worktree_flow(errors)
            if not has_error(errors, "current location does not match"):
                failures.append("mismatched hosted checkout identity was accepted")
                break


def test_detached_hosted_branch(failures: list[str]) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        environment = {
            **hosted_environment(root),
            "GITHUB_HEAD_REF": BRANCH,
            "GITHUB_REF_NAME": "999/merge",
        }
        base_checks.ROOT = root
        result = SimpleNamespace(returncode=0, stdout="")
        with (
            patch.dict(os.environ, environment, clear=True),
            patch.object(base_checks.subprocess, "run", return_value=result),
            patch.object(
                base_checks,
                "git_checkout_identity",
                return_value=(SHA, str(root)),
            ),
        ):
            if base_checks.git_branch() != BRANCH:
                failures.append("exact hosted PR checkout lost its head branch")
        failed_result = SimpleNamespace(returncode=1, stdout="")
        with (
            patch.dict(os.environ, environment, clear=True),
            patch.object(base_checks.subprocess, "run", return_value=failed_result),
            patch.object(
                base_checks,
                "git_checkout_identity",
                return_value=(SHA, str(root)),
            ),
        ):
            if base_checks.git_branch():
                failures.append("failed git branch command used a hosted ref fallback")
        environment["RUNNER_ENVIRONMENT"] = "self-hosted"
        with (
            patch.dict(os.environ, environment, clear=True),
            patch.object(base_checks.subprocess, "run", return_value=result),
            patch.object(
                base_checks,
                "git_checkout_identity",
                return_value=(SHA, str(root)),
            ),
        ):
            if base_checks.git_branch():
                failures.append("detached self-hosted checkout supplied a trusted branch")


def test_checkout_identity_failure(failures: list[str]) -> None:
    failed_result = SimpleNamespace(returncode=1, stdout="")
    with patch.object(base_checks.subprocess, "run", return_value=failed_result):
        if base_checks.git_checkout_identity() != ("", ""):
            failures.append("failed git identity command returned checkout identity")


def run_worktree_flow_controls() -> list[str]:
    failures: list[str] = []
    original_root = base_checks.ROOT
    original_git_branch = base_checks.git_branch
    try:
        test_main_rejection(failures)
        test_local_mismatch_rejection(failures)
        test_exact_hosted_checkout(failures)
        base_checks.git_branch = original_git_branch
        test_detached_hosted_branch(failures)
        test_checkout_identity_failure(failures)
    finally:
        base_checks.ROOT = original_root
        base_checks.git_branch = original_git_branch
    return failures
