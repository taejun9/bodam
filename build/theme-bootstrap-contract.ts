import { Window } from "happy-dom";
import type { Plugin } from "vite";

export const THEME_BOOTSTRAP_TAG =
  '<script src="/theme-bootstrap.js"></script>';

type HeadElement = {
  href: string | null;
  html: string;
  index: number;
  name: string;
  rel: string[];
  src: string | null;
  type: string | null;
};

type ParsedHtml = {
  headElements: HeadElement[];
  themeBootstrapScriptCount: number;
};

async function parseHtml(html: string): Promise<ParsedHtml> {
  const window = new Window({
    url: "https://bodam.invalid/",
    settings: {
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
    },
  });
  try {
    const document = new window.DOMParser().parseFromString(html, "text/html");
    return {
      headElements: [...document.head.children].map((element, index) => ({
        href: element.getAttribute("href"),
        html: element.outerHTML,
        index,
        name: element.localName,
        rel: element.getAttribute("rel")?.toLowerCase().split(/\s+/) ?? [],
        src: element.getAttribute("src"),
        type: element.getAttribute("type")?.toLowerCase() ?? null,
      })),
      themeBootstrapScriptCount: [...document.querySelectorAll("script")]
        .filter((element) => element.getAttribute("src") === "/theme-bootstrap.js")
        .length,
    };
  } finally {
    await window.happyDOM.close();
  }
}

export async function assertThemeBootstrapOrder(html: string): Promise<void> {
  const { headElements, themeBootstrapScriptCount } = await parseHtml(html);
  const bootstrapTags = headElements.filter(
    (element) => element.name === "script" &&
      element.src === "/theme-bootstrap.js",
  );
  const bootstrap = bootstrapTags[0];
  const moduleTags = headElements.filter(
    (element) => element.name === "script" && element.type === "module",
  );
  const stylesheetTags = headElements.filter(
    (element) => element.name === "link" && element.rel.includes("stylesheet"),
  );
  const firstModuleTag = moduleTags[0];
  const firstStylesheetTag = stylesheetTags[0];
  const generatedModuleTag = moduleTags.find(
    (element) =>
      element.src?.startsWith("/assets/") &&
      element.src.endsWith(".js"),
  );
  const generatedStylesheetTag = stylesheetTags.find(
    (element) =>
      element.href?.startsWith("/assets/") &&
      element.href.endsWith(".css"),
  );

  if (!bootstrap) {
    throw new Error("theme bootstrap must be a synchronous external script");
  }
  if (bootstrapTags.length !== 1 || themeBootstrapScriptCount !== 1) {
    throw new Error("production HTML must contain one theme bootstrap");
  }
  if (bootstrap.html !== THEME_BOOTSTRAP_TAG) {
    throw new Error("theme bootstrap must remain parser-blocking");
  }
  if (
    !generatedModuleTag ||
    !generatedStylesheetTag ||
    !firstModuleTag ||
    !firstStylesheetTag
  ) {
    throw new Error("production HTML must contain its module and stylesheet");
  }
  if (
    bootstrap.index > firstModuleTag.index ||
    bootstrap.index > firstStylesheetTag.index
  ) {
    throw new Error("theme bootstrap must execute before modules and stylesheets");
  }
}

export function themeBootstrapContractPlugin(): Plugin {
  return {
    name: "bodam-theme-bootstrap-contract",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      async handler(html) {
        await assertThemeBootstrapOrder(html);
        return html;
      },
    },
  };
}
