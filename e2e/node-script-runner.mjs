import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute } from "node:path";
import process from "node:process";

const nodeScriptExtensions = new Set([".cjs", ".js", ".mjs"]);
const npmScriptName = /^[a-z0-9][a-z0-9:-]*$/;

function assertDirectory(path) {
  if (typeof path !== "string" || path.includes("\0") || !isAbsolute(path)) {
    throw new Error("BODAM Node script working directory is invalid");
  }
  try {
    if (!statSync(path).isDirectory()) throw new Error();
  } catch {
    throw new Error("BODAM Node script working directory is unavailable");
  }
}

function assertEntrypoint(path) {
  if (typeof path !== "string" || path.includes("\0") || !isAbsolute(path) ||
      !nodeScriptExtensions.has(extname(path).toLowerCase())) {
    throw new Error("BODAM Node script entrypoint is invalid");
  }
  try {
    if (!statSync(path).isFile()) throw new Error();
  } catch {
    throw new Error("BODAM Node script entrypoint is unavailable");
  }
}

function assertEnvironment(env) {
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    throw new Error("BODAM Node script environment is invalid");
  }
}

function assertArguments(args) {
  if (!Array.isArray(args) ||
      args.some((value) => typeof value !== "string" || value.includes("\0"))) {
    throw new Error("BODAM Node script arguments are invalid");
  }
}

function fixedNpmEnvironment(env, npmExecPath) {
  const sanitized = {};
  for (const [key, value] of Object.entries(env)) {
    const folded = key.toLowerCase();
    if (folded !== "npm_execpath" && folded !== "npm_node_execpath") {
      sanitized[key] = value;
    }
  }
  return {
    ...sanitized,
    npm_execpath: npmExecPath,
    npm_node_execpath: process.execPath,
  };
}

export function runNodeScript({ entrypoint, args, cwd, env }) {
  assertEntrypoint(entrypoint);
  assertArguments(args);
  assertDirectory(cwd);
  assertEnvironment(env);
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd,
    env,
    shell: false,
    stdio: "inherit",
  });
  if (result.error || result.signal !== null || !Number.isInteger(result.status)) {
    throw new Error("BODAM Node script did not exit normally");
  }
  return result.status;
}

export function createNpmScriptRunner({
  projectRoot,
  npmExecPath = process.env.npm_execpath,
}) {
  assertDirectory(projectRoot);
  assertEntrypoint(npmExecPath);
  const npmPathShape = [
    basename(npmExecPath),
    basename(dirname(npmExecPath)),
    basename(dirname(dirname(npmExecPath))),
  ].map((part) => part.toLowerCase());
  if (npmPathShape.join("/") !== "npm-cli.js/bin/npm") {
    throw new Error("BODAM npm JavaScript entrypoint is invalid");
  }
  return function runScript(name, env = process.env, allowFailure = false) {
    if (typeof name !== "string" || !npmScriptName.test(name) ||
        typeof allowFailure !== "boolean") {
      throw new Error("BODAM npm script request is invalid");
    }
    assertEnvironment(env);
    const status = runNodeScript({
      entrypoint: npmExecPath,
      args: ["run", name],
      cwd: projectRoot,
      env: fixedNpmEnvironment(env, npmExecPath),
    });
    if (status !== 0 && !allowFailure) {
      throw new Error(`BODAM npm script ${name} failed with status ${status}`);
    }
    return status;
  };
}
