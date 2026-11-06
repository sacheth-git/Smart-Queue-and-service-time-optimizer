export type Arrival = { atMin: number; serviceMin: number };
export type SimulatedVisit = { startMin: number; waitMin: number };

/** First-come queue over several counters. Results are in arrival order. */
export function simulateQueue(arrivals: Arrival[], counters: number): SimulatedVisit[] {
  const freeAt = new Array<number>(Math.max(1, counters)).fill(0);
  return arrivals.map(({ atMin, serviceMin }) => {
    const soonest = freeAt.indexOf(Math.min(...freeAt));
    const startMin = Math.max(atMin, freeAt[soonest]);
    freeAt[soonest] = startMin + serviceMin;
    return { startMin, waitMin: startMin - atMin };
  });
}
