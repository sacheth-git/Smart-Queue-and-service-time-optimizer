import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { counters, services, tokens, type Token } from "@/lib/db/schema";
import { serviceStats } from "@/lib/estimate/stats";
import { effectiveAhead, estimateWait, type WaitEstimate } from "@/lib/estimate/wait";
import { ACTIVE_STATUSES, PRIORITY_RANK, type Priority, type TokenStatus } from "@/lib/types";
import { needsWaitReview, sortQueue } from "./order";

const activeTokens = (db: Db, serviceId: string) =>
  db
    .select()
    .from(tokens)
    .where(and(eq(tokens.serviceId, serviceId), inArray(tokens.status, [...ACTIVE_STATUSES])))
    .all();

/** People already at a counter come first, then the waiting queue in staff-confirmed order. */
function orderedActive(db: Db, serviceId: string): Token[] {
  const active = activeTokens(db, serviceId);
  return [
    ...active.filter((t) => t.status === "serving"),
    ...active.filter((t) => t.status === "called"),
    ...sortQueue(active.filter((t) => t.status === "waiting")),
  ];
}

const openCounterCount = (db: Db, serviceId: string) =>
  db
    .select()
    .from(counters)
    .where(and(eq(counters.serviceId, serviceId), eq(counters.isOpen, 1)))
    .all().length;

export function estimateForToken(db: Db, token: Token, now: number): WaitEstimate {
  const ordered = orderedActive(db, token.serviceId);
  const before = ordered.slice(0, Math.max(0, ordered.findIndex((t) => t.id === token.id)));
  const atCounter = before.filter((t) => t.status !== "waiting").length;
  const { mean, sd } = serviceStats(db, token.serviceId, now);
  return estimateWait({
    ahead: effectiveAhead(before.length - atCounter, atCounter),
    openCounters: openCounterCount(db, token.serviceId),
    mean,
    sd,
  });
}

export type PublicTokenView = {
  code: string;
  serviceName: string;
  status: TokenStatus;
  position: number | null;
  estimate: WaitEstimate | null;
  counterLabel: string | null;
  isFinal: boolean;
};

/** Patient-facing. Built field by field so that triage data can never leak here. */
export function tokenView(db: Db, code: string, now: number): PublicTokenView | null {
  const token = db.select().from(tokens).where(eq(tokens.code, code)).get();
  if (!token) return null;
  const service = db.select().from(services).where(eq(services.id, token.serviceId)).get()!;
  const counter = token.counterId
    ? db.select().from(counters).where(eq(counters.id, token.counterId)).get()
    : undefined;
  const waiting = token.status === "waiting";
  const line = waiting ? orderedActive(db, token.serviceId).filter((t) => t.status === "waiting") : [];
  return {
    code: token.code,
    serviceName: service.name,
    status: token.status,
    position: waiting ? line.findIndex((t) => t.id === token.id) + 1 : null,
    estimate: waiting ? estimateForToken(db, token, now) : null,
    counterLabel: counter?.label ?? null,
    isFinal: !(ACTIVE_STATUSES as readonly string[]).includes(token.status),
  };
}

export type DisplayService = {
  serviceId: string;
  serviceName: string;
  nowServing: { code: string; counterLabel: string }[];
  upNext: string[];
};

/** Public board. Token codes and counters only. */
export function displayView(db: Db): DisplayService[] {
  return db
    .select()
    .from(services)
    .all()
    .map((service) => {
      const ordered = orderedActive(db, service.id);
      const labels = new Map(
        db
          .select()
          .from(counters)
          .where(eq(counters.serviceId, service.id))
          .all()
          .map((c) => [c.id, c.label]),
      );
      return {
        serviceId: service.id,
        serviceName: service.name,
        nowServing: ordered
          .filter((t) => t.status !== "waiting")
          .map((t) => ({ code: t.code, counterLabel: labels.get(t.counterId!) ?? "" })),
        upNext: ordered
          .filter((t) => t.status === "waiting")
          .slice(0, 6)
          .map((t) => t.code),
      };
    });
}

export type StaffQueueRow = {
  id: string;
  code: string;
  status: TokenStatus;
  confirmedPriority: Priority;
  suggestedPriority: Priority | null;
  reasons: string[];
  phoneLast4: string;
  waitedMin: number;
  needsWaitReview: boolean;
};

export type StaffCounter = {
  id: string;
  label: string;
  isOpen: boolean;
  token: StaffQueueRow | null;
};

export type StaffService = {
  id: string;
  name: string;
  counters: StaffCounter[];
  queue: StaffQueueRow[];
  estimate: WaitEstimate;
};

export type StaffView = { services: StaffService[]; pendingReview: StaffQueueRow[] };

function toRow(token: Token, now: number): StaffQueueRow {
  return {
    id: token.id,
    code: token.code,
    status: token.status,
    confirmedPriority: token.confirmedPriority,
    suggestedPriority: token.suggestedPriority,
    reasons: JSON.parse(token.reasonsJson ?? "[]"),
    phoneLast4: token.phoneLast4,
    waitedMin: Math.max(0, Math.round((now - token.checkedInAt) / 60_000)),
    needsWaitReview: token.status === "waiting" && needsWaitReview(token, now),
  };
}

export function staffView(db: Db, now: number): StaffView {
  const allServices = db.select().from(services).all();
  const pending: Token[] = [];

  const result = allServices.map((service): StaffService => {
    const ordered = orderedActive(db, service.id);
    const waiting = ordered.filter((t) => t.status === "waiting");
    pending.push(...ordered.filter((t) => t.suggestedPriority && t.triageReviewedAt === null));
    const { mean, sd } = serviceStats(db, service.id, now);
    const list = db.select().from(counters).where(eq(counters.serviceId, service.id)).all();
    return {
      id: service.id,
      name: service.name,
      counters: list.map((c) => {
        const held = ordered.find((t) => t.counterId === c.id);
        return { id: c.id, label: c.label, isOpen: c.isOpen === 1, token: held ? toRow(held, now) : null };
      }),
      queue: waiting.map((t) => toRow(t, now)),
      estimate: estimateWait({
        ahead: effectiveAhead(waiting.length, ordered.length - waiting.length),
        openCounters: list.filter((c) => c.isOpen).length,
        mean,
        sd,
      }),
    };
  });

  pending.sort(
    (a, b) =>
      PRIORITY_RANK[a.suggestedPriority!] - PRIORITY_RANK[b.suggestedPriority!] ||
      a.checkedInAt - b.checkedInAt,
  );
  return { services: result, pendingReview: pending.map((t) => toRow(t, now)) };
}
