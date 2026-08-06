#!/usr/bin/env python3
"""Verify Prisma migration artifacts, Rust registration, and schema equivalence."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = Path("src-tauri/src/database/migrations.rs")
MIGRATIONS_PATH = Path("database/prisma/migrations")
SCHEMA_PATH = Path("database/prisma/schema.prisma")
ENTRY_PATTERN = re.compile(
    r"Migration\s*\{\s*"
    r'name:\s*"([^"]+)",\s*'
    r'checksum_sha256:\s*"([0-9a-f]{64})",\s*'
    r'sql:\s*include_str!\(\s*"([^"]+)"\s*\),?\s*\}',
    re.S,
)


@dataclass(frozen=True)
class RegisteredMigration:
    name: str
    checksum_sha256: str
    include_path: str


def registered_migrations(root: Path) -> list[RegisteredMigration]:
    registry = root / REGISTRY_PATH
    if not registry.is_file():
        return []
    text = registry.read_text(encoding="utf-8")
    return [RegisteredMigration(*match) for match in ENTRY_PATTERN.findall(text)]


def check_registry(errors: list[str], root: Path | None = None) -> None:
    repository = root or ROOT
    migrations_root = repository / MIGRATIONS_PATH
    registry = repository / REGISTRY_PATH
    if not migrations_root.is_dir():
        errors.append(f"missing Prisma migration directory: {MIGRATIONS_PATH}")
        return
    if not registry.is_file():
        errors.append(f"missing Rust migration registry: {REGISTRY_PATH}")
        return

    directories = sorted(path for path in migrations_root.iterdir() if path.is_dir())
    directory_names = [path.name for path in directories]
    entries = registered_migrations(repository)
    registered_names = [entry.name for entry in entries]
    if registered_names != directory_names:
        errors.append(
            "Rust MIGRATIONS must match Prisma directories 1:1 in lexical order: "
            f"registered={registered_names}, directories={directory_names}"
        )
        return

    for directory, entry in zip(directories, entries, strict=True):
        migration_file = directory / "migration.sql"
        if not migration_file.is_file():
            errors.append(f"missing Prisma migration SQL: {migration_file.relative_to(repository)}")
            continue
        included = (registry.parent / entry.include_path).resolve()
        if included != migration_file.resolve():
            errors.append(f"Rust migration include path mismatch: {entry.name}")
            continue
        actual_hash = hashlib.sha256(migration_file.read_bytes()).hexdigest()
        if entry.checksum_sha256 != actual_hash:
            errors.append(f"Rust migration checksum mismatch: {entry.name}")


def run_prisma_diff(errors: list[str], root: Path | None = None) -> None:
    repository = root or ROOT
    node = shutil.which("node")
    package_path = repository / "node_modules/prisma/package.json"
    if node is None or not package_path.is_file():
        errors.append("Prisma schema diff requires installed local Node dependencies")
        return
    package = json.loads(package_path.read_text(encoding="utf-8"))
    bin_field = package.get("bin", {})
    bin_path = bin_field.get("prisma") if isinstance(bin_field, dict) else bin_field
    if not isinstance(bin_path, str):
        errors.append("local Prisma CLI entrypoint is unavailable")
        return

    command = [
        node,
        str(package_path.parent / bin_path),
        "migrate",
        "diff",
        "--exit-code",
        "--from-migrations",
        str(MIGRATIONS_PATH),
        "--to-schema",
        str(SCHEMA_PATH),
    ]
    result = subprocess.run(
        command,
        cwd=repository,
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode != 0:
        errors.append(
            f"Prisma schema/migration diff failed with exit code {result.returncode}"
        )


def run_database_contract_checks(registry_only: bool = False) -> list[str]:
    errors: list[str] = []
    check_registry(errors)
    if not registry_only:
        run_prisma_diff(errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry-only", action="store_true")
    args = parser.parse_args()
    errors = run_database_contract_checks(args.registry_only)
    if errors:
        print("BODAM database contract: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    print("BODAM database contract: PASS")
    print("- Prisma migration directory ↔ Rust registry order/hash: pass")
    if not args.registry_only:
        print("- Prisma schema ↔ migration history diff: pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
