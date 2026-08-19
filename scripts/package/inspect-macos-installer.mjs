import { spawnSync } from "node:child_process";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new globalThis.URL("../..", import.meta.url));
const bundleDirectory = resolve(
  projectRoot,
  "src-tauri/target/universal-apple-darwin/release/bundle/dmg",
);

function fail(message) {
  throw new Error(`BODAM macOS installer inspection failed: ${message}`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    fail(`${basename(command)} returned a non-zero status`);
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function assertRegularFile(path, label) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) fail(`${label} must be a regular file`);
}

function assertDirectory(path, label) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`${label} must be a directory`);
}

function expectedInstallerName() {
  const tauri = JSON.parse(
    readFileSync(resolve(projectRoot, "src-tauri/tauri.conf.json"), "utf8"),
  );
  return `${tauri.productName}_${tauri.version}_universal.dmg`;
}

function findInstaller() {
  const candidates = readdirSync(bundleDirectory)
    .filter((name) => name.endsWith(".dmg"))
    .sort();
  if (candidates.length !== 1) fail("the bundle directory must contain exactly one DMG");
  const expected = expectedInstallerName();
  if (candidates[0] !== expected) fail("the DMG filename does not match product and version");
  const installer = resolve(bundleDirectory, candidates[0]);
  assertRegularFile(installer, "DMG");
  return installer;
}

function safeRemoveTemporary(root) {
  const canonicalRoot = realpathSync(root);
  const canonicalTemporary = `${realpathSync(tmpdir())}${sep}`;
  const allowedPrefixes = ["bodam-macos-package-", "bodam-macos-installed-"];
  if (!canonicalRoot.startsWith(canonicalTemporary) ||
      !allowedPrefixes.some((prefix) => basename(canonicalRoot).startsWith(prefix))) {
    fail("temporary cleanup boundary is invalid");
  }
  rmSync(canonicalRoot, { recursive: true, force: false });
}

function inspectMountedApplication(application) {
  assertDirectory(application, "mounted BODAM.app");
  const installedRoot = mkdtempSync(join(tmpdir(), "bodam-macos-installed-"));
  const installedApplication = join(installedRoot, "BODAM.app");
  try {
    cpSync(application, installedApplication, {
      recursive: true,
      dereference: false,
      preserveTimestamps: true,
    });
    assertDirectory(installedApplication, "copied BODAM.app");
    const infoPlist = join(installedApplication, "Contents/Info.plist");
    const executable = join(installedApplication, "Contents/MacOS/bodam");
    assertRegularFile(infoPlist, "Info.plist");
    assertRegularFile(executable, "application executable");

    const identifier = run("/usr/libexec/PlistBuddy", [
      "-c", "Print:CFBundleIdentifier", infoPlist,
    ]);
    const version = run("/usr/libexec/PlistBuddy", [
      "-c", "Print:CFBundleShortVersionString", infoPlist,
    ]);
    if (identifier !== "app.bodam.desktop") fail("bundle identifier is not production");
    if (version !== "0.1.0") fail("bundle version is not 0.1.0");

    const architectures = new Set(run("/usr/bin/lipo", ["-archs", executable]).split(/\s+/));
    if (!architectures.has("arm64") || !architectures.has("x86_64")) {
      fail("application executable is not Universal arm64/x86_64");
    }
    run("/usr/bin/codesign", ["--verify", "--deep", "--strict", installedApplication]);
    const signature = run("/usr/bin/codesign", ["-d", "--verbose=4", installedApplication]);
    if (!signature.includes("Signature=adhoc") ||
        !signature.includes("Identifier=app.bodam.desktop")) {
      fail("application must have the reviewed ad-hoc production signature");
    }
  } finally {
    safeRemoveTemporary(installedRoot);
  }
}

function main() {
  if (process.platform !== "darwin") fail("this command must run on macOS");
  const installer = findInstaller();
  run("/usr/bin/hdiutil", ["verify", installer]);

  const mountRoot = mkdtempSync(join(tmpdir(), "bodam-macos-package-"));
  const mountPoint = join(mountRoot, "volume");
  mkdirSync(mountPoint, { mode: 0o700 });
  let mounted = false;
  try {
    run("/usr/bin/hdiutil", [
      "attach", "-readonly", "-nobrowse", "-mountpoint", mountPoint, installer,
    ]);
    mounted = true;
    const entries = readdirSync(mountPoint).sort();
    const expectedEntries = [".VolumeIcon.icns", "Applications", "BODAM.app"];
    if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) {
      fail("DMG root contains an unexpected payload");
    }
    const application = join(mountPoint, "BODAM.app");
    const applicationsLink = join(mountPoint, "Applications");
    const linkStat = lstatSync(applicationsLink);
    if (!linkStat.isSymbolicLink() || readlinkSync(applicationsLink) !== "/Applications") {
      fail("DMG must provide the Applications drag target");
    }
    const canonical = realpathSync(application);
    const canonicalMount = realpathSync(mountPoint);
    if (dirname(canonical) !== canonicalMount ||
        relative(canonicalMount, canonical).startsWith("..")) {
      fail("mounted application escapes the DMG root");
    }
    inspectMountedApplication(application);
  } finally {
    if (mounted) run("/usr/bin/hdiutil", ["detach", mountPoint]);
    safeRemoveTemporary(mountRoot);
  }

  globalThis.console.log(
    `BODAM macOS installer verified: ${basename(installer)} (Universal, ad-hoc signed)`,
  );
}

main();
