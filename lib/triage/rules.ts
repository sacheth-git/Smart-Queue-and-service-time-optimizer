import { DomainError } from "@/lib/errors";
import { PRIORITY_RANK, type Priority } from "@/lib/types";

/** Illustrative demo rules. Not clinically validated. Staff always make the decision. */
export const ITEMS: { code: string; label: string; level: Exclude<Priority, "routine"> }[] = [
  { code: "chest_pain", label: "Chest pain", level: "urgent" },
  { code: "difficulty_breathing", label: "Difficulty breathing", level: "urgent" },
  { code: "heavy_bleeding", label: "Heavy bleeding", level: "urgent" },
  { code: "high_fever", label: "High fever", level: "priority" },
  { code: "pregnant", label: "Pregnant", level: "priority" },
  { code: "under_2", label: "Under 2 years old", level: "priority" },
  { code: "over_75", label: "Over 75 years old", level: "priority" },
];

export function assertKnownItems(codes: string[]): void {
  for (const code of codes) {
    if (!ITEMS.some((i) => i.code === code)) {
      throw new DomainError("unknown_item", "That option is not recognised.", 400);
    }
  }
}

export function suggestPriority(codes: string[]): { level: Priority; reasons: string[] } | null {
  assertKnownItems(codes);
  const matched = codes.map((c) => ITEMS.find((i) => i.code === c)!);
  if (matched.length === 0) return null;
  const level = matched.reduce<Priority>(
    (best, i) => (PRIORITY_RANK[i.level] < PRIORITY_RANK[best] ? i.level : best),
    "routine",
  );
  return { level, reasons: matched.map((i) => i.label) };
}
