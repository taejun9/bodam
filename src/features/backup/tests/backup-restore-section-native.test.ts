// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackupApplicationError } from "../types/backup-error";

const mocks = vi.hoisted(() => ({
  checkDaily: vi.fn(),
  chooseDirectory: vi.fn(),
  chooseRestore: vi.fn(),
  clear: vi.fn(),
  createManual: vi.fn(),
  discardRestore: vi.fn(),
  loadStatus: vi.fn(),
  prepareRestore: vi.fn(),
  restartForRestore: vi.fn(),
  useDefaultDirectory: vi.fn(),
}));

vi.mock("@/app/composition/backup", () => ({
  backupApplication: { nativeAvailable: true, ...mocks },
}));

import BackupRestoreSection from "../components/BackupRestoreSection.vue";

const status = {
  available: true,
  location: { kind: "custom" as const, basename: "합성 백업", available: true },
  lastSuccessfulAt: null,
  automaticCount: 1,
  maxAutomaticCount: 30 as const,
  lastFailure: null,
  restoreStartup: null,
  exitFailurePending: false,
};

const preview = {
  token: "12000000-0000-4000-8000-000000000001",
  basename: "synthetic.bodam-backup",
  createdAt: "2026-08-07T03:00:00.000Z",
  appVersion: "0.1.0",
  schemaVersion: "20260806080000_add_app_settings",
  reason: "manual" as const,
};

const buttonWithText = (text: string): HTMLButtonElement => {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
};

describe("BackupRestoreSection native interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkDaily.mockResolvedValue(status);
    mocks.chooseDirectory.mockResolvedValue(status);
    mocks.chooseRestore.mockResolvedValue(preview);
    mocks.discardRestore.mockResolvedValue(undefined);
  });

  afterEach(() => document.body.replaceChildren());

  it("announces and focuses a successful custom directory change", async () => {
    const wrapper = mount(BackupRestoreSection, { attachTo: document.body });
    await flushPromises();

    buttonWithText("백업 폴더 변경").click();
    await flushPromises();

    expect(wrapper.text()).toContain("백업 폴더를 변경했습니다");
    expect(document.activeElement).toBe(
      wrapper.get("[data-testid='backup-status']").element,
    );
    wrapper.unmount();
  });

  it("restores focus after retrying a status load", async () => {
    mocks.checkDaily
      .mockRejectedValueOnce(new BackupApplicationError("합성 상태 실패"))
      .mockResolvedValueOnce(status);
    const wrapper = mount(BackupRestoreSection, { attachTo: document.body });
    await flushPromises();

    buttonWithText("다시 확인").click();
    await flushPromises();

    expect(document.activeElement).toBe(
      wrapper.get("[data-testid='backup-status']").element,
    );
    wrapper.unmount();
  });

  it("keeps the restore dialog locked and visible until discard succeeds", async () => {
    let rejectDiscard!: (reason: unknown) => void;
    const pendingDiscard = new Promise<void>((_resolve, reject) => {
      rejectDiscard = reject;
    });
    mocks.discardRestore
      .mockImplementationOnce(() => pendingDiscard)
      .mockResolvedValueOnce(undefined);
    const wrapper = mount(BackupRestoreSection, { attachTo: document.body });
    await flushPromises();
    buttonWithText("백업에서 복원").click();
    await flushPromises();

    buttonWithText("취소").click();
    await flushPromises();
    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.open).toBe(true);
    expect(buttonWithText("선택을 취소하는 중").disabled).toBe(true);
    expect(buttonWithText("복원하고 다시 시작").disabled).toBe(true);

    rejectDiscard(new BackupApplicationError("복원 준비 파일을 정리하지 못했습니다."));
    await flushPromises();
    expect(dialog?.open).toBe(true);
    expect(document.body.textContent).toContain("복원 준비 파일을 정리하지 못했습니다");

    buttonWithText("취소").click();
    await flushPromises();
    expect(dialog?.open).toBe(false);
    expect(mocks.discardRestore).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
