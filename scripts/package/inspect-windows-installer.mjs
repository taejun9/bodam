import { Buffer } from "node:buffer";
import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
} from "node:fs";
import { basename, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new globalThis.URL("../..", import.meta.url));
const bundleDirectory = resolve(projectRoot, "src-tauri/target/release/bundle/nsis");

function fail(message) {
  throw new Error(`BODAM Windows installer inspection failed: ${message}`);
}

function assertPeMachine(path, size, expectedMachine, label) {
  const descriptor = openSync(path, "r");
  try {
    const dosHeader = Buffer.alloc(64);
    if (readSync(descriptor, dosHeader, 0, dosHeader.length, 0) !== dosHeader.length ||
        dosHeader[0] !== 0x4d || dosHeader[1] !== 0x5a) {
      fail(`${label} does not have a valid DOS header`);
    }
    const peOffset = dosHeader.readUInt32LE(0x3c);
    if (peOffset + 6 > size) fail(`${label} has an invalid PE offset`);
    const peHeader = Buffer.alloc(6);
    if (readSync(descriptor, peHeader, 0, peHeader.length, peOffset) !== peHeader.length ||
        peHeader.readUInt32LE(0) !== 0x00004550 ||
        peHeader.readUInt16LE(4) !== expectedMachine) {
      fail(`${label} has an unexpected PE machine`);
    }
  } finally {
    closeSync(descriptor);
  }
}

if (process.platform !== "win32") fail("this command must run on Windows");

const config = JSON.parse(
  readFileSync(resolve(projectRoot, "src-tauri/tauri.conf.json"), "utf8"),
);
if (config.bundle?.windows?.webviewInstallMode?.type !== "offlineInstaller") {
  fail("WebView2 offline installer is not configured");
}
if (config.bundle?.windows?.nsis?.installMode !== "currentUser") {
  fail("NSIS is not configured for the current user");
}

const candidates = readdirSync(bundleDirectory)
  .filter((name) => name.endsWith("-setup.exe"))
  .sort();
if (candidates.length !== 1) fail("the bundle directory must contain exactly one setup EXE");

const expected = `${config.productName}_${config.version}_x64-setup.exe`;
if (candidates[0] !== expected) fail("the setup filename does not match product and version");
const installer = resolve(bundleDirectory, candidates[0]);
const stat = lstatSync(installer);
if (stat.isSymbolicLink() || !stat.isFile()) fail("the setup EXE must be a regular file");
if (stat.size < 100 * 1024 * 1024) fail("the setup EXE is too small for offline WebView2");
assertPeMachine(installer, stat.size, 0x014c, "the NSIS setup EXE");

const application = resolve(projectRoot, "src-tauri/target/release/bodam.exe");
const applicationStat = lstatSync(application);
if (applicationStat.isSymbolicLink() || !applicationStat.isFile()) {
  fail("the BODAM application must be a regular file");
}
assertPeMachine(application, applicationStat.size, 0x8664, "the BODAM application");

globalThis.console.log(
  `BODAM Windows installer verified: ${basename(installer)} (${stat.size} bytes, x64 app, offline WebView2)`,
);
