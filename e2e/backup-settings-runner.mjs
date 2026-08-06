import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, relative, resolve } from "node:path";

import { assertIndependentBackupArchive } from "./backup-archive-assertion.mjs";
import { assertLogicalSnapshot, writeLogicalSnapshot } from "./contract-export-db.mjs";

const archivePattern = /^BODAM-(daily|exit|manual|pre-restore)-.+\.bodam-backup$/;
const automaticPattern = /^BODAM-(daily|exit)-.+\.bodam-backup$/;
const exitPattern = /^BODAM-exit-.+\.bodam-backup$/;
const manualPattern = /^BODAM-manual-.+\.bodam-backup$/;

function assertRuntimeChild(runtimeDirectory, path, label) {
  const child = relative(resolve(runtimeDirectory), resolve(path));
  if (!child || child === ".." || child.startsWith("../") || child.startsWith("..\\")) {
    throw new Error(`${label} must be inside the BODAM E2E temporary directory`);
  }
}

function archiveNames(backupDirectory) {
  return readdirSync(backupDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && archivePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function automaticCount(backupDirectory) {
  return archiveNames(backupDirectory).filter((name) => automaticPattern.test(name)).length;
}

function exitCount(backupDirectory) {
  return archiveNames(backupDirectory).filter((name) => exitPattern.test(name)).length;
}

function requireMarker(markerPath) {
  if (!existsSync(markerPath)) throw new Error("expected E2E exit phase marker is unavailable");
  const value = JSON.parse(readFileSync(markerPath, "utf8"));
  if (!Number.isInteger(value.dailyCount) || value.dailyCount < 0) {
    throw new Error("E2E exit phase marker is invalid");
  }
  return value;
}

function restoreSyntheticBackupDirectory(backupDirectory) {
  const unavailable = `${backupDirectory}-unavailable`;
  if (!existsSync(backupDirectory) && existsSync(unavailable)) {
    renameSync(unavailable, backupDirectory);
  }
  if (!existsSync(backupDirectory) || existsSync(unavailable)) {
    throw new Error("synthetic backup directory was not restored after exit failure E2E");
  }
}

function assertNoRuntimeResidue(runtimeDirectory, databasePath) {
  const forbidden = [
    /^pending-restore\.json$/,
    /^restore-status\.json$/,
    /^restore-preview-.*\.bodam-backup$/,
    /^restore-safety-.*\.sqlite3$/,
    /^restore-working-.*\.sqlite3$/,
    /^\.bodam-(restore|rollback|snapshot|verify|inspect)-/,
    /^\.bodam-.*\.tmp\./,
    /^\.bodam-state-.*\.tmp\.json$/,
    /^\.bodam-write-check-.*\.tmp(?:\.tmp)?$/,
  ];
  const databaseBasename = basename(databasePath);
  // WAL/SHM can remain valid after Tauri app.exit; the isolated runtime owns their cleanup.
  const rollbackJournal = `${databaseBasename}-journal`;
  const pending = [runtimeDirectory];
  const residueKinds = new Set();
  while (pending.length > 0) {
    const directory = pending.pop();
    const restoreDirectory = basename(directory) === "restore";
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) residueKinds.add("symbolic-link");
      else if (entry.isDirectory()) pending.push(resolve(directory, entry.name));
      else if (restoreDirectory) residueKinds.add("restore-state");
      else if (entry.name === rollbackJournal) residueKinds.add("sqlite-journal");
      else if (forbidden.some((pattern) => pattern.test(entry.name))) {
        residueKinds.add("temporary-artifact");
      }
    }
  }
  if (residueKinds.size > 0) {
    throw new Error(
      `temporary restore or SQLite residue remains after native E2E: ${[
        ...residueKinds,
      ].sort().join(", ")}`,
    );
  }
}

function seedProcessAbortOrphans(runtimeDirectory, backupDirectory, databasePath, archivePath) {
  const workspace = resolve(runtimeDirectory, "backup-work");
  const defaultBackups = resolve(runtimeDirectory, "backups");
  const restore = resolve(runtimeDirectory, "restore");
  for (const directory of [workspace, defaultBackups, restore]) {
    mkdirSync(directory, { recursive: true });
  }
  const sqliteFiles = [
    ...["snapshot", "verify", "inspect"].map((kind) =>
      resolve(workspace, `.bodam-${kind}-${randomUUID()}.sqlite3`)),
    ...["restore", "rollback"].map((kind) =>
      resolve(runtimeDirectory, `.bodam-${kind}-${randomUUID()}.sqlite3`)),
    ...["safety", "working"].map((kind) =>
      resolve(restore, `restore-${kind}-${randomUUID()}.sqlite3`)),
  ];
  const seeded = [];
  for (const path of sqliteFiles) {
    copyFileSync(databasePath, path);
    seeded.push(path);
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      const sidecar = `${path}${suffix}`;
      writeFileSync(sidecar, "synthetic interrupted SQLite sidecar", { mode: 0o600 });
      seeded.push(sidecar);
    }
  }
  const archiveFiles = [
    resolve(backupDirectory, `.bodam-backup-${randomUUID()}.tmp.bodam-backup`),
    resolve(defaultBackups, `.bodam-backup-${randomUUID()}.tmp.bodam-backup`),
    resolve(restore, `restore-preview-${randomUUID()}.bodam-backup`),
  ];
  for (const path of archiveFiles) {
    copyFileSync(archivePath, path);
    seeded.push(path);
  }
  const interruptedStateFiles = [
    resolve(restore, `.bodam-state-${randomUUID()}.tmp.json`),
    ...[backupDirectory, defaultBackups].flatMap((directory) => [
      resolve(directory, `.bodam-write-check-${randomUUID()}.tmp`),
      resolve(directory, `.bodam-write-check-${randomUUID()}.tmp.tmp`),
    ]),
  ];
  for (const path of interruptedStateFiles) {
    writeFileSync(path, "synthetic interrupted private state", { mode: 0o600 });
    seeded.push(path);
  }
  return seeded;
}

function assertProcessAbortOrphansRemoved(paths) {
  const remaining = paths.filter((path) => existsSync(path));
  if (remaining.length > 0) {
    throw new Error(`next native startup left ${remaining.length} interrupted backup artifacts`);
  }
}

export async function runBackupSettingsScenario({
  baseEnvironment,
  backupDatabasePath,
  backupDirectory,
  runScript,
  runtimeDirectory,
}) {
  assertRuntimeChild(runtimeDirectory, backupDatabasePath, "backup database");
  assertRuntimeChild(runtimeDirectory, backupDirectory, "backup directory");
  mkdirSync(backupDirectory, { recursive: true });
  const environment = {
    ...baseEnvironment,
    BODAM_E2E_DB_PATH: backupDatabasePath,
    BODAM_E2E_BACKUP_DIRECTORY: backupDirectory,
  };
  const logicalSnapshotPath = resolve(runtimeDirectory, "synthetic-backup-snapshot.json");
  const extractedDatabasePath = resolve(runtimeDirectory, "synthetic-archive-database.sqlite3");
  delete environment.BODAM_E2E_RESTORE_FILE;
  delete environment.BODAM_E2E_PHASED_RESTART;
  delete environment.BODAM_E2E_PHASE_MARKER;

  runScript("e2e:backup-settings-write", environment);
  writeLogicalSnapshot(backupDatabasePath, logicalSnapshotPath, {
    clearHostLocalBackupDirectory: true,
  });
  const manualArchives = archiveNames(backupDirectory).filter((name) => manualPattern.test(name));
  if (manualArchives.length !== 1) {
    throw new Error(`expected one synthetic manual backup, found ${manualArchives.length}`);
  }
  const restoreFile = resolve(backupDirectory, manualArchives[0]);
  assertRuntimeChild(runtimeDirectory, restoreFile, "restore archive");
  if (basename(restoreFile) !== manualArchives[0]) {
    throw new Error("restore archive basename is invalid");
  }
  await assertIndependentBackupArchive({
    archivePath: restoreFile,
    extractedDatabasePath,
    logicalSnapshotPath,
    sourceDatabasePath: backupDatabasePath,
  });
  const interruptedArtifacts = seedProcessAbortOrphans(
    runtimeDirectory,
    backupDirectory,
    backupDatabasePath,
    restoreFile,
  );
  const restoreEnvironment = {
    ...environment,
    BODAM_E2E_RESTORE_FILE: restoreFile,
  };

  runScript("e2e:backup-settings-mutate", restoreEnvironment);
  assertProcessAbortOrphansRemoved(interruptedArtifacts);
  runScript(
    "e2e:backup-settings-restore",
    { ...restoreEnvironment, BODAM_E2E_PHASED_RESTART: "1" },
    true,
  );
  runScript("e2e:backup-settings-verify", restoreEnvironment);
  assertLogicalSnapshot(backupDatabasePath, logicalSnapshotPath, {
    clearHostLocalBackupDirectory: true,
  });
  runScript("e2e:backup-settings-reauthorize", restoreEnvironment);

  const automaticBeforeFailure = automaticCount(backupDirectory);
  const exitsBeforeFailure = exitCount(backupDirectory);
  const failureMarker = resolve(runtimeDirectory, "backup-exit-failure.json");
  rmSync(failureMarker, { force: true });
  try {
    runScript(
      "e2e:backup-settings-exit-failure",
      { ...restoreEnvironment, BODAM_E2E_PHASE_MARKER: failureMarker },
      true,
    );
  } finally {
    restoreSyntheticBackupDirectory(backupDirectory);
  }
  const failure = requireMarker(failureMarker);
  rmSync(failureMarker, { force: true });
  if (failure.dailyCount !== automaticBeforeFailure ||
      !failure.failureDialog || !failure.retryFailed || !failure.warnedExit ||
      automaticCount(backupDirectory) !== automaticBeforeFailure ||
      exitCount(backupDirectory) !== exitsBeforeFailure) {
    throw new Error("native exit backup failure evidence is incomplete");
  }

  const firstMarker = resolve(runtimeDirectory, "backup-exit-first.json");
  rmSync(firstMarker, { force: true });
  runScript(
    "e2e:backup-settings-exit-changed",
    { ...restoreEnvironment, BODAM_E2E_PHASE_MARKER: firstMarker },
    true,
  );
  const first = requireMarker(firstMarker);
  rmSync(firstMarker, { force: true });
  const automaticAfterFirstExit = automaticCount(backupDirectory);
  const exitsAfterFirst = exitCount(backupDirectory);
  if (first.dailyCount !== automaticBeforeFailure || !first.changedAfterDaily ||
      automaticAfterFirstExit !== automaticBeforeFailure + 1 ||
      exitsAfterFirst !== exitsBeforeFailure + 1) {
    throw new Error("changed native close did not create exactly one exit backup");
  }

  const secondMarker = resolve(runtimeDirectory, "backup-exit-second.json");
  rmSync(secondMarker, { force: true });
  runScript(
    "e2e:backup-settings-idempotency",
    { ...restoreEnvironment, BODAM_E2E_PHASE_MARKER: secondMarker },
    true,
  );
  const second = requireMarker(secondMarker);
  rmSync(secondMarker, { force: true });
  const automaticAfterSecondExit = automaticCount(backupDirectory);
  if (second.dailyCount !== automaticAfterFirstExit ||
      automaticAfterSecondExit !== automaticAfterFirstExit ||
      exitCount(backupDirectory) !== exitsAfterFirst) {
    throw new Error("unchanged exit created a duplicate automatic backup");
  }
  if (!existsSync(restoreFile)) throw new Error("manual restore archive was unexpectedly removed");
  assertNoRuntimeResidue(runtimeDirectory, backupDatabasePath);
  rmSync(logicalSnapshotPath, { force: true });
}
