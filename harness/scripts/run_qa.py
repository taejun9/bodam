#!/usr/bin/env python3
"""Run deterministic QA checks for the current BODAM repository base."""

from __future__ import annotations

from application_checks import run_application_checks
from base_checks import ROOT, run_base_checks
from database_contract_checks import run_database_contract_checks
from test_database_contract import run_database_negative_controls
from test_harness import run_negative_controls


def main() -> int:
    errors = run_base_checks()
    errors.extend(run_application_checks())
    errors.extend(run_database_contract_checks())
    errors.extend(run_negative_controls())
    errors.extend(run_database_negative_controls())
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
    print("- application architecture and capability checks: pass")
    print("- Prisma/Rust migration registry order and hash: pass")
    print("- Prisma schema/migration diff: pass")
    print("- README commands: pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
