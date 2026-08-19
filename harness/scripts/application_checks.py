#!/usr/bin/env python3
"""Static application architecture and capability checks for BODAM."""

from __future__ import annotations

import json
import re
from pathlib import Path

from repository_checks import ROOT


REQUIRED_APP_FILES = (
    "package.json",
    "tsconfig.app.json",
    "src/main.ts",
    "src/App.vue",
    "src/features/customer/application/customer-application.ts",
    "src/features/customer/repositories/customer-repository.ts",
    "database/prisma/schema.prisma",
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
    "src-tauri/tauri.e2e.conf.json",
    "src-tauri/capabilities/e2e.json",
    "wdio.conf.mjs",
    "e2e/run-e2e.mjs",
    "e2e/specs/customer-write.e2e.mjs",
    "e2e/specs/customer-persistence.e2e.mjs",
)
REQUIRED_SCRIPTS = (
    "lint",
    "typecheck",
    "test:unit",
    "test:db",
    "test:e2e",
    "prisma:validate",
    "database:registry",
    "database:diff",
    "database:contract",
    "build",
    "tauri:check",
    "package:macos",
    "package:windows",
    "qa",
    "verify",
)
DOMAIN_LAYERS = {"application", "services", "schemas", "types"}
BANNED_DOMAIN_IMPORTS = (
    "from \"vue\"",
    "from \"pinia\"",
    "from \"vue-router\"",
    "@tauri-apps/",
    "@prisma/",
    "echarts",
)
SCRIPT_BLOCK_PATTERN = re.compile(r"<script\b[^>]*>(.*?)</script>", re.I | re.S)
SQL_PATTERN = re.compile(
    r"\b(?:SELECT\s+.+?\s+FROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)\b",
    re.I | re.S,
)
BANNED_PERMISSION_PREFIXES = ("fs:", "http:", "shell:", "process:", "sql:")


def check_required_files(errors: list[str]) -> None:
    for relative in REQUIRED_APP_FILES:
        if not (ROOT / relative).is_file():
            errors.append(f"missing application file: {relative}")


def check_package(errors: list[str]) -> None:
    path = ROOT / "package.json"
    if not path.is_file():
        return
    package = json.loads(path.read_text(encoding="utf-8"))
    scripts = package.get("scripts", {})
    for name in REQUIRED_SCRIPTS:
        if not scripts.get(name):
            errors.append(f"package.json missing script: {name}")
    if "database:contract" not in scripts.get("qa", ""):
        errors.append("package.json qa must run database:contract")
    if "test:e2e" not in scripts.get("verify", ""):
        errors.append("package.json verify must run test:e2e")
    dependencies = package.get("dependencies", {})
    for prohibited in ("@sentry/vue", "posthog-js", "firebase", "axios"):
        if prohibited in dependencies:
            errors.append(f"remote/telemetry dependency is prohibited: {prohibited}")


def check_typescript(errors: list[str]) -> None:
    path = ROOT / "tsconfig.app.json"
    if not path.is_file():
        return
    config = json.loads(path.read_text(encoding="utf-8"))
    options = config.get("compilerOptions", {})
    if options.get("strict") is not True:
        errors.append("tsconfig.app.json must enable strict")


def check_layers(errors: list[str]) -> None:
    src = ROOT / "src"
    if not src.is_dir():
        return
    for path in src.rglob("*"):
        if path.suffix not in {".ts", ".vue"}:
            continue
        relative = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        parts = set(relative.parts)
        if DOMAIN_LAYERS.intersection(parts):
            for banned in BANNED_DOMAIN_IMPORTS:
                if banned in text:
                    errors.append(f"domain/application layer imports {banned}: {relative}")
        if path.suffix == ".vue":
            scripts = "\n".join(SCRIPT_BLOCK_PATTERN.findall(text))
            if SQL_PATTERN.search(scripts):
                errors.append(f"Vue UI contains raw SQL: {relative}")


def check_capabilities(errors: list[str]) -> None:
    capability_dir = ROOT / "src-tauri" / "capabilities"
    if capability_dir.is_dir():
        for path in capability_dir.glob("*.json"):
            payload = json.loads(path.read_text(encoding="utf-8"))
            for permission in payload.get("permissions", []):
                identifier = permission if isinstance(permission, str) else permission.get("identifier", "")
                if identifier.startswith(BANNED_PERMISSION_PREFIXES):
                    errors.append(f"broad capability is prohibited: {identifier} in {path.name}")
                if path.name == "default.json" and identifier.startswith(("wdio:", "wdio-webdriver:")):
                    errors.append(f"production capability exposes WebDriver: {identifier}")
    config_path = ROOT / "src-tauri" / "tauri.conf.json"
    if not config_path.is_file():
        return
    config = json.loads(config_path.read_text(encoding="utf-8"))
    dev_url = config.get("build", {}).get("devUrl")
    if dev_url and not str(dev_url).startswith("http://127.0.0.1:"):
        errors.append(f"devUrl must bind loopback only: {dev_url}")


def run_application_checks() -> list[str]:
    errors: list[str] = []
    check_required_files(errors)
    check_package(errors)
    check_typescript(errors)
    check_layers(errors)
    check_capabilities(errors)
    return errors
