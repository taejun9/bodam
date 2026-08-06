/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const assetsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");
const asset = (name: string): string =>
  readFileSync(resolve(assetsDirectory, name), "utf8");
const dashboardCardCss = asset("dashboard-card.css");
const dashboardPageCss = asset("dashboard-page.css");
const themeCss = asset("theme.css");

function cssBlock(selector: string): string {
  const start = themeCss.indexOf(`${selector} {`);
  const end = start < 0 ? -1 : themeCss.indexOf("}", start);
  if (start < 0 || end < 0) {
    throw new Error(`missing CSS block: ${selector}`);
  }
  return themeCss.slice(start, end);
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

describe("dashboard text contrast", () => {
  it("uses the AA secondary token for every dashboard supporting-text surface", () => {
    expect(dashboardCardCss).not.toContain("var(--text-muted)");
    expect(dashboardPageCss).not.toContain("var(--text-muted)");

    for (const selector of [":root", ':root[data-theme="dark"]']) {
      const block = cssBlock(selector);
      const foreground = color(block, "text-secondary");
      for (const background of ["bg-app", "bg-surface", "bg-subtle", "bg-muted"]) {
        expect(contrastRatio(foreground, color(block, background))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
