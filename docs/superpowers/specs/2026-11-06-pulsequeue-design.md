# PulseQueue AI: Design

Date: 2026-11-06. Status: awaiting approval.

## Intent

PS-13 asks for a platform that issues queue tokens, estimates waits and helps providers allocate
resources. Long queues leave visitors guessing and staff unaware of peak demand. PulseQueue AI is a
website for one hospital outpatient department (OPD) that fixes both problems, and supports
urgency-based prioritization under human supervision without ever replacing a clinical decision.

The builder is one person with 12 hours. The presenter shows it from a laptop to hackathon judges. The
goal is a live story that runs without a hitch, where every PS-13 outcome and constraint is visibly
covered.

## Decided by the user

- Hospital setting only.
- A website, presented from one laptop. Public hosting is not required. After check-in, a QR code opens the token page on a phone on the
  same network as the laptop.
- No API key, so no LLM.
- Tailwind CSS, Lucide React icons, Shadcn UI patterns.
- The PS-13 slide is the complete requirements source.
- The stack beyond styling was handed to the builder (see "Assistant's calls").

## Goals

Each PS-13 outcome maps to a demo moment:

| PS-13 outcome | Where it is shown |
|---|---|
| Digital token generation | Check-in screen issues a token such as `GEN-014` |
| Wait estimates from sample or live data | Token page shows a live range, and the admin page shows how it was computed |
| Queue status and progress dashboard | Token page, waiting-room display, staff console |
| Peak-hour and bottleneck identification | Admin heatmap and live bottleneck alert |
| Service analytics and efficiency recommendations | Admin analytics and recommendations with simulated impact |

## Non-goals

- Login or real access control. A role switcher opens each screen, and the UI labels it as demo mode.
- Appointments, billing, patient records, EHR integration.
- SMS or WhatsApp notifications.
- Multiple hospitals, or patient journeys across departments.
- Mobile apps. Pages must still fit a phone-sized window, since the token page is a phone-style view.

## Anti-goals

This fails, even if it works technically, if:

- A patient could read a suggestion as a diagnosis, or urgency changes order without a person deciding.
- A wait is presented as a promise.
- An efficiency number has no label saying how it was obtained.
- The demo depends on Wi-Fi, an external service, or a manual reset that could go wrong on stage.
- It looks like a raw admin template rather than a finished product.

## Constraints

From PS-13: estimates are not guaranteed service times; prevent duplicate or inconsistent entries;
minimize personal information; handle cancellations and completions consistently; measure efficiency
gains or label them as estimates. `CLAUDE.md` turns these into project rules.

## Screens

A landing page introduces the product and links to each role. All screens run in the same app so they
can sit side by side on the laptop.

1. **Check-in (`/check-in`).** Reception or kiosk view. Choose a service, enter a 10-digit phone number,
   and optionally tick plain-language "needs attention" items. Issues a token. Shows a notice that
   anyone with an emergency must tell staff immediately and not wait for a token.
2. **Token page (`/t/[code]`).** The patient's view: status, position, estimated wait range, a note that
   times can change because urgent cases may be seen first, and a cancel button.
3. **Waiting-room display (`/display`).** Large-format board: now serving per counter and upcoming token
   codes. Token codes only, never urgency.
4. **Staff console (`/staff`).** Live queue per service, counter controls (open or close a counter, call
   next, start, complete, no-show), and a triage review panel.
5. **Admin dashboard (`/admin`).** Live KPIs, peak-hour heatmap, bottleneck alerts, service analytics,
   recommendations, estimate accuracy, and the triage audit log.

A small demo control panel appears on the staff console and admin dashboard: **Simulate rush**,
**Advance time**, and **Reset demo**.

## Services

Seeded with four services: General OPD, Pediatrics, Lab, Pharmacy. Each has a token prefix, a number of
counters, and a default service time. Tokens are numbered per service and per day. A patient's visit to
one service is independent of any other service.

Each counter has a made-up staff name (for example "Dr. Meera Rao"), shown on the staff console, the
waiting-room board and the patient's token page once they are called. Patients stay anonymous: a token
code and the last 4 phone digits only, with no name, as the privacy constraint requires.

## Token lifecycle

```
waiting -> called -> serving -> completed
waiting -> cancelled      (patient or staff)
called  -> cancelled      (patient or staff)
called  -> no_show        (staff)
called  -> waiting        (staff recall: patient missed the call and gets one more chance)
```

Completed, cancelled and no-show are final. Serving tokens cannot be cancelled; staff complete them,
with an optional "ended early" outcome flag. All changes pass through one transition function inside a
database transaction, and an illegal change is rejected with a clear error. Each change writes an event
row, which is the source for analytics.

**Duplicate prevention.** The database has a partial unique index on `(phone_hash, service_id)` for
active tokens (waiting, called, serving). Check-in also takes a client-generated idempotency key, so a
double-click returns the same token. If a patient already has an active token for that service, the
screen shows the existing token rather than an error.

A repeat check-in with the same idempotency key changes nothing. A repeat check-in with a new key and new
check-in items adds those items to the existing token, re-runs the triage rules, writes an event, and
raises the staff alert if a new suggestion results. Queue order still changes only through staff
confirmation. The screen tells the patient that staff have been notified and to speak to staff if they
feel worse.

## Ordering

The queue is sorted by confirmed priority (Urgent, then Priority, then Routine), then by check-in time.
Every token starts as Routine. A routine token past a configurable wait threshold is flagged to staff
for review. It is not automatically moved, because ordering stays a human decision.

## Triage

**Check-in.** The optional items are plain-language, for example "chest pain", "difficulty breathing",
"high fever", "heavy bleeding", "pregnant", "under 2 years old", "over 75 years old". They are stored as
fixed codes. Free text is not allowed.

**Suggestion.** Transparent rules in `lib/triage/` map codes to a suggested level with reasons. The
output is a level plus the rule that fired, worded as "Suggested for staff review". Any item at the
Urgent rule level raises a highlighted alert in the staff console. The sample rules are illustrative
for the demo and are not clinically validated, and the UI says so.

**On-screen names.** The levels `urgent`, `priority` and `routine` appear to staff as Critical, Urgent
and Routine.

**Human decision.** A staff member opens the suggestion and confirms it or picks a different level.
Overriding requires a reason from a short fixed list. Staff can also raise any token without a
suggestion. Only this action changes `confirmed_priority`. The audit log records the token, suggestion,
reasons, decision, reason for override, and time. Patients never see a level or a suggestion.

## Wait estimate

For a token with `n` people ahead in its service and `c` open counters:

- `mean` and `sd` of service time come from a blend of recent completions today and the historical
  median for that service and hour. The blend weights today's data more as completions accumulate.
- Central estimate: `n * mean / c`.
- Range: `(n * mean ± sqrt(n) * sd) / c`, rounded to the nearest 5 minutes, with a minimum width of 5
  minutes and a floor of 0.
- With no counter open, show "Waiting for a counter to open" instead of a number.

`n` counts every waiting token ordered ahead, plus half of each token already at a counter, since those
patients are on average halfway through their visit. Estimates are recomputed on
read, so a priority confirmation, cancellation or closed counter shows up on the next poll. The admin
page shows the current inputs for any service, so the estimate can be explained.

**Accuracy.** A backtest replays sample data, comparing the blended model with a naive baseline
(`n * default service time / c`), and reports mean absolute error for each, labelled `Sample data`.
The estimate at check-in is stored on the token, so the same error can be calculated from completed
tokens in the current session. That figure is labelled `Measured in demo`, with a note that it includes
generated activity.

## Analytics

- **KPIs:** waiting now, average wait today, longest current wait, tokens served, no-show rate. All
  are labelled `Measured in demo`.
- **Peak hours:** heatmap of arrivals by weekday and hour from sample data, labelled `Sample data`.
- **Bottlenecks:** a service is flagged when its load (arrival rate over service capacity, measured over
  the last 30 minutes) is at or above 1.0, or when its longest wait crosses a threshold. The alert names
  the cause: too few counters, a slow service time, or an arrival surge.
- **Recommendations:** rule-generated actions, for example "Open one more Lab counter from 10:00 to
  12:00". Each shows its impact, calculated by a simple discrete-event simulation with the changed
  counter count, and is labelled `Simulated`. Its input is the patients waiting now plus a forecast of
  arrivals from now on, from the sample data for that weekday, and the card says so.

## Data

Tables: `services`, `counters`, `tokens`, `token_events`, `triage_decisions`, `settings`, and
`historical_visits` (the synthetic sample data).

`tokens` holds the code, service, status, suggested priority, reasons, confirmed priority, timestamps,
idempotency key, the estimate range at check-in, last 4 phone digits and `phone_hash`. No name, birth
date or free text. The hash is
keyed with a local secret and cleared when a token reaches a final state. Check-in item codes are kept
only for the active token, and the audit log keeps the suggestion's reasons without any phone data.

## Sample data and demo

The app is demo-only: there is no separate production mode, and all data is disposable.

The seed generates 30 days of synthetic visits with realistic morning peaks and a clear Lab bottleneck,
labelled synthetic wherever shown. It also creates today's completed tokens and events from 08:00 onward
and a live queue of about 20 tokens, so the dashboard is full from the first view. **Reset demo** rebuilds
this state in a single action.

The app runs on a demo clock stored in settings. Reset sets it to 11:00 on a weekday, and it then ticks in
real time, so the demo behaves the same whenever it is presented.

**Simulate rush** injects arrivals into one service so the bottleneck alert fires live. **Advance time**
jumps the clock forward by up to 30 minutes, stepping minute by minute through the state machine. Serving
tokens complete at a sampled duration, and free open counters call and start the next token. It adds no
new arrivals and no no-shows, and the rest of the system does not depend on it.

### Demo script (about 3 minutes)

1. Check in a patient and show the token with its estimated range.
2. Try to check in again and show the existing token returned.
3. Check in a patient with "chest pain". Show the staff alert and suggestion, confirm it, and watch the
   queue reorder while other patients' ranges update.
4. Override a suggestion, then show the reason in the audit log.
5. Press Simulate rush, then show the bottleneck alert and a labelled recommendation.
6. Apply it by opening a counter and watch the ranges drop.
7. Cancel a token and complete another, showing the display and dashboard staying consistent.

## Assistant's calls

The user handed these to the assistant, so they were not explicitly chosen by the user:

- Next.js App Router with TypeScript, as one app.
- SQLite via `better-sqlite3` and Drizzle ORM, so that it runs locally with no setup.
- 2-second polling instead of WebSockets, for reliability on stage.
- Recharts for charts, Zod for validation, Vitest for tests.
- A statistical estimate and rule-based triage as the "AI". No model training or LLM.
- The product named as "AI" in the brief stays, but the UI says "Suggested" rather than "AI decided".
- Phone number as the duplicate-check identifier.
- Demo-only app, with the demo clock reset to a weekday at 11:00 and a pre-filled morning.
- A fourth and fifth label: `Measured in demo` replaces `Measured`, since no real patients are involved,
  and `Estimated` covers any heuristic figure.
- Simulation input of patients waiting now plus a forecast from sample data.
- Staff can record a decision for any active token, so a called patient reporting a new item still
  reaches staff review.
- People at a counter count as half a visit in the estimate, after review showed that counting them as
  a full visit overestimated waits.
- The simple minute-by-minute Advance time described above.
- New items on a repeat check-in are merged and alert staff, rather than being dropped.

## Left to the builder

Visual design, exact thresholds, blend weights, the seed distribution, the final list of check-in items
and their rule mapping, and the order of work within the 12 hours. If time runs short, cut in this order:
Advance time, the backtest panel, the simulation (keeping heuristic figures labelled `Estimated`). Never cut the
triage review, duplicate prevention or the state machine.
