import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";

import { createE2eBuildInvocation } from "./build-e2e-command.mjs";
import { createNpmScriptRunner, runNodeScript } from "./node-script-runner.mjs";

const temporaryRoot = mkdtempSync(resolve(tmpdir(), "bodam node & % spawn "));
const expectedWorkingDirectory = realpathSync(temporaryRoot);
const fixtureSource = [
  'const { writeFileSync } = require("node:fs");',
  "writeFileSync(process.env.BODAM_NODE_CONTROL_OUTPUT, JSON.stringify({",
  "  argv: process.argv.slice(2),",
  "  cwd: process.cwd(),",
  "  marker: process.env.BODAM_NODE_CONTROL_MARKER,",
  "  npmExecPath: process.env.npm_execpath,",
  "  nodeExecPath: process.env.npm_node_execpath,",
  "  upperNpmExecPath: process.env.NPM_EXECPATH,",
  "  upperNodeExecPath: process.env.NPM_NODE_EXECPATH,",
  "  target: process.env.CARGO_TARGET_DIR,",
  "}));",
  "process.exitCode = Number(process.env.BODAM_NODE_CONTROL_EXIT || 0);",
].join("\n");

function writeFixture(path) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, fixtureSource, "utf8");
}

function evidence(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

try {
  const directFixture = resolve(temporaryRoot, "fake cli.js");
  const directOutput = resolve(temporaryRoot, "direct.json");
  const sentinel = resolve(temporaryRoot, "shell-sentinel");
  const shellLikeArguments = [
    "space value",
    "&",
    "%PATH%",
    "&&",
    process.execPath,
    "-e",
    "require('node:fs').writeFileSync('shell-sentinel','injected')",
  ];
  writeFixture(directFixture);
  assert.equal(runNodeScript({
    entrypoint: directFixture,
    args: shellLikeArguments,
    cwd: expectedWorkingDirectory,
    env: {
      ...process.env,
      BODAM_NODE_CONTROL_MARKER: "direct",
      BODAM_NODE_CONTROL_OUTPUT: directOutput,
    },
  }), 0);
  assert.deepEqual(evidence(directOutput).argv, shellLikeArguments);
  assert.equal(existsSync(sentinel), false);

  const npmEntrypoint = resolve(temporaryRoot, "npm", "bin", "npm-cli.js");
  const npmOutput = resolve(temporaryRoot, "npm.json");
  writeFixture(npmEntrypoint);
  const runNpmScript = createNpmScriptRunner({
    projectRoot: temporaryRoot,
    npmExecPath: npmEntrypoint,
  });
  const npmEnvironment = {
    ...process.env,
    BODAM_NODE_CONTROL_MARKER: "npm",
    BODAM_NODE_CONTROL_OUTPUT: npmOutput,
    npm_execpath: directFixture,
    npm_node_execpath: directFixture,
    NPM_EXECPATH: directFixture,
    NPM_NODE_EXECPATH: directFixture,
  };
  assert.equal(runNpmScript("e2e:node-control", npmEnvironment), 0);
  assert.deepEqual(evidence(npmOutput), {
    argv: ["run", "e2e:node-control"],
    cwd: expectedWorkingDirectory,
    marker: "npm",
    npmExecPath: npmEntrypoint,
    nodeExecPath: process.execPath,
    ...(process.platform === "win32" ? {
      upperNpmExecPath: npmEntrypoint,
      upperNodeExecPath: process.execPath,
    } : {}),
  });
  const failingEnvironment = { ...npmEnvironment, BODAM_NODE_CONTROL_EXIT: "7" };
  assert.equal(runNpmScript("e2e:node-control", failingEnvironment, true), 7);
  assert.throws(() => runNpmScript("e2e:node-control", failingEnvironment));

  const tauriEntrypoint = resolve(
    temporaryRoot,
    "node_modules",
    "@tauri-apps",
    "cli",
    "tauri.js",
  );
  const buildOutput = resolve(temporaryRoot, "build.json");
  writeFixture(tauriEntrypoint);
  const windows = createE2eBuildInvocation("windows-nsis", {
    platform: "win32",
    projectRoot: temporaryRoot,
    env: { ...process.env, BODAM_NODE_CONTROL_OUTPUT: buildOutput },
  });
  assert.equal(windows.entrypoint, tauriEntrypoint);
  assert.equal(runNodeScript(windows), 0);
  assert.deepEqual(evidence(buildOutput).argv, [
    "build",
    "--config",
    resolve(temporaryRoot, "src-tauri", "tauri.e2e.conf.json"),
    "--ci",
    "--no-sign",
    "--bundles",
    "nsis",
    "--features",
    "e2e",
  ]);
  assert.equal(
    evidence(buildOutput).target,
    resolve(temporaryRoot, "src-tauri", "target", "e2e"),
  );
  const macos = createE2eBuildInvocation("macos", {
    platform: "darwin", projectRoot: temporaryRoot,
  });
  const unbundled = createE2eBuildInvocation("no-bundle", { projectRoot: temporaryRoot });
  assert.deepEqual(macos.args.slice(-4), ["--bundles", "app", "--features", "e2e"]);
  assert.deepEqual(unbundled.args.slice(-3), ["--no-bundle", "--features", "e2e"]);

  assert.throws(() => createE2eBuildInvocation("invalid", { projectRoot: temporaryRoot }));
  assert.throws(() => createE2eBuildInvocation("macos", {
    platform: "win32", projectRoot: temporaryRoot,
  }));
  assert.throws(() => runNodeScript({
    entrypoint: "relative.js", args: [], cwd: temporaryRoot, env: process.env,
  }));
  assert.throws(() => runNodeScript({
    entrypoint: resolve(temporaryRoot, "shim.cmd"),
    args: [], cwd: temporaryRoot, env: process.env,
  }));
  assert.throws(() => runNodeScript({
    entrypoint: resolve(temporaryRoot, "missing.js"),
    args: [], cwd: temporaryRoot, env: process.env,
  }));
  assert.throws(() => runNodeScript({
    entrypoint: directFixture, args: ["bad\0argument"], cwd: temporaryRoot, env: process.env,
  }));
  assert.throws(() => createNpmScriptRunner({
    projectRoot: temporaryRoot, npmExecPath: directFixture,
  }));
  assert.throws(() => runNpmScript("invalid script", npmEnvironment));
  process.stdout.write("BODAM Node script subprocess controls: PASS\n");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
