#!/usr/bin/env python3
"""Negative controls for the database artifact contract gate."""

from __future__ import annotations

import hashlib
import tempfile
from pathlib import Path

from database_contract_checks import check_registry


def registry_source(entries: list[tuple[str, str, str]]) -> str:
    body = []
    for name, checksum, include_path in entries:
        body.append(
            "Migration {\n"
            f'    name: "{name}",\n'
            f'    checksum_sha256: "{checksum}",\n'
            f'    sql: include_str!("{include_path}"),\n'
            "}"
        )
    return "pub(crate) const MIGRATIONS: &[Migration] = &[\n" + ",\n".join(body) + "\n];\n"


def create_fixture(root: Path) -> tuple[Path, str]:
    name = "20260806000000_synthetic"
    migration = root / "database/prisma/migrations" / name / "migration.sql"
    migration.parent.mkdir(parents=True)
    migration.write_text("CREATE TABLE synthetic (id TEXT);\n", encoding="utf-8")
    checksum = hashlib.sha256(migration.read_bytes()).hexdigest()
    registry = root / "src-tauri/src/database/migrations.rs"
    registry.parent.mkdir(parents=True)
    include_path = f"../../../database/prisma/migrations/{name}/migration.sql"
    registry.write_text(
        registry_source([(name, checksum, include_path)]), encoding="utf-8"
    )
    return registry, checksum


def expect_error(errors: list[str], phrase: str, failures: list[str]) -> None:
    if not any(phrase in error for error in errors):
        failures.append(f"database negative control did not detect: {phrase}")


def run_database_negative_controls() -> list[str]:
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        registry, checksum = create_fixture(root)
        errors: list[str] = []
        check_registry(errors, root)
        if errors:
            failures.append(f"valid database contract was rejected: {errors}")

        text = registry.read_text(encoding="utf-8")
        registry.write_text(text.replace(checksum, "0" * 64), encoding="utf-8")
        errors = []
        check_registry(errors, root)
        expect_error(errors, "checksum mismatch", failures)

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        registry, checksum = create_fixture(root)
        second_name = "20260806000001_synthetic"
        second = root / "database/prisma/migrations" / second_name / "migration.sql"
        second.parent.mkdir(parents=True)
        second.write_text("CREATE TABLE second (id TEXT);\n", encoding="utf-8")
        include_path = "../../../database/prisma/migrations/20260806000000_synthetic/migration.sql"
        registry.write_text(
            registry_source([("20260806000000_synthetic", checksum, include_path)]),
            encoding="utf-8",
        )
        errors = []
        check_registry(errors, root)
        expect_error(errors, "match Prisma directories 1:1", failures)

        second_checksum = hashlib.sha256(second.read_bytes()).hexdigest()
        second_include = f"../../../database/prisma/migrations/{second_name}/migration.sql"
        registry.write_text(
            registry_source(
                [
                    (second_name, second_checksum, second_include),
                    ("20260806000000_synthetic", checksum, include_path),
                ]
            ),
            encoding="utf-8",
        )
        errors = []
        check_registry(errors, root)
        expect_error(errors, "lexical order", failures)
    return failures
