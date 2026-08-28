// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  assertThemeBootstrapOrder,
  THEME_BOOTSTRAP_TAG,
} from "../../../../build/theme-bootstrap-contract";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const indexHtml = readFileSync(
  resolve(projectRoot, "index.html"),
  "utf8",
);
const bootstrapScript = readFileSync(
  resolve(projectRoot, "public/theme-bootstrap.js"),
  "utf8",
);

function runBootstrap(
  cached: string | null,
  systemDark: boolean,
  failure?: "storage" | "media",
) {
  const root = {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };
  runInNewContext(bootstrapScript, {
    document: { documentElement: root },
    localStorage: { getItem: () => {
      if (failure === "storage") throw new Error("synthetic storage failure");
      return cached;
    } },
    window: { matchMedia: () => {
      if (failure === "media") throw new Error("synthetic media failure");
      return { matches: systemDark };
    } },
  });
  return root;
}

describe("theme pre-paint bootstrap contract", () => {
  it("runs a same-origin synchronous script before the app module", () => {
    expect(indexHtml).toContain(THEME_BOOTSTRAP_TAG);
    expect(indexHtml.indexOf(THEME_BOOTSTRAP_TAG)).toBeLessThan(
      indexHtml.indexOf('<script type="module" src="/src/main.ts"></script>'),
    );
  });

  it("accepts only the generated production order", async () => {
    const productionHtml = (head: string) =>
      `<!doctype html><html><head>${head}</head><body></body></html>`;
    const expectRejected = async (html: string, message: string) => {
      await expect(assertThemeBootstrapOrder(html)).rejects.toThrow(message);
    };
    const validHead = '<script src="/theme-bootstrap.js"></script>\r\n' +
      '<script crossorigin type="module" src="/assets/app.js"></script>\r\n' +
      '<link crossorigin rel="stylesheet" href="/assets/app.css">';
    const valid = productionHtml(validHead);
    await expect(assertThemeBootstrapOrder(valid)).resolves.toBeUndefined();

    const moduleBefore = productionHtml(
      '<script type="module" src="/assets/app.js"></script>' +
      THEME_BOOTSTRAP_TAG +
      '<link rel="stylesheet" href="/assets/app.css">',
    );
    await expectRejected(
      moduleBefore,
      "theme bootstrap must execute before modules and stylesheets",
    );
    const stylesheetBefore = productionHtml(
      '<link rel="stylesheet" href="/assets/app.css">' +
      THEME_BOOTSTRAP_TAG +
      '<script type="module" src="/assets/app.js"></script>',
    );
    await expectRejected(
      stylesheetBefore,
      "theme bootstrap must execute before modules and stylesheets",
    );
    for (const earlyAsset of [
      '<link rel="stylesheet" href="/early.css">',
      '<link rel="stylesheet" href="https://cdn.invalid/early.css">',
      '<script type="module" src="/early.js"></script>',
    ]) {
      await expectRejected(
        productionHtml(earlyAsset + validHead),
        "theme bootstrap must execute before modules and stylesheets",
      );
    }
    await expectRejected(
      "<html></html>",
      "theme bootstrap must be a synchronous external script",
    );
    await expectRejected(
      productionHtml(validHead + THEME_BOOTSTRAP_TAG),
      "production HTML must contain one theme bootstrap",
    );
    await expectRejected(
      valid.replace("</body>", `${THEME_BOOTSTRAP_TAG}</body>`),
      "production HTML must contain one theme bootstrap",
    );
    for (const attribute of ["defer", "async", 'type="module"']) {
      const nonBlocking = valid.replace(THEME_BOOTSTRAP_TAG,
        `<script ${attribute} src="/theme-bootstrap.js"></script>`);
      await expectRejected(
        nonBlocking,
        "theme bootstrap must remain parser-blocking",
      );
    }
    await expectRejected(
      productionHtml(THEME_BOOTSTRAP_TAG),
      "production HTML must contain its module and stylesheet",
    );

    const generatedAssets =
      '<script type="module" src="/assets/app.js"></script>' +
      '<link rel="stylesheet" href="/assets/app.css">';
    await expectRejected(
      productionHtml(
        '<script data-src="/theme-bootstrap.js"></script>' + generatedAssets,
      ),
      "theme bootstrap must be a synchronous external script",
    );
    await expectRejected(
      productionHtml(
        '<script nomodule src="/theme-bootstrap.js"></script>' + generatedAssets,
      ),
      "theme bootstrap must remain parser-blocking",
    );
    await expectRejected(
      productionHtml(`<!-- ${THEME_BOOTSTRAP_TAG} -->${generatedAssets}`),
      "theme bootstrap must be a synchronous external script",
    );
    await expectRejected(
      productionHtml(THEME_BOOTSTRAP_TAG +
        '<script data-type="module"></script><link data-rel="stylesheet">'),
      "production HTML must contain its module and stylesheet",
    );
    await expectRejected(
      productionHtml(THEME_BOOTSTRAP_TAG +
        '<script type="module"></script><link rel="stylesheet">'),
      "production HTML must contain its module and stylesheet",
    );
    for (const inertBootstrap of [
      `<template>${THEME_BOOTSTRAP_TAG}</template>`,
      `<textarea>${THEME_BOOTSTRAP_TAG}</textarea>`,
      `<iframe srcdoc='${THEME_BOOTSTRAP_TAG}'></iframe>`,
    ]) {
      await expectRejected(
        productionHtml(inertBootstrap + generatedAssets),
        "theme bootstrap must be a synchronous external script",
      );
    }
    await expectRejected(
      productionHtml(THEME_BOOTSTRAP_TAG +
        `<script>const marker = ' type="module"';</script>` +
        '<link rel="stylesheet" href="/assets/app.css">'),
      "production HTML must contain its module and stylesheet",
    );
    await expectRejected(
      productionHtml(THEME_BOOTSTRAP_TAG +
        '<script type="module" src="/assets/app.js"></script>' +
        '<link data-note=" rel=stylesheet">'),
      "production HTML must contain its module and stylesheet",
    );
    await expectRejected(
      productionHtml(THEME_BOOTSTRAP_TAG +
        `<template>${generatedAssets}</template>`),
      "production HTML must contain its module and stylesheet",
    );
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
    expect(runBootstrap("dark", false).dataset.theme).toBe("dark");
    expect(runBootstrap("light", true).dataset.theme).toBe("light");
    expect(runBootstrap("unapproved", true).dataset.theme).toBe("light");
    expect(runBootstrap("system", true, "storage").dataset.theme).toBe("light");
    expect(runBootstrap("system", true, "media").dataset.theme).toBe("light");
  });
});
