#!/usr/bin/env python3
"""Plan and worktree checks for BODAM."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

from repository_checks import ROOT, run_repository_checks


PLAN_NAME = re.compile(r"plan-\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
PLAN_HEADINGS = (
    "## Status",
    "## User Request",
    "## Approval",
    "## Goal",
    "## Non-Goals",
    "## Implementation Plan",
    "## QA Plan",
    "## Review Plan",
    "## Decision Log",
)
ACTIVE_STATUSES = {"draft", "awaiting-approval", "active", "qa", "review"}
PRE_APPROVAL_STATUSES = {"draft", "awaiting-approval"}
PLACEHOLDERS = {"", "todo", "tbd", "pending", "아직 실행 전.", "qa 이후 기록한다."}


def section(text: str, heading: str) -> str:
    marker = f"{heading}\n"
    start = text.find(marker)
    if start == -1:
        return ""
    body_start = start + len(marker)
    next_heading = text.find("\n## ", body_start)
    if next_heading == -1:
        next_heading = len(text)
    return text[body_start:next_heading].strip()


def plan_status(text: str) -> str:
    status = section(text, "## Status")
    return status.splitlines()[0].strip() if status else ""


def has_label_value(text: str, label: str) -> bool:
    for line in text.splitlines():
        normalized = line.strip().removeprefix("-").strip()
        if not normalized.startswith(label):
            continue
        value = normalized[len(label) :].strip()
        return value.lower() not in PLACEHOLDERS
    return False


def has_meaningful_text(text: str) -> bool:
    normalized = text.strip().lower()
    return normalized not in PLACEHOLDERS and len(normalized) >= 8


def git_branch() -> str:
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return ""
    branch = result.stdout.strip()
    if branch:
        return branch
    hosted_branch = (
        os.environ.get("GITHUB_HEAD_REF") or
        os.environ.get("GITHUB_REF_NAME", "")
    )
    return hosted_branch if is_exact_github_actions_checkout(hosted_branch) else ""


def git_checkout_identity() -> tuple[str, str]:
    outputs: list[str] = []
    for arguments in (["git", "rev-parse", "HEAD"], ["git", "rev-parse", "--show-toplevel"]):
        try:
            result = subprocess.run(
                arguments,
                cwd=ROOT,
                check=False,
                capture_output=True,
                text=True,
            )
        except OSError:
            return "", ""
        if result.returncode != 0:
            return "", ""
        outputs.append(result.stdout.strip())
    return outputs[0], outputs[1]


def is_exact_github_actions_checkout(branch: str) -> bool:
    """Recognize the hosted checkout for policy checks, not remote attestation."""
    workspace = os.environ.get("GITHUB_WORKSPACE", "")
    event_branch = (
        os.environ.get("GITHUB_HEAD_REF") or
        os.environ.get("GITHUB_REF_NAME", "")
    )
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    expected_sha = os.environ.get("GITHUB_SHA", "")
    if (
        os.environ.get("GITHUB_ACTIONS") != "true" or
        os.environ.get("CI") != "true" or
        os.environ.get("RUNNER_ENVIRONMENT") != "github-hosted" or
        not workspace or
        not re.fullmatch(r"[1-9][0-9]*", run_id) or
        not re.fullmatch(r"[0-9a-fA-F]{40}", expected_sha) or
        event_branch != branch
    ):
        return False
    workspace_path = Path(workspace)
    if not workspace_path.is_absolute():
        return False
    head_sha, top_level = git_checkout_identity()
    if head_sha.lower() != expected_sha.lower() or not top_level:
        return False
    try:
        canonical_root = ROOT.resolve(strict=True)
        return (
            workspace_path.resolve(strict=True) == canonical_root and
            Path(top_level).resolve(strict=True) == canonical_root
        )
    except (OSError, RuntimeError):
        return False


def check_plan_content(plan: Path, folder: str, errors: list[str]) -> None:
    relative = plan.relative_to(ROOT)
    if not PLAN_NAME.fullmatch(plan.name):
        errors.append(f"invalid plan filename: {relative}")

    text = plan.read_text(encoding="utf-8")
    for heading in PLAN_HEADINGS:
        if heading not in text:
            errors.append(f"{relative} missing {heading}")

    status = plan_status(text)
    implementation = section(text, "## Implementation Plan")
    approval = section(text, "## Approval")
    qa_evidence = section(text, "## QA Evidence")
    review_findings = section(text, "## Review Findings")
    completion_notes = section(text, "## Completion Notes")
    implementation_started = "- [x]" in implementation.lower()
    approval_recorded = all(
        has_label_value(approval, label)
        for label in ("승인일:", "승인 근거:", "승인 범위:")
    )

    if folder == "active" and status not in ACTIVE_STATUSES:
        errors.append(f"{relative} has invalid active status: {status or '<empty>'}")
    if folder == "completed" and status != "completed":
        errors.append(f"{relative} must have completed status")
    if status in PRE_APPROVAL_STATUSES and implementation_started:
        errors.append(f"{relative} has completed work before approval")
    if implementation_started and not approval_recorded:
        errors.append(f"{relative} has completed work without an approval record")
    if status in {"qa", "review", "completed"} and not approval_recorded:
        errors.append(f"{relative} entered {status} without approval")
    if status in {"review", "completed"} and "result: PASS" not in qa_evidence:
        errors.append(f"{relative} entered {status} without PASS QA evidence")
    if folder == "completed":
        if "- [ ]" in implementation:
            errors.append(f"{relative} has incomplete implementation checklist items")
        if not has_meaningful_text(review_findings):
            errors.append(f"{relative} lacks completed review findings")
        if not has_meaningful_text(completion_notes):
            errors.append(f"{relative} lacks completion notes")


def check_plan_layout(errors: list[str]) -> None:
    if (ROOT / "docs/plan").exists():
        errors.append("docs/plan is prohibited")
    for folder in ("active", "completed"):
        directory = ROOT / "docs/exec_plans" / folder
        for plan in directory.glob("*.md"):
            check_plan_content(plan, folder, errors)


def check_worktree_flow(errors: list[str]) -> None:
    active_dir = ROOT / "docs/exec_plans/active"
    active_plans = {path.name for path in active_dir.glob("*.md")}
    completed_dir = ROOT / "docs/exec_plans/completed"
    completed_plans = {path.name for path in completed_dir.glob("*.md")}
    branch = git_branch()
    if branch == "main":
        if active_plans:
            errors.append("active plans must not be implemented or validated on main")
        return
    if not branch.startswith("codex/"):
        if active_plans or completed_plans:
            errors.append(
                f"plan work must use main or a codex/ branch, found: {branch or '<unknown>'}"
            )
        return

    plan_stem = branch.removeprefix("codex/")
    expected_plan = f"{plan_stem}.md"
    if expected_plan not in active_plans | completed_plans:
        errors.append(f"branch {branch} has no matching plan {expected_plan}")
    local_worktree = ROOT.parent.name == ".worktree" and ROOT.name == plan_stem
    if not local_worktree and not is_exact_github_actions_checkout(branch):
        errors.append(
            f"branch {branch} must run in .worktree/{plan_stem}; "
            "current location does not match"
        )


def run_base_checks() -> list[str]:
    errors = run_repository_checks()
    check_plan_layout(errors)
    check_worktree_flow(errors)
    return errors
