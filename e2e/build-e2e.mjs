import process from "node:process";
import { fileURLToPath } from "node:url";

import { createE2eBuildInvocation } from "./build-e2e-command.mjs";
import { runNodeScript } from "./node-script-runner.mjs";

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const invocation = createE2eBuildInvocation(process.argv[2], { projectRoot });
const status = runNodeScript(invocation);
if (status !== 0) throw new Error(`BODAM E2E build failed with status ${status}`);
