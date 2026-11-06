import { PRIORITY_RANK, type Priority } from "@/lib/types";

type QueueSortable = { code: string; confirmedPriority: Priority; checkedInAt: number };

/** Only the priority confirmed by staff affects order, never the suggestion. */
export function sortQueue<T extends QueueSortable>(tokens: T[]): T[] {
  return [...tokens].sort(
    (a, b) =>
      PRIORITY_RANK[a.confirmedPriority] - PRIORITY_RANK[b.confirmedPriority] ||
      a.checkedInAt - b.checkedInAt ||
      a.code.localeCompare(b.code),
  );
}

/** Flags a long routine wait for a person to look at. It never moves the token. */
export function needsWaitReview(token: QueueSortable, now: number, thresholdMin = 45): boolean {
  return token.confirmedPriority === "routine" && now - token.checkedInAt >= thresholdMin * 60_000;
}
