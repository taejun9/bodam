/// <reference types="node" />

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const featureDirectory = resolve(testDirectory, "..");
const assetsDirectory = resolve(testDirectory, "../../../assets");
const themeCss = readFileSync(resolve(assetsDirectory, "theme.css"), "utf8");
const shellCss = readFileSync(resolve(assetsDirectory, "shell.css"), "utf8");
const appDialogVue = readFileSync(
  resolve(testDirectory, "../../../shared/components/AppDialog.vue"),
  "utf8",
);

function styleSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return styleSources(path);
    return /\.(css|vue)$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
  });
}

function cssBlock(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  const end = start < 0 ? -1 : source.indexOf("}", start);
  if (start < 0 || end < 0) throw new Error(`missing CSS block: ${selector}`);
  return source.slice(start, end);
}

function color(block: string, variable: string): string {
  const match = new RegExp(`--${variable}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  if (!match?.[1]) throw new Error(`missing CSS color: ${variable}`);
  return match[1];
}

function linearChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    linearChannel(Number.parseInt(hex.slice(offset, offset + 2), 16))
  );
  return 0.2126 * (channels[0] ?? 0)
    + 0.7152 * (channels[1] ?? 0)
    + 0.0722 * (channels[2] ?? 0);
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

describe("data exchange visual contracts", () => {
  it("uses an AA text token for supporting text on every theme surface", () => {
    expect(styleSources(featureDirectory).join("\n")).not.toContain("var(--text-muted)");
    expect(cssBlock(appDialogVue, ".dialog-header p")).toContain("var(--text-secondary)");
    expect(cssBlock(shellCss, ".page-heading p")).toContain("var(--text-secondary)");

    for (const selector of [":root", ':root[data-theme="dark"]']) {
      const theme = cssBlock(themeCss, selector);
      const foreground = color(theme, "text-secondary");
      for (const background of ["bg-app", "bg-surface", "bg-subtle", "bg-muted"]) {
        expect(contrastRatio(foreground, color(theme, background)))
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("bounds long customer and source reference wrappers at narrow widths", () => {
    const previewCss = readFileSync(
      resolve(featureDirectory, "components/data-exchange-preview.css"),
      "utf8",
    );
    const dialogVue = readFileSync(
      resolve(featureDirectory, "components/DataExchangeNewCustomerDialog.vue"),
      "utf8",
    );

    for (const rule of [
      cssBlock(previewCss, ".new-customer-summary .new-customer-name"),
      cssBlock(dialogVue, ".reference-names .reference-value"),
    ]) {
      expect(rule).toContain("min-width: 0");
      expect(rule).toContain("max-width: 100%");
      expect(rule).toContain("overflow-wrap: anywhere");
    }
  });

  it("keeps export counts and long basenames bounded at 390px in both themes", () => {
    const exportCss = readFileSync(
      resolve(featureDirectory, "components/contract-export-panel.css"),
      "utf8",
    );

    expect(cssBlock(exportCss, ".contract-export-panel")).toContain("min-width: 0");
    expect(cssBlock(exportCss, ".export-summary"))
      .toContain("repeat(3, minmax(0, 1fr))");
    expect(cssBlock(exportCss, ".export-result p")).toContain("overflow-wrap: anywhere");
    expect(exportCss).toContain("@media (max-width: 420px)");
    expect(exportCss).toContain(".export-actions {\n    grid-template-columns: 1fr;");
    expect(exportCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
