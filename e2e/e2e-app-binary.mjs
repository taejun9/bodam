import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import process from "node:process";

function sameWindowsPath(left, right) {
  return left.toLowerCase() === right.toLowerCase();
}

export function resolveInstalledWindowsE2eBinary() {
  const configured = process.env.BODAM_E2E_APP_BINARY_PATH;
  if (!configured) return null;
  if (process.platform !== "win32") {
    throw new Error("BODAM_E2E_APP_BINARY_PATH is only allowed on Windows");
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData || !isAbsolute(localAppData)) {
    throw new Error("LOCALAPPDATA must be an absolute Windows directory");
  }
  const expected = resolve(localAppData, "BODAM E2E", "bodam.exe");
  if (!isAbsolute(configured) || !sameWindowsPath(resolve(configured), expected)) {
    throw new Error("BODAM_E2E_APP_BINARY_PATH must be the installed BODAM E2E binary");
  }
  if (!existsSync(expected)) {
    throw new Error("the installed BODAM E2E binary is unavailable");
  }
  const metadata = lstatSync(expected);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("the installed BODAM E2E binary must be a regular file");
  }

  const actual = realpathSync.native(expected);
  if (!sameWindowsPath(actual, expected)) {
    throw new Error("the installed BODAM E2E binary resolved outside its exact path");
  }
  return actual;
}

export function resolveE2eAppBinary(targetDirectory) {
  const installed = resolveInstalledWindowsE2eBinary();
  if (installed) return installed;

  const releaseDirectory = resolve(targetDirectory, "release");
  return process.platform === "darwin"
    ? resolve(releaseDirectory, "bundle", "macos", "BODAM E2E.app", "Contents", "MacOS", "bodam")
    : resolve(releaseDirectory, process.platform === "win32" ? "bodam.exe" : "bodam");
}
