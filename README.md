# Sher — Market Analysis Terminal

Sher is a technical analysis and trade-journaling dashboard. It generates BUY/SELL/WAIT signals from real, licensed market data and tracks your own logged trade outcomes over time. **It does not place trades automatically, and it does not support OTC/synthetic price feeds.**

## Why no OTC mode

Retail trading platforms that offer "OTC" instruments outside normal market hours generate those quotes internally — they are not published by any licensed market data provider. That means no external analysis tool, including this one, can observe or validate an OTC feed. Sher only analyzes pairs and timeframes backed by data Sher can actually see and license (currently via [Twelve Data](https://twelvedata.com)). If you're looking for a tool to generate signals for an OTC/binary-options platform, this isn't it — and as far as we know, no genuinely data-backed tool can be, since the underlying price series isn't externally observable.

## What "confidence" means here

The signal engine's confidence/conviction score measures **how strongly the enabled indicators agree with each other**, weighted by configured importance — not a statistically validated probability of the next candle's outcome. See `backend/src/services/signal.service.ts` for the full reasoning and the smart-filter logic that suppresses signals when conditions are unfavorable (sideways market, low volume, low agreement).

## Project structure

```
sher/
├── backend/          Express + TypeScript API, Prisma/Postgres, Redis cache
│   ├── src/services/   Indicator math, price action, signal engine, market data
│   ├── src/routes/      REST endpoints
│   ├── src/websocket/   Live price/signal broadcast
│   ├── prisma/schema.prisma
│   └── .env.example
└── frontend/         Next.js + TypeScript + Tailwind dashboard
    ├── src/app/          Pages (dashboard, journal, watchlist, settings)
    ├── src/components/   UI, charts, dashboard widgets
    └── src/lib/          API client, IST time utilities
```

## Setup

### Backend
```bash
cd backend
cp .env.example .env   # fill in TWELVE_DATA_API_KEY, DATABASE_URL, REDIS_URL
npm install
npm run prisma:migrate
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker (full stack incl. Postgres + Redis)
```bash
docker compose up --build
```

## Notable implementation notes

- **All market-hours/session logic is computed in explicit IST (UTC+5:30)**, independent of server or client local timezone — see `istTime.util.ts` (backend) and `istTime.ts` (frontend).
- **The `30s` timeframe is not served.** No licensed forex data provider publishes real sub-1-minute candles for spot FX; the backend rejects this timeframe with a 422 rather than silently substituting 1-minute data under a misleading label.
- **Forex has no centralized volume.** Spot FX is OTC at the interbank level, so "volume" from any forex data provider is a tick-count proxy, not real trade volume. The signal engine's volume vote is weighted accordingly and this is surfaced honestly rather than presented as exchange-grade volume.
- **Charting uses lightweight-charts v5**, which replaced the old `chart.addCandlestickSeries()` method with `chart.addSeries(CandlestickSeries, options)`. If you see older tutorials using the v4 syntax, don't copy it in here.
