# PulseQueue AI

Smart queue and service-time optimization for a hospital outpatient department.
Hackathon entry for PS-13, built solo in 12 hours and presented from one laptop.

Design: `docs/superpowers/specs/2026-11-06-pulsequeue-design.md`

## Non-negotiable rules

These come from the problem statement. A feature that breaks one is not done.

1. **Staff decide priority.** The system may suggest an urgency level and must show why. A suggestion
   never changes queue order. Only a staff confirmation does, and every decision is logged. Never
   present a suggestion as a diagnosis or clinical advice.
2. **Estimates are never promises.** Show waits as a range with "estimated" wording. Never show a
   single exact time or the words "guaranteed" or "appointment".
3. **No duplicate or inconsistent entries.** One active token per patient per service, enforced by the
   database, not only by the UI. Check-in is idempotent.
4. **One state machine.** Every status change goes through `lib/queue/transitions.ts`, in a
   transaction, and writes an event. No other code writes `tokens.status`.
5. **Minimum personal data.** No names, dates of birth, or free-text medical notes. Phone numbers are
   stored only as a keyed hash plus the last 4 digits, and the hash is cleared when the token closes.
   Public screens show token codes only, never urgency.
6. **Honest numbers.** Every figure about performance or efficiency is labelled `Measured in demo`,
   `Simulated`, `Sample data` or `Estimated`. Never show an unlabelled improvement claim.

## Stack

- Next.js (App Router) with TypeScript in strict mode, as one app. No separate backend.
- Tailwind CSS, shadcn/ui patterns, Lucide React icons. Recharts for charts.
- SQLite through `better-sqlite3` and Drizzle ORM. Local file at `data/pulsequeue.db`.
- Zod validates every API input. Vitest for tests.
- Screens stay live by polling every 2 seconds.
- No LLM, no API keys, no Docker, no network access needed at demo time.

## Layout

- `app/` routes and API handlers. Handlers stay thin: validate, call `lib/`, return.
- `components/` UI. `components/ui/` holds shadcn primitives.
- `lib/queue/` tokens, state machine, ordering.
- `lib/estimate/` wait-time model. Pure functions.
- `lib/triage/` suggestion rules. Pure functions.
- `lib/analytics/` peaks, bottlenecks, recommendations, simulation.
- `lib/db/` schema, client, seed.
- `tests/` Vitest tests.

## Conventions

- Business logic lives in `lib/` and never imports React or Next.
- Server Components by default. Add `"use client"` only where a screen needs interaction or polling.
- Time is stored as UTC milliseconds and shown in the local timezone. The app is demo-only and runs on
  a demo clock. Pass `now` into logic functions so that tests and the simulator control the clock.
- Files are `kebab-case`, components `PascalCase`, functions `camelCase`, DB columns `snake_case`.
- UI copy is plain language, and every screen must read clearly from across a room on a projector.
- Commit small, working steps with imperative messages.

## Definition of done

- `npm run typecheck`, `npm run lint` and `npm test` all pass.
- State machine, duplicate prevention, ordering, wait estimates and triage rules have tests.
- The feature works in the browser, including its empty, loading and error states.
- It still works with the Wi-Fi off.
