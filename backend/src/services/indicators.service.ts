/**
 * indicators.ts
 *
 * Pure, dependency-free technical indicator math. Every function takes
 * plain numeric arrays (no candle objects) so it's trivially testable and
 * reusable from both the REST layer and the WebSocket signal loop.
 *
 * Conventions:
 *  - Arrays are oldest-first, same length as the input closes/highs/lows.
 *  - Where an indicator needs `period` bars of warmup, leading entries are
 *    `null` rather than 0 — silently returning 0 would be indistinguishable
 *    from a real zero-crossing value and corrupt downstream signal logic.
 */

export type Series = number[];

export function ema(values: Series, period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(values.length).fill(null);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    out[i] = values[i] * k + (out[i - 1] as number) * (1 - k);
  }
  return out;
}

export function sma(values: Series, period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    out[i] = s / period;
  }
  return out;
}

export function rsi(closes: Series, period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

export function stochasticRsi(closes: Series, period = 14, smoothK = 3): (number | null)[] {
  const r = rsi(closes, period);
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i < period * 2) continue;
    const slice = r.slice(i - period + 1, i + 1).filter((v): v is number => v !== null);
    if (slice.length < period) continue;
    const min = Math.min(...slice), max = Math.max(...slice);
    const rVal = r[i];
    out[i] = max === min || rVal === null ? 50 : ((rVal - min) / (max - min)) * 100;
  }
  const smoothed = sma(out.map((v) => v ?? 0), smoothK);
  return smoothed.map((v, i) => (out[i] === null ? null : v));
}

export function trueRange(highs: Series, lows: Series, closes: Series): number[] {
  const out = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    out.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return out;
}

export function atr(highs: Series, lows: Series, closes: Series, period = 14): (number | null)[] {
  const tr = trueRange(highs, lows, closes);
  return ema(tr, period);
}

function wilderSmoothSum(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i] || 0;
  out[period - 1] = sum;
  for (let i = period; i < values.length; i++) {
    out[i] = (out[i - 1] as number) - (out[i - 1] as number) / period + values[i];
  }
  return out;
}

function wilderSmoothAvg(values: number[], period: number, startIdx: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = startIdx; i < startIdx + period && i < values.length; i++) sum += values[i] || 0;
  const seedIdx = startIdx + period - 1;
  if (seedIdx >= values.length) return out;
  out[seedIdx] = sum / period;
  for (let i = seedIdx + 1; i < values.length; i++) {
    out[i] = ((out[i - 1] as number) * (period - 1) + values[i]) / period;
  }
  return out;
}

export interface AdxResult {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
}

export function adx(highs: Series, lows: Series, closes: Series, period = 14): AdxResult {
  const len = highs.length;
  const plusDM = [0], minusDM = [0];
  for (let i = 1; i < len; i++) {
    const up = highs[i] - highs[i - 1], down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const tr = trueRange(highs, lows, closes);
  const sTR = wilderSmoothSum(tr, period);
  const sP = wilderSmoothSum(plusDM, period);
  const sM = wilderSmoothSum(minusDM, period);
  const plusDI = sTR.map((v, i) => (v ? (100 * (sP[i] as number)) / v : 0));
  const minusDI = sTR.map((v, i) => (v ? (100 * (sM[i] as number)) / v : 0));
  const dx = plusDI.map((v, i) => {
    const s = v + minusDI[i];
    return s ? (100 * Math.abs(v - minusDI[i])) / s : 0;
  });
  const adxLine = wilderSmoothAvg(dx, period, period - 1);
  return { adx: adxLine, plusDI, minusDI };
}

export interface MacdResult {
  line: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(closes: Series, fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(closes, fast) as number[];
  const emaSlow = ema(closes, slow) as number[];
  const line = emaFast.map((v, i) => v - emaSlow[i]);
  const sig = ema(line, signalPeriod) as number[];
  const hist = line.map((v, i) => v - sig[i]);
  return { line, signal: sig, histogram: hist };
}

export interface BollingerResult {
  upper: (number | null)[];
  mid: (number | null)[];
  lower: (number | null)[];
}

export function bollingerBands(closes: Series, period = 20, mult = 2): BollingerResult {
  const mid = sma(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i] as number;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, mid, lower };
}

export interface KeltnerResult {
  upper: (number | null)[];
  mid: (number | null)[];
  lower: (number | null)[];
}

export function keltnerChannels(highs: Series, lows: Series, closes: Series, period = 20, mult = 2): KeltnerResult {
  const mid = ema(closes, period);
  const atrVals = atr(highs, lows, closes, period);
  const upper = mid.map((v, i) => (v === null || atrVals[i] === null ? null : v + mult * (atrVals[i] as number)));
  const lower = mid.map((v, i) => (v === null || atrVals[i] === null ? null : v - mult * (atrVals[i] as number)));
  return { upper, mid, lower };
}

export interface DonchianResult {
  upper: (number | null)[];
  lower: (number | null)[];
  mid: (number | null)[];
}

export function donchianChannels(highs: Series, lows: Series, period = 20): DonchianResult {
  const upper: (number | null)[] = new Array(highs.length).fill(null);
  const lower: (number | null)[] = new Array(lows.length).fill(null);
  for (let i = period - 1; i < highs.length; i++) {
    upper[i] = Math.max(...highs.slice(i - period + 1, i + 1));
    lower[i] = Math.min(...lows.slice(i - period + 1, i + 1));
  }
  const mid = upper.map((v, i) => (v === null || lower[i] === null ? null : (v + (lower[i] as number)) / 2));
  return { upper, lower, mid };
}

export function vwap(highs: Series, lows: Series, closes: Series, volumes: Series): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  let cumPV = 0, cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const typical = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += typical * volumes[i];
    cumVol += volumes[i];
    out[i] = cumVol ? cumPV / cumVol : null;
  }
  return out;
}

export function obv(closes: Series, volumes: Series): number[] {
  const out = [0];
  for (let i = 1; i < closes.length; i++) {
    const prev = out[i - 1];
    if (closes[i] > closes[i - 1]) out.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) out.push(prev - volumes[i]);
    else out.push(prev);
  }
  return out;
}

export function moneyFlowIndex(highs: Series, lows: Series, closes: Series, volumes: Series, period = 14): (number | null)[] {
  const typical = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawFlow = typical.map((t, i) => t * volumes[i]);
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    let posFlow = 0, negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (typical[j] > typical[j - 1]) posFlow += rawFlow[j];
      else if (typical[j] < typical[j - 1]) negFlow += rawFlow[j];
    }
    const ratio = negFlow === 0 ? 100 : posFlow / negFlow;
    out[i] = 100 - 100 / (1 + ratio);
  }
  return out;
}

export function cci(highs: Series, lows: Series, closes: Series, period = 20): (number | null)[] {
  const typical = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < typical.length; i++) {
    const slice = typical.slice(i - period + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const meanDev = slice.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    out[i] = meanDev === 0 ? 0 : (typical[i] - mean) / (0.015 * meanDev);
  }
  return out;
}

export function williamsR(highs: Series, lows: Series, closes: Series, period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    out[i] = hh === ll ? 0 : ((hh - closes[i]) / (hh - ll)) * -100;
  }
  return out;
}

export function awesomeOscillator(highs: Series, lows: Series): (number | null)[] {
  const median = highs.map((h, i) => (h + lows[i]) / 2);
  const fast = sma(median, 5);
  const slow = sma(median, 34);
  return fast.map((v, i) => (v === null || slow[i] === null ? null : v - (slow[i] as number)));
}

export function momentum(closes: Series, period = 10): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) out[i] = closes[i] - closes[i - period];
  return out;
}

export function rateOfChange(closes: Series, period = 10): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    out[i] = closes[i - period] === 0 ? null : ((closes[i] - closes[i - period]) / closes[i - period]) * 100;
  }
  return out;
}

export interface SuperTrendResult {
  line: (number | null)[];
  direction: number[]; // 1 = bullish (line acts as support), -1 = bearish (resistance)
}

export function superTrend(highs: Series, lows: Series, closes: Series, period = 10, mult = 3): SuperTrendResult {
  const atrVals = atr(highs, lows, closes, period) as number[];
  const out: (number | null)[] = new Array(closes.length).fill(null);
  const dir: number[] = new Array(closes.length).fill(1);
  let prevUpper = (highs[0] + lows[0]) / 2 + mult * (atrVals[0] || 0);
  let prevLower = (highs[0] + lows[0]) / 2 - mult * (atrVals[0] || 0);
  for (let i = 0; i < closes.length; i++) {
    const mid = (highs[i] + lows[i]) / 2;
    const basicUpper = mid + mult * (atrVals[i] || 0);
    const basicLower = mid - mult * (atrVals[i] || 0);
    const upper = basicUpper < prevUpper || closes[i - 1] > prevUpper ? basicUpper : prevUpper;
    const lower = basicLower > prevLower || closes[i - 1] < prevLower ? basicLower : prevLower;
    if (i === 0) { out[i] = lower; dir[i] = 1; }
    else {
      if (dir[i - 1] === 1) dir[i] = closes[i] < lower ? -1 : 1;
      else dir[i] = closes[i] > upper ? 1 : -1;
      out[i] = dir[i] === 1 ? lower : upper;
    }
    prevUpper = upper; prevLower = lower;
  }
  return { line: out, direction: dir };
}

export function parabolicSar(highs: Series, lows: Series, step = 0.02, max = 0.2): (number | null)[] {
  const len = highs.length;
  const out: (number | null)[] = new Array(len).fill(null);
  let isUp = true, af = step, ep = highs[0], s = lows[0];
  out[0] = s;
  for (let i = 1; i < len; i++) {
    s = s + af * (ep - s);
    if (isUp) {
      s = Math.min(s, lows[i - 1], i > 1 ? lows[i - 2] : lows[i - 1]);
      if (lows[i] < s) { isUp = false; s = ep; af = step; ep = lows[i]; }
      else if (highs[i] > ep) { ep = highs[i]; af = Math.min(af + step, max); }
    } else {
      s = Math.max(s, highs[i - 1], i > 1 ? highs[i - 2] : highs[i - 1]);
      if (highs[i] > s) { isUp = true; s = ep; af = step; ep = highs[i]; }
      else if (lows[i] < ep) { ep = lows[i]; af = Math.min(af + step, max); }
    }
    out[i] = s;
  }
  return out;
}

export interface IchimokuResult {
  conversion: (number | null)[]; // Tenkan-sen
  base: (number | null)[]; // Kijun-sen
  spanA: (number | null)[];
  spanB: (number | null)[];
}

export function ichimoku(highs: Series, lows: Series): IchimokuResult {
  const conv: (number | null)[] = [], base: (number | null)[] = [], spanA: (number | null)[] = [], spanB: (number | null)[] = [];
  for (let i = 0; i < highs.length; i++) {
    const tenkan = i >= 8 ? (Math.max(...highs.slice(i - 8, i + 1)) + Math.min(...lows.slice(i - 8, i + 1))) / 2 : null;
    const kijun = i >= 25 ? (Math.max(...highs.slice(i - 25, i + 1)) + Math.min(...lows.slice(i - 25, i + 1))) / 2 : null;
    conv.push(tenkan);
    base.push(kijun);
    spanA.push(tenkan !== null && kijun !== null ? (tenkan + kijun) / 2 : null);
    spanB.push(i >= 51 ? (Math.max(...highs.slice(i - 51, i + 1)) + Math.min(...lows.slice(i - 51, i + 1))) / 2 : null);
  }
  return { conversion: conv, base, spanA, spanB };
}

export interface FibLevel {
  level: number;
  price: number;
}

export function fibonacciRetracement(highs: Series, lows: Series, lookback = 50): { swingHigh: number; swingLow: number; levels: FibLevel[] } {
  const h = highs.slice(-lookback), l = lows.slice(-lookback);
  const swingHigh = Math.max(...h), swingLow = Math.min(...l);
  const range = swingHigh - swingLow;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((r) => ({ level: r, price: swingHigh - range * r }));
  return { swingHigh, swingLow, levels };
}

export interface PivotPoints {
  pivot: number;
  r1: number; r2: number; r3: number;
  s1: number; s2: number; s3: number;
}

/** Classic floor-trader pivot points from the prior period's H/L/C. */
export function pivotPoints(prevHigh: number, prevLow: number, prevClose: number): PivotPoints {
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const r1 = 2 * pivot - prevLow;
  const s1 = 2 * pivot - prevHigh;
  const r2 = pivot + (prevHigh - prevLow);
  const s2 = pivot - (prevHigh - prevLow);
  const r3 = prevHigh + 2 * (pivot - prevLow);
  const s3 = prevLow - 2 * (prevHigh - pivot);
  return { pivot, r1, r2, r3, s1, s2, s3 };
}

/** Heikin-Ashi smoothed candles, derived from regular OHLC. */
export interface HeikinAshiCandle {
  open: number; high: number; low: number; close: number;
}
export function heikinAshi(opens: Series, highs: Series, lows: Series, closes: Series): HeikinAshiCandle[] {
  const out: HeikinAshiCandle[] = [];
  for (let i = 0; i < closes.length; i++) {
    const haClose = (opens[i] + highs[i] + lows[i] + closes[i]) / 4;
    const haOpen = i === 0 ? (opens[i] + closes[i]) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    const haHigh = Math.max(highs[i], haOpen, haClose);
    const haLow = Math.min(lows[i], haOpen, haClose);
    out.push({ open: haOpen, high: haHigh, low: haLow, close: haClose });
  }
  return out;
}
