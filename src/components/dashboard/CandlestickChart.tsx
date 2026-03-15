"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import type { OHLCResponse, OHLCCandle, SignalEvent, CandleUpdate } from "@/lib/api";

// Types only (runtime import happens in useEffect)
import type { IChartApi, ISeriesApi, CandlestickData, SeriesMarker, Time } from "lightweight-charts";

interface CandlestickChartProps {
  currentCandle: CandleUpdate | null;
  signals: SignalEvent[];
  connected: boolean;
}

type Timeframe = "1m" | "5m" | "15m";
type Instrument = "spot" | "fut";

export default function CandlestickChart({
  currentCandle,
  signals,
  connected,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [instrument, setInstrument] = useState<Instrument>("spot");
  const [loading, setLoading] = useState(false);

  // Create chart on mount (dynamic import to avoid SSR window access)
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    import("lightweight-charts").then((lc) => {
      if (disposed || !containerRef.current) return;

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 380,
        layout: {
          background: { color: "#111827" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#1e293b" },
          horzLines: { color: "#1e293b" },
        },
        crosshair: { mode: lc.CrosshairMode.Normal },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#1e293b",
        },
        rightPriceScale: { borderColor: "#1e293b" },
      });

      const series = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      chartRef.current = chart;
      seriesRef.current = series;

      observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          chart.applyOptions({ width: entries[0].contentRect.width });
        }
      });
      observer.observe(containerRef.current!);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // Fetch candles on timeframe/instrument change or reconnect
  const loadCandles = useCallback(async () => {
    if (!seriesRef.current) return;
    setLoading(true);
    try {
      const data = await fetchAPI<OHLCResponse>(
        `/api/candles/ohlc?instrument=${instrument}&timeframe=${timeframe}&count=200`
      );
      const formatted: CandlestickData[] = data.candles.map((c: OHLCCandle) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      seriesRef.current.setData(formatted);

      // Add signal markers
      if (signals.length > 0) {
        const markers: SeriesMarker<Time>[] = signals
          .filter((s) => s.instrument === instrument)
          .map((s) => {
            const isBullish = s.strategy.includes("bullish");
            return {
              time: (Math.floor(new Date(s.timestamp).getTime() / 1000)) as Time,
              position: isBullish ? "belowBar" as const : "aboveBar" as const,
              color: isBullish ? "#22c55e" : "#ef4444",
              shape: isBullish ? "arrowUp" as const : "arrowDown" as const,
              text: s.strategy.replace("_", " ").toUpperCase(),
            };
          })
          .sort((a, b) => (a.time as number) - (b.time as number));
        seriesRef.current.setMarkers(markers);
      }

      chartRef.current?.timeScale().fitContent();
    } catch {
      // Silently handle fetch errors
    }
    setLoading(false);
  }, [instrument, timeframe, signals]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  // Reload on reconnect
  useEffect(() => {
    if (connected) loadCandles();
  }, [connected, loadCandles]);

  // Real-time candle updates
  useEffect(() => {
    if (
      currentCandle &&
      seriesRef.current &&
      currentCandle.instrument === instrument &&
      currentCandle.timeframe === timeframe
    ) {
      seriesRef.current.update({
        time: currentCandle.candle.time as Time,
        open: currentCandle.candle.open,
        high: currentCandle.candle.high,
        low: currentCandle.candle.low,
        close: currentCandle.candle.close,
      });
    }
  }, [currentCandle, instrument, timeframe]);

  const tfButtons: Timeframe[] = ["1m", "5m", "15m"];
  const instButtons: Instrument[] = ["spot", "fut"];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-1">
          {tfButtons.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-[10px] font-medium rounded ${
                timeframe === tf
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-[10px] text-slate-500 animate-pulse">Loading...</span>
          )}
          <div className="flex items-center gap-1">
            {instButtons.map((inst) => (
              <button
                key={inst}
                onClick={() => setInstrument(inst)}
                className={`px-2 py-1 text-[10px] font-medium rounded ${
                  instrument === inst
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {inst.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Chart container */}
      <div ref={containerRef} className="w-full" style={{ height: 380 }} />
    </div>
  );
}
