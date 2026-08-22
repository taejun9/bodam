/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const assetsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");
const customerTableCss = readFileSync(
  resolve(assetsDirectory, "customer-table.css"),
  "utf8",
).replace(/\r\n?/g, "\n");

function cssBlock(selector: string): string {
  const start = customerTableCss.indexOf(`${selector} {`);
  const end = start < 0 ? -1 : customerTableCss.indexOf("}", start);
  if (start < 0 || end < 0) throw new Error(`missing CSS block: ${selector}`);
  return customerTableCss.slice(start, end);
}

describe("customer visual contracts", () => {
  it("wraps an unbroken customer name inside the 390px card layout", () => {
    expect(customerTableCss).toContain("@media (max-width: 720px)");
    expect(cssBlock(".customer-card-identity")).toContain("min-width: 0");
    expect(cssBlock(".customer-card-identity > span:last-child")).toContain("min-width: 0");
    expect(cssBlock(".customer-card header strong")).toContain("overflow-wrap: anywhere");
  });
});
