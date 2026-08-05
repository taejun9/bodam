#!/usr/bin/env python3
"""Run deterministic QA checks for the current BODAM repository base."""

from __future__ import annotations

from base_checks import ROOT, run_base_checks
from test_harness import run_negative_controls


def main() -> int:
    errors = run_base_checks()
    errors.extend(run_negative_controls())
    if errors:
        print("BODAM base QA: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1

    print("BODAM base QA: PASS")
    print(f"- repository: {ROOT}")
    print("- required structure: pass")
    print("- plan approval and status: pass")
    print("- branch and worktree flow: pass")
    print("- root Markdown policy: pass")
    print("- file line limits: pass")
    print("- sensitive artifact scan: pass")
    print("- harness negative controls: pass")
    print("- README commands: pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
