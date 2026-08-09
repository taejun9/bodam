import { describe, expect, it } from "vitest";

import router from "@/app/router";

describe("app router scroll behavior", () => {
  const scrollBehavior = router.options.scrollBehavior;
  const routeAt = (path: string) => ({ ...router.currentRoute.value, path });

  it("opens a different workspace at the page start", () => {
    expect(scrollBehavior).toBeTypeOf("function");

    expect(scrollBehavior?.(routeAt("/settings"), routeAt("/calendar"), null)).toEqual({
      left: 0,
      top: 0,
    });
  });

  it("keeps position for query-only changes inside the same workspace", () => {
    expect(
      scrollBehavior?.(routeAt("/calendar"), routeAt("/calendar"), null),
    ).toBe(false);
  });

  it("restores the saved browser history position", () => {
    const currentRoute = router.currentRoute.value;
    const savedPosition = { left: 12, top: 640 };

    expect(scrollBehavior?.(currentRoute, currentRoute, savedPosition)).toBe(savedPosition);
  });
});
