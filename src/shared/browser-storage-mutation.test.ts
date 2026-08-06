import { describe, expect, it } from "vitest";

import {
  BROWSER_STORAGE_MUTATION_LOCK_NAME,
  type BrowserLockManager,
  withBrowserStorageMutation,
} from "./browser-storage-mutation";

class QueuedLockManager implements BrowserLockManager {
  readonly requestedNames: string[] = [];
  private tail: Promise<void> = Promise.resolve();

  request<T>(name: string, callback: () => Promise<T>): Promise<T> {
    this.requestedNames.push(name);
    const result = this.tail.then(callback, callback);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

describe("Browser storage origin lock", () => {
  it("uses one fixed Web Lock across distinct tab storage identities", async () => {
    const lockManager = new QueuedLockManager();
    const events: string[] = [];
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = withBrowserStorageMutation({}, async () => {
      events.push("first:start");
      await gate;
      events.push("first:end");
    }, lockManager);
    await Promise.resolve();
    const second = withBrowserStorageMutation({}, async () => {
      events.push("second:start");
      events.push("second:end");
    }, lockManager);
    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    release();
    await Promise.all([first, second]);
    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
    expect(lockManager.requestedNames).toEqual([
      BROWSER_STORAGE_MUTATION_LOCK_NAME,
      BROWSER_STORAGE_MUTATION_LOCK_NAME,
    ]);
  });
});
