import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Priority, TokenStatus } from "@/lib/types";

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  defaultMinutes: integer("default_minutes").notNull(),
});

export const counters = sqliteTable("counters", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => services.id),
  label: text("label").notNull(),
  staffName: text("staff_name"),
  isOpen: integer("is_open").notNull().default(1),
});

export const tokens = sqliteTable(
  "tokens",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    serviceId: text("service_id").notNull().references(() => services.id),
    status: text("status").$type<TokenStatus>().notNull(),
    suggestedPriority: text("suggested_priority").$type<Priority>(),
    reasonsJson: text("reasons_json"),
    itemCodesJson: text("item_codes_json"),
    confirmedPriority: text("confirmed_priority").$type<Priority>().notNull().default("routine"),
    triageReviewedAt: integer("triage_reviewed_at"),
    counterId: text("counter_id").references(() => counters.id),
    checkedInAt: integer("checked_in_at").notNull(),
    calledAt: integer("called_at"),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at"),
    endedEarly: integer("ended_early").notNull().default(0),
    estLowMin: integer("est_low_min"),
    estHighMin: integer("est_high_min"),
    estMidMin: real("est_mid_min"),
    idempotencyKey: text("idempotency_key").unique(),
    phoneLast4: text("phone_last4").notNull(),
    phoneHash: text("phone_hash"),
  },
  (t) => [
    uniqueIndex("tokens_active_phone_service")
      .on(t.phoneHash, t.serviceId)
      .where(sql`status IN ('waiting','called','serving')`),
  ],
);

export const tokenEvents = sqliteTable("token_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenId: text("token_id").notNull().references(() => tokens.id),
  type: text("type").notNull(),
  fromStatus: text("from_status").$type<TokenStatus>(),
  toStatus: text("to_status").$type<TokenStatus>(),
  at: integer("at").notNull(),
  actor: text("actor").notNull(),
});

export const triageDecisions = sqliteTable("triage_decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenCode: text("token_code").notNull(),
  suggested: text("suggested").$type<Priority>(),
  reasonsJson: text("reasons_json"),
  decision: text("decision").$type<Priority>().notNull(),
  overrideReason: text("override_reason"),
  staffLabel: text("staff_label").notNull(),
  at: integer("at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const historicalVisits = sqliteTable("historical_visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceId: text("service_id").notNull().references(() => services.id),
  arrivedAt: integer("arrived_at").notNull(),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at").notNull(),
  weekday: integer("weekday").notNull(),
  hour: integer("hour").notNull(),
  waitMin: real("wait_min").notNull(),
  serviceMin: real("service_min").notNull(),
  countersOpen: integer("counters_open").notNull(),
});

export type Token = typeof tokens.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Counter = typeof counters.$inferSelect;
