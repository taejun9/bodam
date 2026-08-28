// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const indexHtml = readFileSync(
  resolve(projectRoot, "index.html"),
  "utf8",
);
const bootstrapScript = readFileSync(
  resolve(projectRoot, "public/theme-bootstrap.js"),
  "utf8",
);

function runBootstrap(cached: string | null, systemDark: boolean) {
  const root = {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };
  runInNewContext(bootstrapScript, {
    document: { documentElement: root },
    localStorage: { getItem: () => cached },
    window: { matchMedia: () => ({ matches: systemDark }) },
  });
  return root;
}

describe("theme pre-paint bootstrap contract", () => {
  it("runs a same-origin synchronous script before the app module", () => {
    const bootstrap = '<script src="/theme-bootstrap.js"></script>';
    expect(indexHtml).toContain(bootstrap);
    expect(indexHtml.indexOf(bootstrap)).toBeLessThan(
      indexHtml.indexOf('<script type="module" src="/src/main.ts"></script>'),
    );
  });

  it("keeps the bootstrap before generated CSS and modules in production", async () => {
    const result = await build({
      configFile: resolve(projectRoot, "vite.config.ts"),
      logLevel: "silent",
      build: { write: false },
    });
    if (!("output" in result)) throw new Error("unexpected watch build");
    const htmlAsset = result.output.find(
      (entry) => entry.type === "asset" && entry.fileName === "index.html",
    );
    if (
      !htmlAsset ||
      htmlAsset.type !== "asset" ||
      typeof htmlAsset.source !== "string"
    ) {
      throw new Error("built index.html is missing");
    }
    const bootstrapIndex = htmlAsset.source.indexOf(
      '<script src="/theme-bootstrap.js"></script>',
    );
    expect(bootstrapIndex).toBeGreaterThanOrEqual(0);
    expect(bootstrapIndex).toBeLessThan(htmlAsset.source.indexOf('type="module"'));
    expect(bootstrapIndex).toBeLessThan(htmlAsset.source.indexOf('rel="stylesheet"'));
  });

  it("resolves a cached system preference before CSS or Vue starts", () => {
    expect(runBootstrap("system", true)).toEqual({
      dataset: { theme: "dark" },
      style: { colorScheme: "dark" },
    });
    expect(runBootstrap("system", false)).toEqual({
      dataset: { theme: "light" },
      style: { colorScheme: "light" },
    });
  });

  it("falls back to the approved light theme for an invalid cache", () => {
    expect(runBootstrap("unapproved", true).dataset.theme).toBe("light");
  });
});
