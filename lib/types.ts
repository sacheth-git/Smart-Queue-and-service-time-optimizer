export const ACTIVE_STATUSES = ["waiting", "called", "serving"] as const;
export const FINAL_STATUSES = ["completed", "cancelled", "no_show"] as const;

export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];
export type FinalStatus = (typeof FINAL_STATUSES)[number];
export type TokenStatus = ActiveStatus | FinalStatus;
export type Priority = "urgent" | "priority" | "routine";

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, priority: 1, routine: 2 };
