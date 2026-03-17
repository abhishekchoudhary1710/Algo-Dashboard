"use client";

import { useEffect, useRef } from "react";
import type { TradeExcursion } from "@/lib/api";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";

interface EquityCurveWidgetProps {
  excursions: TradeExcursion[];
}

function computeTradePnL(t: TradeExcursion): number {
  const risk = t.option_entry_price - t.option_sl;
  if (risk <= 0) return 0;
  if (t.status === "OPTION_TARGET_HIT")
    return (t.option_target - t.option_entry_price) * t.quantity;
  if (t.status === "OPTION_SL_HIT")
    return (t.option_sl - t.option_entry_price) * t.quantity;
  // TRACKING / CLOSED: use rr_achieved as proxy
  return t.option_rr_achieved * risk * t.quantity;
}

export default function EquityCurveWidget({ excursions }: EquityCurveWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equityRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ddRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    import("lightweight-charts").then((lc) => {
      if (disposed || !containerRef.current) return;

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 160,
        layout: { background: { color: "#111827" }, textColor: "#9ca3af" },
        grid: { vertLines: { visible: false }, horzLines: { color: "#1e293b" } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e293b" },
        rightPriceScale: { borderColor: "#1e293b" },
      });

      equityRef.current = chart.addLineSeries({
        color: "#22c55e",
        lineWidth: 2,
        priceLineVisible: false,
        title: "PnL ₹",
      });

      ddRef.current = chart.addAreaSeries({
        lineColor: "#ef4444",
        topColor: "rgba(239,68,68,0.3)",
        bottomColor: "rgba(239,68,68,0.0)",
        lineWidth: 1,
        priceLineVisible: false,
        title: "Drawdown",
      });

      chartRef.current = chart;
      observer = new ResizeObserver((entries) => {
        if (entries[0])
          chart.applyOptions({
            width: entries[0].contentRect.width,
            height: entries[0].contentRect.height || 160,
          });
      });
      observer.observe(containerRef.current!);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      equityRef.current = null;
      ddRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!equityRef.current || !ddRef.current) return;

    const sorted = [...excursions].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );

    let cumPnL = 0;
    let peak = 0;
    const equityData: { time: Time; value: number }[] = [];
    const ddData: { time: Time; value: number }[] = [];

    sorted.forEach((t) => {
      const baseTs = Math.floor(new Date(t.timestamp).getTime() / 1000);
      // Ensure strictly increasing timestamps
      const ts = (equityData.length > 0 && baseTs <= (equityData[equityData.length - 1].time as number))
        ? (equityData[equityData.length - 1].time as number) + 1
        : baseTs;

      cumPnL += computeTradePnL(t);
      if (cumPnL > peak) peak = cumPnL;
      const dd = peak > 0 ? -(peak - cumPnL) : 0;

      equityData.push({ time: ts as Time, value: Math.round(cumPnL) });
      ddData.push({ time: ts as Time, value: Math.round(dd) });
    });

    if (equityData.length > 0) {
      equityRef.current.setData(equityData);
      ddRef.current.setData(ddData);
      chartRef.current?.timeScale().fitContent();
    } else {
      equityRef.current.setData([]);
      ddRef.current.setData([]);
    }
  }, [excursions]);

  const totalPnL = excursions.reduce((s, t) => s + computeTradePnL(t), 0);
  const pnlColor = totalPnL >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-slate-400 font-medium">Equity Curve</span>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold font-mono ${pnlColor}`}>
            {totalPnL >= 0 ? "+" : ""}₹{Math.round(totalPnL).toLocaleString()}
          </span>
          <div className="flex gap-2 text-[10px]">
            <span className="text-green-400">● PnL</span>
            <span className="text-red-400">● DD</span>
          </div>
        </div>
      </div>
      {excursions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-500">No trades today</p>
        </div>
      ) : (
        <div ref={containerRef} className="w-full flex-1" />
      )}
    </div>
  );
}
