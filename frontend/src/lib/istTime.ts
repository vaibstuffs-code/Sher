/**
 * istTime.ts — frontend mirror of the backend's IST utility. Kept
 * dependency-free and identical in behavior so client-rendered countdowns
 * (which can't wait on a round trip for every tick) match what the server
 * will eventually confirm.
 */

export interface ISTParts {
  hour: number;
  minute: number;
  second: number;
  day: number;
  totalMinutes: number;
}

export function toIST(date: Date): ISTParts {
  const utcMs = date.getTime();
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return {
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
    second: ist.getUTCSeconds(),
    day: ist.getUTCDay(),
    totalMinutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

export function isMarketOpen(ist: ISTParts): boolean {
  const { day, totalMinutes } = ist;
  if (day === 0) return false;
  if (day === 1) return totalMinutes >= 210;
  if (day === 6) return totalMinutes < 210;
  return true;
}

function inRange(tm: number, start: number, end: number): boolean {
  return start <= end ? tm >= start && tm < end : tm >= start || tm < end;
}

export function getSessionLabel(ist: ISTParts): { label: string; volatility: string } {
  const tm = ist.totalMinutes;
  const asian = inRange(tm, 330, 870);
  const london = inRange(tm, 750, 1290);
  const ny = inRange(tm, 1050, 150);
  if (london && ny) return { label: "London / New York Overlap", volatility: "Very High" };
  if (london) return { label: "London Session", volatility: "High" };
  if (ny) return { label: "New York Session", volatility: "High" };
  if (asian) return { label: "Asian Session", volatility: "Moderate" };
  return { label: "Off-session", volatility: "Low" };
}

export function formatISTClock(ist: ISTParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.hour)}:${pad(ist.minute)}:${pad(ist.second)}`;
}

/** Seconds remaining until the next candle close for a given timeframe, in IST. */
export function secondsToNextCandle(ist: ISTParts, timeframeSeconds: number): number {
  const nowSeconds = ist.totalMinutes * 60 + ist.second;
  const remainder = nowSeconds % timeframeSeconds;
  return remainder === 0 ? timeframeSeconds : timeframeSeconds - remainder;
}
