/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const componentDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../components",
);

function readStyleSource(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

const css = readStyleSource(
  resolve(componentDirectory, "app-settings-section.css"),
);

function cssBlock(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = start < 0 ? -1 : css.indexOf("}", start);
  if (start < 0 || end < 0) throw new Error(`missing CSS block: ${selector}`);
  return css.slice(start, end);
}

describe("app settings visual contract", () => {
  it("uses semantic supporting text and no theme-specific color literals", () => {
    expect(css).not.toContain("var(--text-muted)");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(css).toContain(".app-settings-header p,");
    expect(css).toContain("color: var(--text-secondary)");
  });

  it("bounds preference columns and stacks controls for a 390px viewport", () => {
    expect(cssBlock(".app-settings-section")).toContain("min-width: 0");
    expect(cssBlock(".dashboard-preferences"))
      .toContain("repeat(3, minmax(0, 1fr))");
    expect(cssBlock(".theme-options"))
      .toContain("repeat(3, minmax(0, 1fr))");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain(".dashboard-preferences {\n    grid-template-columns: 1fr;");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain(".theme-options {\n    grid-template-columns: 1fr;");
  });
});
