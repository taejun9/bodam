import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import JSZip from "jszip";

import { assertLogicalSnapshot } from "./contract-export-db.mjs";

const exactEntries = Object.freeze(["database.sqlite3", "manifest.json"]);
const exactManifestKeys = Object.freeze([
  "appVersion",
  "createdAtUtc",
  "databaseSha256",
  "databaseSizeBytes",
  "formatVersion",
  "localDate",
  "reason",
  "schemaLastMigration",
  "schemaMigrationCount",
]);

export async function assertIndependentBackupArchive({
  archivePath,
  extractedDatabasePath,
  logicalSnapshotPath,
  sourceDatabasePath,
}) {
  const metadata = lstatSync(archivePath);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  assert.ok(metadata.size > 0 && metadata.size <= 2 * 1024 * 1024 * 1024 + 1024 * 1024);

  const zip = await JSZip.loadAsync(readFileSync(archivePath), {
    checkCRC32: true,
    createFolders: false,
  });
  assert.deepEqual(Object.keys(zip.files).sort(), exactEntries);
  for (const name of exactEntries) assert.equal(zip.files[name].dir, false);

  const manifestText = await zip.files["manifest.json"].async("string");
  assert.ok(Buffer.byteLength(manifestText, "utf8") <= 16 * 1024);
  const manifest = JSON.parse(manifestText);
  assert.deepEqual(Object.keys(manifest).sort(), exactManifestKeys);
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.reason, "manual");
  assert.match(manifest.createdAtUtc, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(manifest.createdAtUtc).toISOString(), manifest.createdAtUtc);
  assert.match(manifest.localDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    new Date(`${manifest.localDate}T00:00:00.000Z`).toISOString().slice(0, 10),
    manifest.localDate,
  );
  assert.equal(typeof manifest.appVersion, "string");
  assert.ok(manifest.appVersion.length > 0 && manifest.appVersion.length <= 64);
  assert.ok(Number.isInteger(manifest.schemaMigrationCount));
  assert.ok(manifest.schemaMigrationCount > 0);
  assert.equal(typeof manifest.schemaLastMigration, "string");
  assert.ok(manifest.schemaLastMigration.length > 0 && manifest.schemaLastMigration.length <= 200);
  assert.ok(Number.isSafeInteger(manifest.databaseSizeBytes));
  assert.ok(manifest.databaseSizeBytes >= 100 && manifest.databaseSizeBytes <= 2 * 1024 ** 3);
  assert.match(manifest.databaseSha256, /^[0-9a-f]{64}$/);

  const database = await zip.files["database.sqlite3"].async("nodebuffer");
  assert.equal(database.length, manifest.databaseSizeBytes);
  const digest = createHash("sha256").update(database).digest("hex");
  assert.equal(digest, manifest.databaseSha256);

  writeFileSync(extractedDatabasePath, database, { flag: "wx", mode: 0o600 });
  try {
    const options = { clearHostLocalBackupDirectory: true };
    assertLogicalSnapshot(sourceDatabasePath, logicalSnapshotPath, options);
    assertLogicalSnapshot(extractedDatabasePath, logicalSnapshotPath, options);
  } finally {
    rmSync(extractedDatabasePath, { force: true });
  }
}
