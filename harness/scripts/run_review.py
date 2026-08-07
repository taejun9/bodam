#!/usr/bin/env python3
"""Check review prerequisites; a human/agent review still records the verdict."""

from __future__ import annotations

from base_checks import ROOT, git_branch, plan_status, run_base_checks, section


REQUIRED_EVIDENCE = {
    "docs/product/product.md": (
        "인터넷이 없어도",
        "달력",
        "Excel",
    ),
    "docs/architecture/system-overview.md": (
        "UI는 저장 방식과 보험 비즈니스 규칙을 직접",
        "Prisma Client를 Tauri 앱에서 실행하는 방식",
    ),
    "docs/architecture/import-export.md": (
        "원본 파일을 수정하지 않는다",
        "synthetic",
        "열 순서",
    ),
    "docs/privacy/principles.md": (
        "주민등록번호",
        "보험사 로그인",
        "민감 병력",
        "상세 병력",
    ),
    "docs/quality/windows-e2e-evidence.md": (
        "NOT RUN - environment unavailable",
        "NotSigned",
        "bodam-windows-x64-unsigned",
    ),
    "docs/quality/windows-release-acceptance.md": (
        "offlineVmAccepted: false",
        "local fixed NTFS",
        "UNC, network and removable",
    ),
    "docs/references/official-sources.md": (
        "확인일:",
        "https://v2.tauri.app/",
        "https://www.prisma.io/",
    ),
}


def check_evidence(errors: list[str]) -> None:
    for relative, phrases in REQUIRED_EVIDENCE.items():
        path = ROOT / relative
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for phrase in phrases:
            if phrase not in text:
                errors.append(f"{relative} missing review evidence: {phrase}")


def check_completed_plan_mirrors(errors: list[str]) -> None:
    completed = ROOT / "docs/exec_plans/completed"
    reviews = ROOT / "docs/reviews"
    for plan in completed.glob("plan-*.md"):
        if not (reviews / plan.name).is_file():
            errors.append(f"completed plan missing review mirror: {plan.name}")


def check_review_state(errors: list[str]) -> None:
    branch = git_branch()
    if branch.startswith("codex/"):
        plan_name = f"{branch.removeprefix('codex/')}.md"
        active = ROOT / "docs/exec_plans/active" / plan_name
        completed = ROOT / "docs/exec_plans/completed" / plan_name
        if active.is_file():
            text = active.read_text(encoding="utf-8")
            if plan_status(text) != "review":
                errors.append(f"{plan_name} must be in review status")
            if "result: PASS" not in section(text, "## QA Evidence"):
                errors.append(f"{plan_name} must contain PASS QA evidence")
        elif not completed.is_file():
            errors.append(f"branch {branch} has no matching active or completed plan")


def main() -> int:
    errors = run_base_checks()
    check_evidence(errors)
    check_review_state(errors)
    check_completed_plan_mirrors(errors)
    if errors:
        print("BODAM review prerequisites: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1

    print("BODAM review prerequisites: PASS")
    print("- scope and durable evidence are present")
    print("- completed plan mirrors are consistent")
    print("- record the manual verdict in docs/reviews before commit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
