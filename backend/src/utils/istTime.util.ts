/**
 * istTime.util.ts
 *
 * All market-hours and session logic in Sher is computed in explicit IST
 * (UTC+5:30), independent of server or client local timezone. We derive IST
 * by reading the true UTC instant and applying the fixed offset ourselves,
 * rather than relying on any environment's local-timezone Date methods.
 */

import { MarketStatusDto } from "../types/market.types";

export interface ISTParts {
  hour: number;
  minute: number;
  second: number;
  day: number; // 0 = Sunday
  totalMinutes: number;
}

export function toIST(date: Date): ISTParts {
  const utcMs = date.getTime(); // Date.prototype.getTime() is always a true UTC instant
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

/** Forex market: opens Mon 03:30 IST, closes Sat 03:30 IST (Fri 22:00 UTC / Sun 22:00 UTC). */
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

export function getSession(ist: ISTParts): {
  asian: boolean; london: boolean; ny: boolean; overlap: boolean;
  label: string; key: MarketStatusDto["session"]; volatility: MarketStatusDto["volatilityExpectation"];
} {
  const tm = ist.totalMinutes;
  const asian = inRange(tm, 330, 870);   // 05:30–14:30 IST
  const london = inRange(tm, 750, 1290); // 12:30–21:30 IST
  const ny = inRange(tm, 1050, 150);     // 17:30–02:30(+1) IST
  const overlap = london && ny;

  if (overlap) return { asian, london, ny, overlap, label: "London / New York Overlap", key: "overlap", volatility: "Very High" };
  if (london) return { asian, london, ny, overlap, label: "London Session", key: "london", volatility: "High" };
  if (ny) return { asian, london, ny, overlap, label: "New York Session", key: "new_york", volatility: "High" };
  if (asian) return { asian, london, ny, overlap, label: "Asian Session", key: "asian", volatility: "Moderate" };
  return { asian, london, ny, overlap, label: "Off-session (low liquidity)", key: "off_session", volatility: "Low" };
}

export function getMarketStatus(date: Date = new Date()): MarketStatusDto {
  const ist = toIST(date);
  const session = getSession(ist);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    isOpen: isMarketOpen(ist),
    istTime: `${pad(ist.hour)}:${pad(ist.minute)}:${pad(ist.second)}`,
    session: session.key,
    sessionLabel: session.label,
    volatilityExpectation: session.volatility,
  };
}
