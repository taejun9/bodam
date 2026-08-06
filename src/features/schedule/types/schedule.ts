export interface ScheduleQuery {
  readonly startOn: string;
  readonly endBefore: string;
}

export interface ScheduleInput {
  readonly title: string;
  readonly scheduledOn: string;
  readonly scheduledTime: string | null;
  readonly memo: string | null;
  readonly customerId: string | null;
  readonly isCompleted: boolean;
}

export interface Schedule extends ScheduleInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ScheduleDeleteResult {
  readonly id: string;
}
