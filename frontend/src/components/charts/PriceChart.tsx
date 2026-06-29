"use client";

import { useEffect, useRef } from "react";
import {
  createChart, IChartApi, ISeriesApi, ColorType, CandlestickData, UTCTimestamp, CandlestickSeries,
} from "lightweight-charts";
import { Candle } from "@/types/market.types";

interface PriceChartProps {
  candles: Candle[];
  height?: number;
}

export function PriceChart({ candles, height = 380 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8E96A8",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "#222937" },
      timeScale: { borderColor: "#222937", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });

    // v5 API: series types are imported and passed to addSeries() — the old
    // per-type addCandlestickSeries() method was removed in v5.
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#3DD9E8",
      downColor: "#FF5C7A",
      borderUpColor: "#3DD9E8",
      borderDownColor: "#FF5C7A",
      wickUpColor: "#3DD9E8",
      wickDownColor: "#FF5C7A",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="w-full" />;
}

