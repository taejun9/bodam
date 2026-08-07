#!/usr/bin/env python3
"""Comment-safe PowerShell function checks for Windows release contracts."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


INVALID_SOURCE = "__BODAM_INVALID_POWERSHELL_COMMENT_OR_STRING__"


def strip_comments(source: str) -> str:
    result: list[str] = []
    single = False
    double = False
    block = False
    escaped = False
    index = 0
    while index < len(source):
        char = source[index]
        if block:
            if source.startswith("#>", index):
                block = False
                index += 2
                continue
            if char == "\n":
                result.append(char)
            index += 1
            continue
        if char == "\n" and (single or double):
            return INVALID_SOURCE
        if escaped:
            result.append(char)
            escaped = False
        elif char == "`" and not single:
            result.append(char)
            escaped = True
        elif char == "'" and not double:
            result.append(char)
            if single and index + 1 < len(source) and source[index + 1] == "'":
                index += 1
                result.append("'")
            else:
                single = not single
        elif char == '"' and not single:
            result.append(char)
            double = not double
        elif not single and not double and source.startswith(("@\"", "@'"), index):
            line_end = source.find("\n", index)
            if line_end >= 0 and not source[index + 2 : line_end].strip():
                return INVALID_SOURCE
            result.append(char)
        elif not single and not double and source.startswith("<#", index):
            if result and not result[-1].isspace():
                result.append(" ")
            block = True
            index += 2
            continue
        elif char == "#" and not single and not double:
            newline = source.find("\n", index)
            if newline < 0:
                break
            result.append("\n")
            index = newline + 1
            continue
        else:
            result.append(char)
        index += 1
    if block or single or double or escaped:
        return INVALID_SOURCE
    return "".join(result)


def source_code(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def active_code(path: Path) -> str:
    return strip_comments(source_code(path))


def function_body(code: str, name: str, relative: str, errors: list[str]) -> str:
    pattern = re.compile(rf"^[ \t]*function[ \t]+{re.escape(name)}[ \t]*\{{", re.MULTILINE)
    matches = list(pattern.finditer(code))
    if len(matches) != 1:
        errors.append(f"{relative} must define exact function {name} once")
        return ""
    start = matches[0].end()
    depth = 1
    single = False
    double = False
    escaped = False
    index = start
    while index < len(code):
        char = code[index]
        if escaped:
            escaped = False
        elif char == "`" and not single:
            escaped = True
        elif char == "'" and not double:
            if single and index + 1 < len(code) and code[index + 1] == "'":
                index += 1
            else:
                single = not single
        elif char == '"' and not single:
            double = not double
        elif not single and not double:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return code[start:index]
        index += 1
    errors.append(f"{relative} has an unterminated exact function {name}")
    return ""


def normalized_lines(body: str) -> list[str]:
    return [line.strip() for line in body.splitlines() if line.strip()]


def require_body_digest(
    body: str, expected: str, label: str, relative: str, errors: list[str]
) -> None:
    value = body.encode("utf-8")
    if hashlib.sha256(value).hexdigest() != expected:
        errors.append(f"{relative} missing launch readiness semantic: exact {label} function body")


def require_code_digest(
    code: str, expected: str, label: str, relative: str, errors: list[str]
) -> None:
    value = code.encode("utf-8")
    if hashlib.sha256(value).hexdigest() != expected:
        errors.append(f"{relative} missing launch readiness semantic: exact {label} script")


def require_exact_lines(
    body: str, expected: tuple[str, ...], label: str, relative: str, errors: list[str]
) -> None:
    if normalized_lines(body) != list(expected):
        errors.append(f"{relative} missing launch readiness semantic: exact {label} function body")


def require_once(
    code: str, pattern: str, label: str, relative: str, errors: list[str]
) -> None:
    if len(re.findall(pattern, code, re.MULTILINE)) != 1:
        errors.append(
            f"{relative} missing launch readiness semantic: {label}; "
            "expected exactly one active statement"
        )
