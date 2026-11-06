# PulseQueue AI

Smart queue and service-time optimization for a hospital outpatient department. Built for PS-13.

Patients get a digital token and an honest wait range. Staff get a live queue and suggested priority
that they confirm themselves. Administrators see peak hours, bottlenecks and tested staffing changes.

## Run it

Needs Node 24. No API keys, Docker or internet connection are needed once it is installed.

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000. Every start restores the demo to a weekday at 11:00. All data is synthetic.

The demo clock keeps running, so press **Reset demo** just before presenting.

Other commands: `npm test`, `npm run typecheck`, `npm run lint`.

## Demo script

Put **Staff** and **Admin** side by side, with a patient token page in a third window.

1. **Check-in:** get a token for General OPD and open its token page to show the estimated range.
2. **Duplicates:** check in again with the same phone number. The existing token comes back.
3. **Triage:** check in with "Chest pain". On Staff, the urgent suggestion appears. Press **Confirm Critical**
   and watch the queue reorder.
4. **Override:** press **Change level** on another suggestion, pick a reason, and show it in the Admin audit log.
5. **Bottleneck:** on Admin, press **Simulate rush**. The Lab alert appears and the `Simulated`
   recommendation jumps.
6. **Act on it:** on Staff, open the **Lab** tab and press **Open counter**. Open the token page for the last
   Lab token first, so that judges can see its range drop.
7. **Consistency:** cancel a token and complete another. The display and dashboard stay in agreement.

Press **Reset demo** to start again.

## How the "AI" works

There is no LLM, so it runs offline and every result can be explained.

- **Wait estimate:** people ahead × average visit ÷ open counters, shown as a range. Anyone already at a
  counter counts as half a visit. The average blends sample history for that hour with today's completed
  visits.
- **Priority suggestion:** transparent rules map check-in items to a suggested level with reasons.
- **Recommendations:** a queue simulation compares the current counters with one more.

## Limits

- This is a demo. There is no login, and the role switcher is open to anyone.
- All data is synthetic, and the numbers describe that data, not a real hospital.
- The triage rules are illustrative and not clinically validated.
# Smart-Queue-and-service-time-optimizer
