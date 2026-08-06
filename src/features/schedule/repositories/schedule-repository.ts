import type {
  Schedule,
  ScheduleInput,
  ScheduleQuery,
} from "../types/schedule";

export interface ScheduleRepository {
  list(query: ScheduleQuery): Promise<Schedule[]>;
  create(input: ScheduleInput): Promise<Schedule>;
  update(id: string, input: ScheduleInput): Promise<Schedule>;
  setCompleted(id: string, isCompleted: boolean): Promise<Schedule>;
  remove(id: string): Promise<void>;
}
