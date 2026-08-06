import { BrowserScheduleRepository } from "./browser-schedule-repository";
import type { ScheduleRepository } from "./schedule-repository";
import { TauriScheduleRepository } from "./tauri-schedule-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createScheduleRepository = (): ScheduleRepository =>
  isTauriRuntime()
    ? new TauriScheduleRepository()
    : new BrowserScheduleRepository();
