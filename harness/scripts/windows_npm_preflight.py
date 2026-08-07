#!/usr/bin/env python3
"""Direct pre-npm trust gate for the hosted Windows acceptance workflow."""

from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHECKER = ROOT / "harness/scripts/windows_node_spawn_checks.py"
CHECKER_SHA256 = "b9cf2af5092485584781a48a5fadd06ce6e98a60a7b4c604f6b7d49c9aa5cb25"


def load_exact_checker(errors: list[str]) -> dict[str, object]:
    try:
        source = CHECKER.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        source = ""
    if hashlib.sha256(source.encode("utf-8")).hexdigest() != CHECKER_SHA256:
        errors.append("immutable npm trust checker changed")
        return {}
    namespace: dict[str, object] = {
        "__file__": str(CHECKER),
        "__name__": "_bodam_windows_node_spawn_checks",
    }
    exec(compile(source, str(CHECKER), "exec"), namespace)
    return namespace


def run_preflight(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    checker = load_exact_checker(errors)
    if errors:
        return errors
    for name in ("check_package", "check_e2e_trust_tree"):
        function = checker.get(name)
        if not callable(function):
            errors.append(f"immutable npm trust checker missing {name}")
            return errors
        function(root, errors)
    return errors


def main() -> int:
    errors = run_preflight()
    if errors:
        print("BODAM Windows npm trust preflight: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    print("BODAM Windows npm trust preflight: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
