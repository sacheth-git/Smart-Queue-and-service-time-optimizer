# PulseQueue AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A demo-ready hospital OPD queue website covering all five PS-13 outcomes and all five constraints, with staff-confirmed urgency triage.

**Architecture:** One Next.js app on a local SQLite file. Pure logic in `lib/` is built and tested first, then thin API routes, then polling screens. Every token status change passes through one transition function that writes an event, and analytics read those events.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui, lucide-react, Recharts, better-sqlite3, Drizzle ORM, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-pulsequeue-design.md`

**Time budget (about 9.5 hours of work, 2.5 hours of buffer):**

| Task | Hours |
|---|---|
| 1 Scaffold and database | 1.0 |
| 2 Tokens and state machine | 1.0 |
| 3 Triage and ordering | 0.75 |
| 4 Wait estimate and queue views | 0.75 |
| 5 Seed and demo controls | 1.0 |
| 6 API and shared UI | 0.75 |
| 7 Check-in and token pages | 0.75 |
| 8 Display and staff console | 1.0 |
| 9 Analytics logic | 1.0 |
| 10 Admin dashboard | 0.75 |
| 11 Landing, polish, demo run-through | 0.75 |

## Global Constraints

- `CLAUDE.md` rules 1 to 6 apply to every task.
- No status write outside `lib/queue/transitions.ts`, including in the seed.
- Priority levels are `urgent`, `priority`, `routine`. Every token starts with `confirmed_priority = 'routine'`.
- Patient and public payloads and screens never contain `suggested_priority`, `confirmed_priority`, reasons or item codes.
- Allowed labels: `Measured in demo`, `Simulated`, `Sample data`, `Estimated`.
- Suggestion wording: "Suggested for staff review". The UI states the rules are illustrative and not clinically validated.
- Polling interval: 2000 ms.
- Must run with Wi-Fi off. No `next/font/google`; use the `geist` npm package.
- All logic functions take `now: number` (UTC ms) rather than reading the clock. Only `demoNow` reads real time.

## Review Focus

1. Closing a counter that has a called or serving token: rejected with a clear message, and no token is orphaned. Test in Task 4.
2. Closing the last open counter: token pages show "Waiting for a counter to open", never a number or `Infinity`. Test in Task 4.
3. A patient with a final-state token checks in again: gets a new token, because the unique index only covers active tokens. Test in Task 2.
4. Malformed requests (bad JSON, 9-digit phone, unknown service, unknown item code): HTTP 400 with a message, never a 500. Test in Task 6.
5. Reset while a token page is open: the page shows "This token is no longer active" and stops erroring. Test in Task 6 for the 404, Task 7 for the screen.

---

### Task 1: Scaffold and database

**Files:**
- Create: Next.js project files, `drizzle.config.ts`, `vitest.config.ts`, `drizzle/` (generated)
- Create: `lib/types.ts`, `lib/errors.ts`, `lib/db/schema.ts`, `lib/db/client.ts`, `lib/clock.ts`
- Test: `tests/helpers.ts`, `tests/db.test.ts`, `tests/clock.test.ts`

**Interfaces:**
- Produces:
  - `lib/types.ts`: `TokenStatus = 'waiting'|'called'|'serving'|'completed'|'cancelled'|'no_show'`, `Priority = 'urgent'|'priority'|'routine'`, `ACTIVE_STATUSES`, `FINAL_STATUSES`.
  - `lib/errors.ts`: `class DomainError extends Error { constructor(code: string, message: string, status = 409) }`.
  - `lib/db/client.ts`: `createDb(path: string): Db` (opens, enables WAL and foreign keys, runs migrations), `getDb(): Db` (singleton on `globalThis`, path `data/pulsequeue.db`; calls `resetDemo` when `services` is empty, from Task 5). `type Db` is the Drizzle database. Use `.transaction()` for atomic writes.
  - `lib/clock.ts`: `demoNow(db: Db, realNow = Date.now()): number`, `setClock(db: Db, demoMs: number, realNow?: number): void`, `getSetting(db, key)`, `setSetting(db, key, value)`.
  - `tests/helpers.ts`: `testDb(): Db` (in-memory, with four services seeded after Task 5; until then inserts them inline), `T0 = Date.UTC(2026, 10, 3, 5, 30)`.

**Schema (`snake_case` columns, times as integer UTC ms):**

| Table | Columns |
|---|---|
| `services` | `id` text pk, `name`, `prefix`, `default_minutes` int |
| `counters` | `id` text pk, `service_id` fk, `label`, `is_open` int |
| `tokens` | `id` text pk, `code` unique, `service_id` fk, `status`, `suggested_priority` null, `reasons_json` null, `item_codes_json` null, `confirmed_priority`, `triage_reviewed_at` null, `counter_id` null fk, `checked_in_at`, `called_at`, `started_at`, `finished_at` (last three null), `ended_early` int default 0, `est_low_min`, `est_high_min`, `est_mid_min` (null), `idempotency_key` unique null, `phone_last4`, `phone_hash` null |
| `token_events` | `id` integer pk, `token_id` fk, `type`, `from_status` null, `to_status` null, `at`, `actor` |
| `triage_decisions` | `id` integer pk, `token_code`, `suggested` null, `reasons_json` null, `decision`, `override_reason` null, `staff_label`, `at` |
| `settings` | `key` pk, `value` |
| `historical_visits` | `id` integer pk, `service_id` fk, `arrived_at`, `started_at`, `completed_at`, `weekday`, `hour`, `wait_min` real, `service_min` real, `counters_open` int |

Partial unique index: `tokens_active_phone_service` on `(phone_hash, service_id) WHERE status IN ('waiting','called','serving')`.

- [ ] **Step 1: Scaffold.** `create-next-app` may refuse a folder containing `CLAUDE.md`, so run it into a scratchpad folder and copy the result in, keeping the repo's `CLAUDE.md`, `docs/` and `.git`, and merging `.gitignore`.

```bash
npx create-next-app@latest pulsequeue --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
npm i better-sqlite3 drizzle-orm zod lucide-react recharts geist
npm i -D drizzle-kit vitest @types/better-sqlite3
npx shadcn@latest init -d
npx shadcn@latest add button card badge input checkbox dialog select table tabs alert sonner
```

Set `serverExternalPackages: ['better-sqlite3']` in `next.config`. Replace the template's Google font with `geist`. Add scripts: `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `db:generate` (`drizzle-kit generate`).

- [ ] **Step 2: Write failing tests.**

```ts
// tests/db.test.ts
test('rejects a second active token for the same phone and service', () => {
  const db = testDb();
  insertRawToken(db, { code: 'GEN-001', phoneHash: 'h', status: 'waiting' });
  expect(() => insertRawToken(db, { code: 'GEN-002', phoneHash: 'h', status: 'waiting' })).toThrow(/UNIQUE/);
});
test('allows a new active token once the old one is final', () => {
  const db = testDb();
  insertRawToken(db, { code: 'GEN-001', phoneHash: 'h', status: 'completed' });
  expect(() => insertRawToken(db, { code: 'GEN-002', phoneHash: 'h', status: 'waiting' })).not.toThrow();
});
// tests/clock.test.ts
test('demo clock ticks with real time from its base', () => {
  const db = testDb();
  setClock(db, 1000, 5000);
  expect(demoNow(db, 5750)).toBe(1750);
});
```

`insertRawToken` lives in `tests/helpers.ts`. Tests may write status directly; app code may not.

- [ ] **Step 3: Run to verify failure.** Run: `npm test`. Expected: FAIL, modules not found.
- [ ] **Step 4: Implement** the schema, generated migration (`npm run db:generate`), client and clock. Migrations run with Drizzle's `migrate()` from `drizzle/`.
- [ ] **Step 5: Verify.** Run: `npm test && npm run typecheck && npm run build`. Expected: all pass. This also proves `better-sqlite3` loads on Node 24; if it does not, switch to `node:sqlite` and record a ruling.
- [ ] **Step 6: Commit** `feat: scaffold app and database schema`.

### Task 2: Tokens and state machine

**Files:**
- Create: `lib/queue/transitions.ts`, `lib/queue/check-in.ts`, `lib/queue/phone.ts`, `lib/triage/rules.ts`
- Test: `tests/transitions.test.ts`, `tests/check-in.test.ts`

**Interfaces:**
- Consumes: Task 1 `Db`, `DomainError`.
- Produces:
  - `transition(db, tokenId, to: TokenStatus, ctx: { now: number; actor: string; counterId?: string; endedEarly?: boolean }): Token`
  - `checkIn(db, input: { serviceId: string; phone: string; itemCodes: string[]; idempotencyKey: string; now: number }): { token: Token; outcome: 'created'|'existing'|'updated' }`
  - `hashPhone(db, phone: string): string` (HMAC-SHA256 with the `phone_secret` setting, created on first use with `randomBytes(32)`).
  - `ITEMS: { code: string; label: string; level: Exclude<Priority,'routine'> }[]`, `suggestPriority(codes: string[]): { level: Priority; reasons: string[] } | null`

Items: urgent: `chest_pain` "Chest pain", `difficulty_breathing` "Difficulty breathing", `heavy_bleeding` "Heavy bleeding". Priority: `high_fever` "High fever", `pregnant` "Pregnant", `under_2` "Under 2 years old", `over_75` "Over 75 years old". Unknown codes throw `DomainError('unknown_item', ..., 400)`.

Legal moves: `waiting→called|cancelled`, `called→serving|cancelled|no_show|waiting`, `serving→completed`. Anything else throws `DomainError('illegal_transition', ...)`.

Side effects by target: `called` sets `called_at` and requires `counterId`. `serving` sets `started_at`. `waiting` (recall) clears `called_at` and `counter_id`. Final states set `finished_at` and clear `phone_hash`, `item_codes_json` and `counter_id`, and `ended_early` when passed. Every transition writes one `token_events` row, in one transaction.

`checkIn` rules: validate `/^\d{10}$/` and throw `DomainError('unknown_service', ..., 400)` for an unknown service; code is `<prefix>-<NNN>`, padded to 3, numbered per service per day with the next sequence computed inside the transaction. New tokens write a `checked_in` event. It does not store a wait estimate yet; Task 4 adds that.

Order inside the transaction:
1. Same `idempotency_key` found: return that token as `existing`, with no write.
2. Active token for this phone and service found: if `itemCodes` adds nothing new, return `existing`. Otherwise merge codes, recompute the suggestion, clear `triage_reviewed_at` when the suggestion changes, write an `items_added` event, return `updated`.
3. Otherwise create it and return `created`.

- [ ] **Step 1: Write failing tests.**

```ts
test.each([
  ['waiting','called'],['waiting','cancelled'],['called','serving'],['called','cancelled'],
  ['called','no_show'],['called','waiting'],['serving','completed'],
])('allows %s to %s', ...);
test.each([
  ['waiting','serving'],['waiting','completed'],['serving','cancelled'],['serving','waiting'],
  ['completed','waiting'],['cancelled','called'],['no_show','waiting'],
])('rejects %s to %s and leaves the token unchanged', ...);
test('final state clears phone hash and item codes and writes an event', ...);
test('recall clears the counter and called time', ...);

test('creates GEN-001 then GEN-002 and stores only hash and last 4', () => {
  // assert JSON.stringify(row) does not contain the full phone number
});
test('same idempotency key returns the same token with no new row', ...);
test('same phone with a new key returns existing', ...);
test('same phone at a different service creates a new token', ...);
test('checks in again after a final state with a new token', ...);
test('repeat check-in with a new item merges it and returns updated', () => {
  // first: no items. second: ['chest_pain'].
  // expect outcome 'updated', suggested_priority 'urgent', confirmed_priority still 'routine'
});
test('rejects a 9-digit phone', ...);
test('rejects an unknown service with status 400', ...);
test('rejects an unknown item code with status 400', ...);
test('suggests urgent for chest pain and lists the reason', () => {
  expect(suggestPriority(['chest_pain'])).toEqual({ level: 'urgent', reasons: ['Chest pain'] });
});
test('highest level wins and all reasons are kept', () => {
  expect(suggestPriority(['high_fever','chest_pain'])).toEqual({ level: 'urgent', reasons: ['High fever','Chest pain'] });
});
test('no items gives no suggestion', () => { expect(suggestPriority([])).toBeNull(); });
```

- [ ] **Step 2: Run to verify failure.** Run: `npm test -- transitions check-in`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** `transitions.ts`, `phone.ts`, `rules.ts`, `check-in.ts`.
- [ ] **Step 4: Verify.** Run: `npm test -- transitions check-in`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add token state machine and check-in`.

### Task 3: Triage and ordering

**Files:**
- Create: `lib/triage/decide.ts`, `lib/queue/order.ts`
- Test: `tests/triage.test.ts`, `tests/order.test.ts`

**Interfaces:**
- Produces:
  - `OVERRIDE_REASONS: readonly string[]`: "Assessed in person", "Symptoms changed", "Information was incorrect", "Other clinical judgement".
  - `decideTriage(db, input: { tokenId: string; decision: Priority; overrideReason?: string; staffLabel: string; now: number }): Token`
  - `sortQueue<T extends QueueSortable>(tokens: T[]): T[]`, `needsWaitReview(token, now, thresholdMin = 45): boolean`

`decideTriage`: only on `waiting` tokens. A decision that differs from an existing suggestion needs a reason from the list. It sets `confirmed_priority` and `triage_reviewed_at`, inserts into `triage_decisions`, and writes a `triage_decided` event, in one transaction.

`sortQueue`: confirmed priority, then `checked_in_at`, then `code`.

- [ ] **Step 1: Write failing tests.**

```ts
test('a suggestion alone does not change queue order', () => {
  // A routine at T0, B suggested urgent at T0+1. sortQueue keeps A first.
});
test('confirming moves the token ahead and logs an audit row', ...);
test('an override without a reason is rejected', ...);
test('an override with a reason logs suggestion, decision and reason', ...);
test('staff can raise a token with no suggestion and no reason', ...);
test('deciding on a token that is not waiting is rejected', ...);
test('routine past 45 minutes is flagged but not moved', ...);
test('audit rows contain no phone data', ...);
```

- [ ] **Step 2: Run to verify failure.** Run: `npm test -- triage order`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the files.
- [ ] **Step 4: Verify.** Run: `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add triage suggestions, staff decisions and queue ordering`.

### Task 4: Wait estimate, counters and queue views

**Files:**
- Create: `lib/estimate/wait.ts`, `lib/estimate/stats.ts`, `lib/queue/counters.ts`, `lib/queue/views.ts`
- Modify: `lib/queue/check-in.ts`
- Test: `tests/estimate.test.ts`, `tests/counters.test.ts`, `tests/views.test.ts`

**Interfaces:**
- Produces:
  - `estimateWait(i: { ahead: number; openCounters: number; mean: number; sd: number }): WaitEstimate`, where `WaitEstimate = { kind: 'range'; lowMin: number; highMin: number; midMin: number } | { kind: 'no_counter' }`
  - `blendServiceTime(i: { todayMinutes: number[]; historicalMedian: number; historicalSd: number }): { mean: number; sd: number; todayWeight: number }`, with `todayWeight = k / (k + 5)`. `sd` is the historical value when `k < 2`, otherwise blended with the same weight.
  - `serviceStats(db, serviceId, now): { mean; sd; todayWeight; todayCount; historicalMedian; historicalSd }`. Median and sd come from `historical_visits` for that service and hour. With no rows, the median is `default_minutes` and sd is `0.3 * default_minutes`.
  - `openCounter(db, counterId)`, `closeCounter(db, counterId)` (throws `DomainError('counter_busy', 'Finish the current patient first')` if it holds a called or serving token), `callNext(db, counterId, now): Token | null`
  - `tokenView(db, code, now): PublicTokenView | null`: `{ code, serviceName, status, position, estimate: WaitEstimate | null, counterLabel, isFinal }`. `estimate` is non-null only when waiting.
  - `displayView(db, now): DisplayView`: per service, `nowServing: { code, counterLabel }[]`, `upNext: string[]` (max 6).
  - `staffView(db, now): StaffView`: per service, counters with their token, the ordered queue with priority, suggestion, reasons, `needsWaitReview`, and a `pendingReview` list, urgent first.

`ahead` counts every active token sorted before this one: serving, then called, then waiting by `sortQueue`. `checkIn` stores `est_*` using these functions at creation.

Range: `low = (n*mean - sqrt(n)*sd) / c`, `high = (n*mean + sqrt(n)*sd) / c`, each rounded to the nearest 5 and floored at 0. If `high - low < 5`, `high = low + 5`. `midMin` is `n*mean/c`, unrounded.

- [ ] **Step 1: Write failing tests.**

```ts
test('n=4 mean=10 sd=3 c=2 gives 15 to 25', () => {
  expect(estimateWait({ ahead: 4, openCounters: 2, mean: 10, sd: 3 }))
    .toEqual({ kind: 'range', lowMin: 15, highMin: 25, midMin: 20 });
});
test('nobody ahead gives 0 to 5', ...);
test('zero spread still gives a 5 minute range', () => {
  // n=9 mean=10 sd=0 c=1 -> 90 to 95
});
test('no open counter returns no_counter', ...);
test('blend uses history alone with no completions today', ...);
test('blend weights today at 0.5 after 5 completions', ...);
test('no history falls back to the default service time', ...);
test('closing a busy counter is rejected and the token is unchanged', ...);
test('closing the last counter gives no_counter on the token view', ...);
test('callNext takes the highest confirmed priority', ...);
test('callNext returns null on an empty queue', ...);
test('callNext rejects a closed counter or one already holding a token', ...);
test('a confirmed urgent patient pushes the estimate of those behind', ...);
test('tokenView and displayView JSON contain no priority or reasons', () => {
  // expect(JSON.stringify(view)).not.toMatch(/priority|urgent|reason|chest/i)
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm test -- estimate counters views`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the files.
- [ ] **Step 4: Verify.** Run: `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add wait estimates, counters and role-based queue views`.

### Task 5: Seed and demo controls

**Files:**
- Create: `lib/rng.ts`, `lib/analytics/simulate.ts`, `lib/db/seed.ts`, `lib/demo/controls.ts`
- Modify: `lib/db/client.ts`, `tests/helpers.ts`
- Test: `tests/simulate.test.ts`, `tests/seed.test.ts`, `tests/demo.test.ts`

**Interfaces:**
- Produces:
  - `mulberry32(seed: number): () => number`, `normal(rng, mean, sd): number`
  - `simulateQueue(arrivals: { atMin: number; serviceMin: number }[], counters: number): { startMin: number; waitMin: number }[]`: first-come, multi-counter queue. Result is in arrival order.
  - `seedServices(db)`, `seedHistory(db, now)`, `seedToday(db, now)`, `resetDemo(db, realNow = Date.now()): void`
  - `simulateRush(db, now, serviceId = 'lab', count = 15): number`
  - `advanceTime(db, minutes: number): { completed: number; started: number }`
  - `serviceDuration(token, mean, sd): number`, deterministic from a hash of the token id.

**Services:**

| id | name | prefix | default min | counters | open at reset |
|---|---|---|---|---|---|
| `general` | General OPD | GEN | 10 | 3 | 3 |
| `pediatrics` | Pediatrics | PED | 12 | 2 | 2 |
| `lab` | Lab | LAB | 6 | 3 | 1 |
| `pharmacy` | Pharmacy | PHA | 4 | 2 | 2 |

**History:** fixed PRNG seed `20261106`. The 30 days before `now`, Monday to Saturday, 08:00 to 18:00 local, morning-peaked arrivals (peak 09:00 to 12:00), about 80 to 120 visits per service per day. Lab arrivals are heavy enough for one to two counters to overload at peak. Timings come from `simulateQueue`.

**Today:** clock is the most recent weekday (Monday to Friday) at 11:00 local. From 08:00 to 11:00, generate about 60 tokens using `checkIn` and `transition` at their historical times, with about 5% no-shows and 3% cancellations, then leave about 20 active: 5 serving or called across open counters, the rest waiting, heaviest in Lab. Two waiting tokens carry pending suggestions (`high_fever`, `over_75`). Synthetic phones are `9000000000` plus an index. Since `checkIn` numbers tokens by day, codes stay unique.

**`resetDemo`:** in one transaction, delete all rows from every table, then re-seed, then `setClock`. It must complete in under 5 seconds.

**`simulateRush`:** `count` `checkIn` calls at `now` with synthetic phones, no items.

**`advanceTime`:** clamp to 1 to 30. For each minute `t`, per service: complete serving tokens whose `started_at + serviceDuration` is at or before `t`; start called tokens; on each open free counter `callNext` then start it. All through `transition` with actor `'demo'`. Then move the clock. No arrivals, no no-shows.

- [ ] **Step 1: Write failing tests.**

```ts
test('one counter queues people in order', () => {
  expect(simulateQueue([{atMin:0,serviceMin:10},{atMin:1,serviceMin:10}],1).map(r=>r.waitMin)).toEqual([0,9]);
});
test('two counters take two people at once', ...);
test('an empty arrival list returns an empty result', ...);
test('reset is deterministic: two resets give the same token codes', ...);
test('reset leaves completed tokens today, active tokens and pending reviews', ...);
test('reset has history for Lab at 10:00 and no Sunday rows', ...);
test('every seeded status change has an event row', ...);
test('rush adds 15 waiting Lab tokens', ...);
test('advance by 15 completes tokens, fills free counters and adds no arrivals', ...);
test('advance clamps 500 to 30 minutes', ...);
test('advance never uses a closed counter', ...);
```

- [ ] **Step 2: Run to verify failure.** Run: `npm test -- simulate seed demo`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the files. Point `tests/helpers.ts` at `seedServices`, and `getDb()` at `resetDemo` when empty.
- [ ] **Step 4: Verify.** Run: `npm test`. Expected: PASS, including the 5-second reset limit.
- [ ] **Step 5: Commit** `feat: add deterministic seed and demo controls`.

### Task 6: API and shared UI

**Files:**
- Create: `lib/api/handler.ts`, `lib/api/schemas.ts`, routes under `app/api/`
- Create: `components/use-poll.ts`, `components/app-shell.tsx`, `components/demo-controls.tsx`, `components/stat-label.tsx`
- Test: `tests/api.test.ts`

**Interfaces:**
- Produces:
  - `route(schema, fn)`: wraps a handler, parses JSON with Zod, maps Zod and JSON errors to 400, `DomainError` to its status, and unknown errors to 500 with a generic message. Response: `{ error: { code, message } }`.
  - `usePoll<T>(url: string, ms = 2000): { data: T | null; error: boolean; loading: boolean; refresh(): void }`. Keeps the last data on failure and sets `error`. Stops polling on 404.
  - `<AppShell role>`: top nav with a role switcher and a "Demo mode" badge.
  - `<DemoControls />`: Simulate rush, Advance time (5, 15, 30 min), Reset demo with a confirm dialog.
  - `<StatLabel kind="measured"|"simulated"|"sample"|"estimated" />`: renders the exact allowed label text.

**Routes** (all `export const dynamic = 'force-dynamic'`):

| Method, path | Body | Calls |
|---|---|---|
| POST `/api/check-in` | `serviceId, phone, itemCodes, idempotencyKey` | `checkIn` |
| GET `/api/tokens/[code]` | | `tokenView`, 404 if null |
| POST `/api/tokens/[code]/cancel` | | `transition` to cancelled, actor `patient` |
| GET `/api/display` | | `displayView` |
| GET `/api/staff/queue` | | `staffView` |
| POST `/api/staff/tokens/[id]/action` | `action: start|complete|no_show|recall|cancel`, `endedEarly?` | `transition`, actor `staff` |
| POST `/api/staff/tokens/[id]/triage` | `decision, overrideReason?` | `decideTriage`, `staffLabel: 'Staff'` |
| POST `/api/staff/counters/[id]` | `action: open|close|call_next` | counters |
| GET `/api/admin/live`, `/api/admin/analytics` | | Task 9 |
| POST `/api/demo/reset`, `/rush`, `/advance` | `minutes` for advance | demo controls |

`check-in` returns `{ code, outcome }` only, with no priority fields.

- [ ] **Step 1: Write failing tests** that call route handlers directly with `new Request(...)`, using a test DB.

```ts
test('check-in with a 9-digit phone returns 400', ...);
test('check-in with bad JSON returns 400', ...);
test('check-in with an unknown service returns 400', ...);
test('check-in with an unknown item code returns 400', ...);
test('an unknown token returns 404', ...);
test('an illegal transition returns 409 with a message', ...);
test('check-in response has no priority fields', ...);
```

To make routes testable, handlers call `getDb()`, and `tests/api.test.ts` sets `globalThis` to a test DB.

- [ ] **Step 2: Run to verify failure.** Run: `npm test -- api`. Expected: FAIL.
- [ ] **Step 3: Implement** the handler wrapper, schemas, routes and shared components.
- [ ] **Step 4: Verify.** Run: `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add API routes and shared UI`.

### Task 7: Check-in and token pages

**Files:**
- Create: `app/check-in/page.tsx`, `app/t/[code]/page.tsx`, `components/check-in-form.tsx`, `components/token-tracker.tsx`

**Interfaces:**
- Consumes: `POST /api/check-in`, `GET /api/tokens/[code]`, cancel route, `usePoll`, `ITEMS`.

Exact copy:
- Check-in notice: "If this is an emergency, tell a staff member now. Do not wait for a token."
- Optional items heading: "Anything staff should know about? (optional)"
- `existing` result: "You already have a token for this service."
- `updated` result: "Staff have been told about this. If you feel worse, speak to a staff member now."
- Estimate: "Estimated wait: 15–25 min", followed by "This is an estimate, not a guaranteed time. Urgent cases may be seen first, so it can change."
- `no_counter`: "Waiting for a counter to open"
- Missing token: "This token is no longer active"

The form generates its idempotency key once per submission attempt with `crypto.randomUUID()` and reuses it on retry. The submit button disables while sending. The token page is a centered phone-width column with a large code, status steps, position, range, and a cancel button with a confirm dialog, hidden once final or serving.

- [ ] **Step 1: Implement** both pages.
- [ ] **Step 2: Verify in the browser.** Run: `npm run dev`. Check each: new token; double-click gives one token; same phone shows the existing token; adding chest pain shows the "Staff have been told" copy; cancel works; `/t/GEN-999` shows the inactive message; a 9-digit phone shows an inline error; a phone-width window has no horizontal scroll.
- [ ] **Step 3: Commit** `feat: add check-in and patient token pages`.

### Task 8: Display and staff console

**Files:**
- Create: `app/display/page.tsx`, `app/staff/page.tsx`, `components/staff/service-queue.tsx`, `components/staff/counter-card.tsx`, `components/staff/triage-panel.tsx`

**Interfaces:**
- Consumes: `/api/display`, `/api/staff/*`, `usePoll`, `OVERRIDE_REASONS`, `<DemoControls />`.

**Display:** large dark board, per service: now serving (code and counter) and next six codes. No priority anywhere. Announce the newest called token with a brief highlight.

**Staff:** tabs per service, with counts. Each counter card shows open or closed, its token, and only the valid buttons: Call next, Start, Complete (with an "Ended early" checkbox), No-show, Recall, Cancel, Open, Close. Queue table in sorted order, with priority badges and a "Waited 45+ min, review" flag.

**Triage panel:** always visible, urgent first, with a red alert for urgent suggestions. Each item shows "Suggested for staff review", the level, its reasons, and the note "Illustrative rules, not clinically validated. Staff make the decision." Buttons: Confirm, Change level. Changing the level requires a selection from `OVERRIDE_REASONS` before Save enables. Any queue row also has "Set priority" for tokens with no suggestion. Errors from the API appear as toasts.

- [ ] **Step 1: Implement** both pages.
- [ ] **Step 2: Verify in the browser** with `/staff` and `/display` side by side: run the whole lifecycle; confirm a suggestion and watch the order and a patient's range change; override with and without a reason; close a busy counter and see the error; close all Lab counters and see "Waiting for a counter to open"; confirm the display page's network response has no priority data.
- [ ] **Step 3: Commit** `feat: add waiting-room display and staff console`.

### Task 9: Analytics logic

**Files:**
- Create: `lib/analytics/kpis.ts`, `lib/analytics/peaks.ts`, `lib/analytics/bottlenecks.ts`, `lib/analytics/recommendations.ts`, `lib/analytics/backtest.ts`, `lib/analytics/service-stats.ts`
- Modify: `app/api/admin/*`
- Test: `tests/analytics.test.ts`

**Interfaces:**
- Consumes: `simulateQueue`, `serviceStats`, `estimateWait`, `mulberry32`.
- Produces:
  - `kpis(db, now): { waitingNow; avgWaitToday; longestWait; served; noShowRate }`. Rate is 0 with no closed tokens.
  - `peakHeatmap(db): { weekday; hour; avgArrivals }[]`, plus `peakHours(db, serviceId): number[]`
  - `detectBottlenecks(db, now): Bottleneck[]`, where `Bottleneck = { serviceId; serviceName; load; longestWait; cause: 'too_few_counters'|'slow_service'|'arrival_surge'; message }`
  - `recommendations(db, now): Recommendation[]`, where `Recommendation = { serviceId; title; windowLabel; currentAvgWait; projectedAvgWait; basis: string }`
  - `backtest(db): { modelMae; baselineMae; samples }` and `liveAccuracy(db): { mae; samples } | null`
  - `serviceAnalytics(db, now): { serviceId; served; avgService; avgWait; noShowRate; hourlyArrivals }[]`

**Bottleneck rule:** `load = (arrivals in the last 30 min × 2 per hour) / (open counters × 60 / mean)`. Flag at `load >= 1.0` or `longestWait >= 45`. With no open counter and a waiting patient, `load = Infinity` is replaced by flagging `too_few_counters` and reporting `load: null`. Cause order: `open < total` gives `too_few_counters`; today's mean over 1.25× historical gives `slow_service`; recent arrivals over 1.5× the historical rate for that hour gives `arrival_surge`; otherwise `too_few_counters`.

**Recommendations:** for each service where the forecast overloads, build arrivals from today's so far plus the historical average per remaining hour for that weekday, using PRNG seed `7` and `serviceDuration` sampling. Run `simulateQueue` with `c` and `c + 1` counters. Recommend only if `c + 1` is at most total counters and the average wait improves by at least 5 minutes. `windowLabel` runs from the current hour to the end of that service's peak. `basis` is "Today's arrivals plus a forecast from sample data". The title reads like "Open one more Lab counter from 11:00 to 13:00".

**Backtest:** last 7 days of `historical_visits`. For each visit, `n` is the visits in that service and day that arrived earlier and started later. Model uses the blend with same-day earlier visits; baseline is `n * default_minutes / counters_open`. Report mean absolute error against `wait_min`.

- [ ] **Step 1: Write failing tests.**

```ts
test('kpis return zeros on an empty day', ...);
test('kpis count no-shows over closed tokens', ...);
test('heatmap has no Sunday rows and peaks in the morning', ...);
test('a rush flags Lab with cause too_few_counters when counters are closed', ...);
test('a rush with all counters open reports arrival_surge', ...);
test('no open counter with patients waiting flags without Infinity', ...);
test('a quiet service is not flagged', ...);
test('Lab gets a recommendation that lowers the average wait', ...);
test('no recommendation when every counter is already open', ...);
test('the model beats the naive baseline on sample data', ...);
test('liveAccuracy is null with no completed tokens', ...);
```

- [ ] **Step 2: Run to verify failure.** Run: `npm test -- analytics`. Expected: FAIL.
- [ ] **Step 3: Implement** the files and wire the admin routes. If the model loses to the baseline, tune the seed's service-time spread to be realistic and report the true result. Never hard-code the numbers.
- [ ] **Step 4: Verify.** Run: `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add analytics, bottlenecks and recommendations`.

### Task 10: Admin dashboard

**Files:**
- Create: `app/admin/page.tsx`, `components/admin/kpi-row.tsx`, `components/admin/peak-heatmap.tsx`, `components/admin/bottleneck-alerts.tsx`, `components/admin/recommendation-card.tsx`, `components/admin/service-table.tsx`, `components/admin/estimate-panel.tsx`, `components/admin/audit-log.tsx`

**Interfaces:**
- Consumes: Task 9 outputs through `/api/admin/live` (polled) and `/api/admin/analytics` (fetched on load and after demo actions), `<StatLabel />`, `<DemoControls />`.

Use the `dataviz` skill before writing charts. Sections, top to bottom: KPI row (`Measured in demo`); bottleneck alerts; recommendations (`Simulated`, showing `basis`); peak heatmap (`Sample data`); service analytics (`Measured in demo`); estimate panel showing current inputs per service plus backtest (`Sample data`) and live accuracy (`Measured in demo`, with the note "Includes generated demo activity"); triage audit log. An "Open a counter" link on a recommendation goes to `/staff`.

- [ ] **Step 1: Implement** the page and components.
- [ ] **Step 2: Verify in the browser.** After Reset the dashboard is full; Simulate rush fires an alert within 2 seconds; opening a Lab counter lowers the ranges on a token page; every number on the page sits under a label; an override appears in the audit log.
- [ ] **Step 3: Commit** `feat: add admin dashboard`.

### Task 11: Landing page, polish and demo run-through

**Files:**
- Create: `app/page.tsx`, `README.md`
- Modify: any screens with gaps found in the run-through

- [ ] **Step 1: Build the landing page.** Product line, one card per role, and a short statement that staff make every priority decision and that estimates are not guarantees.
- [ ] **Step 2: Check states.** Every polling screen has loading, empty and "Reconnecting" states, and readable text at projector distance.
- [ ] **Step 3: Scan the constraint rules.** Search the code for the forbidden words "guaranteed" (except in "not a guaranteed time") and "appointment". Confirm no `status:` write exists outside `transitions.ts`: run `grep -rn "status" lib app --include=*.ts --include=*.tsx` and review it.
- [ ] **Step 4: Run production offline.** Run `npm run build && npm start`, turn Wi-Fi off, then run all seven demo-script steps from the spec, followed by Reset, then run them again.
- [ ] **Step 5: Final checks.** Run: `npm run typecheck && npm run lint && npm test`. Expected: all pass.
- [ ] **Step 6: Write `README.md`.** How to run, the demo script, a table mapping each PS-13 outcome and constraint to a screen, and the note that the data is synthetic and the triage rules are illustrative.
- [ ] **Step 7: Commit** `feat: add landing page and finish demo polish`.
