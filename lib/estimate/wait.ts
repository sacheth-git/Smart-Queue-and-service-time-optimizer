export type WaitEstimate =
  | { kind: "range"; lowMin: number; highMin: number; midMin: number }
  | { kind: "no_counter" };

/** Someone already at a counter is, on average, about halfway through their visit. */
export function effectiveAhead(waiting: number, atCounter: number): number {
  return waiting + atCounter / 2;
}

const roundTo5 = (minutes: number) => Math.round(minutes / 5) * 5;

export function estimateWait(input: {
  ahead: number;
  openCounters: number;
  mean: number;
  sd: number;
}): WaitEstimate {
  const { ahead, openCounters, mean, sd } = input;
  if (openCounters <= 0) return { kind: "no_counter" };
  const midMin = (ahead * mean) / openCounters;
  const spread = (Math.sqrt(ahead) * sd) / openCounters;
  const lowMin = Math.max(0, roundTo5(midMin - spread));
  let highMin = Math.max(0, roundTo5(midMin + spread));
  if (highMin - lowMin < 5) highMin = lowMin + 5;
  return { kind: "range", lowMin, highMin, midMin };
}

export function meanOf(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function sdOf(values: number[]): number {
  const m = meanOf(values);
  return Math.sqrt(meanOf(values.map((v) => (v - m) ** 2)));
}

/** Trusts today more as completions build up: 5 completions gives an even split. */
export function blendServiceTime(input: {
  todayMinutes: number[];
  historicalMedian: number;
  historicalSd: number;
}): { mean: number; sd: number; todayWeight: number } {
  const { todayMinutes, historicalMedian, historicalSd } = input;
  const k = todayMinutes.length;
  if (k === 0) return { mean: historicalMedian, sd: historicalSd, todayWeight: 0 };
  const todayWeight = k / (k + 5);
  const mean = todayWeight * meanOf(todayMinutes) + (1 - todayWeight) * historicalMedian;
  const sd = k < 2 ? historicalSd : todayWeight * sdOf(todayMinutes) + (1 - todayWeight) * historicalSd;
  return { mean, sd, todayWeight };
}
