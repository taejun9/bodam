// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { defineComponent } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acknowledgeRestoreStartup: vi.fn(),
  checkDaily: vi.fn(),
  exitWithoutBackup: vi.fn(),
  listen: vi.fn(),
  loadStatus: vi.fn(),
  retryExit: vi.fn(),
}));

vi.mock("@/app/composition/backup", () => ({
  backupApplication: {
    nativeAvailable: true,
    acknowledgeRestoreStartup: mocks.acknowledgeRestoreStartup,
    checkDaily: mocks.checkDaily,
    exitWithoutBackup: mocks.exitWithoutBackup,
    loadStatus: mocks.loadStatus,
    retryExit: mocks.retryExit,
  },
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));

import BackupLifecycleGuard from "@/app/lifecycle/BackupLifecycleGuard.vue";
import { BackupApplicationError } from "../types/backup-error";

const cleanStatus = {
  available: true,
  location: { kind: "default" as const, basename: null, available: true },
  lastSuccessfulAt: null,
  automaticCount: 0,
  maxAutomaticCount: 30 as const,
  lastFailure: null,
  restoreStartup: null,
  exitFailurePending: false,
};

const startupStatus = {
  ...cleanStatus,
  restoreStartup: {
    outcome: "restored" as const,
    message: "백업 복원이 완료되었습니다.",
  },
};

const exitStatus = {
  ...cleanStatus,
  lastFailure: "백업 위치를 사용할 수 없습니다.",
  exitFailurePending: true,
};

async function mountGuard(path = "/") {
  const page = defineComponent({ template: "<p>합성 화면</p>" });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: page },
      { path: "/settings", component: page },
    ],
  });
  await router.push(path);
  await router.isReady();
  const ExitDialog = defineComponent({
    props: { open: Boolean, busy: Boolean, error: String },
    template: "<div data-testid='exit-dialog' :data-open='String(open)'>{{ error }}</div>",
  });
  return mount(BackupLifecycleGuard, {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), router],
      stubs: { ExitBackupFailureDialog: ExitDialog },
    },
  });
}

describe("BackupLifecycleGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listen.mockResolvedValue(() => undefined);
    mocks.loadStatus.mockResolvedValue(cleanStatus);
    mocks.acknowledgeRestoreStartup.mockResolvedValue(undefined);
    mocks.checkDaily.mockResolvedValue(cleanStatus);
  });

  afterEach(() => document.body.replaceChildren());

  it("renders loaded startup status before acknowledgement and daily", async () => {
    const order: string[] = [];
    mocks.listen.mockImplementation(async () => {
      order.push("listen");
      return () => undefined;
    });
    mocks.loadStatus.mockImplementation(async () => {
      order.push("load-status");
      return startupStatus;
    });
    mocks.acknowledgeRestoreStartup.mockImplementation(async () => {
      order.push("acknowledge");
      expect(document.body.textContent).toContain(startupStatus.restoreStartup.message);
    });
    mocks.checkDaily.mockImplementation(async () => {
      order.push("daily");
      return cleanStatus;
    });

    const wrapper = await mountGuard("/settings");
    await flushPromises();

    expect(order).toEqual(["listen", "load-status", "acknowledge", "daily"]);
    expect(mocks.loadStatus).toHaveBeenCalledOnce();
    expect(mocks.acknowledgeRestoreStartup).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain(startupStatus.restoreStartup.message);
    wrapper.unmount();
  });

  it("recovers a failed exit from the initial loaded status", async () => {
    mocks.loadStatus.mockResolvedValue(exitStatus);

    const wrapper = await mountGuard();
    await flushPromises();

    expect(wrapper.get("[data-testid='exit-dialog']").attributes("data-open"))
      .toBe("true");
    expect(document.body.textContent).not.toContain(exitStatus.lastFailure);
    wrapper.unmount();
  });

  it("preserves an acknowledged startup notice when the daily check rejects", async () => {
    mocks.loadStatus.mockResolvedValue(startupStatus);
    mocks.checkDaily.mockRejectedValue(new BackupApplicationError("합성 daily 실패"));

    const wrapper = await mountGuard();
    await flushPromises();

    expect(document.body.textContent).toContain(startupStatus.restoreStartup.message);
    expect(document.body.textContent).not.toContain("합성 daily 실패");
    wrapper.unmount();
  });

  it("preserves the startup notice and retries a failed acknowledgement", async () => {
    const order: string[] = [];
    mocks.loadStatus.mockImplementation(async () => {
      order.push("load-status");
      return startupStatus;
    });
    mocks.acknowledgeRestoreStartup
      .mockImplementationOnce(async () => {
        order.push("acknowledge-1");
        throw new BackupApplicationError("합성 ack 실패");
      })
      .mockImplementationOnce(async () => { order.push("acknowledge-2"); });
    mocks.checkDaily.mockImplementation(async () => {
      order.push("daily");
      return cleanStatus;
    });

    const wrapper = await mountGuard();
    await flushPromises();

    expect(order).toEqual([
      "load-status",
      "acknowledge-1",
      "daily",
      "load-status",
      "acknowledge-2",
    ]);
    expect(document.body.textContent).toContain(startupStatus.restoreStartup.message);
    expect(document.body.textContent).not.toContain("합성 ack 실패");
    wrapper.unmount();
  });

  it("keeps a persistently failed acknowledgement retryable after focus", async () => {
    mocks.loadStatus.mockResolvedValue(startupStatus);
    mocks.acknowledgeRestoreStartup.mockRejectedValue(
      new BackupApplicationError("합성 ack 실패"),
    );

    const wrapper = await mountGuard();
    await flushPromises();

    expect(mocks.loadStatus).toHaveBeenCalledTimes(2);
    expect(mocks.acknowledgeRestoreStartup).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain(startupStatus.restoreStartup.message);

    window.dispatchEvent(new Event("focus"));
    await flushPromises();

    expect(mocks.loadStatus).toHaveBeenCalledTimes(3);
    expect(mocks.acknowledgeRestoreStartup).toHaveBeenCalledTimes(3);
    expect(document.body.textContent).toContain(startupStatus.restoreStartup.message);
    wrapper.unmount();
  });

  it("retries a busy initial load after daily and recovers startup status", async () => {
    const order: string[] = [];
    mocks.listen.mockImplementation(async () => {
      order.push("listen");
      return () => undefined;
    });
    mocks.loadStatus
      .mockImplementationOnce(async () => {
        order.push("load-status-1");
        throw new BackupApplicationError("합성 busy", "busy");
      })
      .mockImplementationOnce(async () => {
        order.push("load-status-2");
        return startupStatus;
      });
    mocks.acknowledgeRestoreStartup.mockImplementation(async () => {
      order.push("acknowledge");
    });
    mocks.checkDaily.mockImplementation(async () => {
      order.push("daily");
      return cleanStatus;
    });

    const wrapper = await mountGuard();
    await flushPromises();

    expect(order).toEqual([
      "listen",
      "load-status-1",
      "daily",
      "load-status-2",
      "acknowledge",
    ]);
    expect(mocks.loadStatus).toHaveBeenCalledTimes(2);
    expect(mocks.acknowledgeRestoreStartup).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain(startupStatus.restoreStartup.message);
    wrapper.unmount();
  });

  it("coalesces focus recovery with an in-flight initial status load", async () => {
    let resolveLoad!: (value: typeof cleanStatus) => void;
    const pendingLoad = new Promise<typeof cleanStatus>((resolve) => { resolveLoad = resolve; });
    mocks.loadStatus.mockImplementation(() => pendingLoad);

    const wrapper = await mountGuard();
    await flushPromises();
    window.dispatchEvent(new Event("focus"));
    await flushPromises();

    expect(mocks.loadStatus).toHaveBeenCalledOnce();
    resolveLoad(cleanStatus);
    await flushPromises();
    expect(mocks.loadStatus).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("still performs the daily check when initial status loading fails", async () => {
    mocks.loadStatus.mockRejectedValue(new Error("synthetic load failure"));
    mocks.checkDaily.mockResolvedValue(exitStatus);

    const wrapper = await mountGuard();
    await flushPromises();

    expect(mocks.checkDaily).toHaveBeenCalledOnce();
    expect(wrapper.get("[data-testid='exit-dialog']").attributes("data-open"))
      .toBe("true");
    wrapper.unmount();
  });
});
