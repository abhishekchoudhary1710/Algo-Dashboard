"use client";

import { useEffect, useRef } from "react";
import type { EntrySignal } from "@/lib/api";

import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";

interface ExposureCurveProps {
  entries: EntrySignal[];
}

export default function ExposureCurve({ entries }: ExposureCurveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    import("lightweight-charts").then((lc) => {
      if (disposed || !containerRef.current) return;

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 160,
        layout: { background: { color: "#111827" }, textColor: "#9ca3af" },
        grid: { vertLines: { visible: false }, horzLines: { color: "#1e293b" } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e293b" },
        rightPriceScale: { borderColor: "#1e293b" },
      });

      const series = chart.addAreaSeries({
        lineColor: "#3b82f6",
        topColor: "rgba(59,130,246,0.4)",
        bottomColor: "rgba(59,130,246,0.0)",
        lineWidth: 2,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      observer = new ResizeObserver((entries) => {
        if (entries[0]) chart.applyOptions({ width: entries[0].contentRect.width });
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

  // Update data when entries change
  useEffect(() => {
    if (!seriesRef.current || entries.length === 0) return;

    let cumulative = 0;
    const dataPoints = entries
      .filter((e) => e.risk && e.timestamp)
      .map((e) => {
        cumulative += Number(e.risk) || 0;
        const ts = Math.floor(new Date(e.timestamp).getTime() / 1000);
        return { time: ts as Time, value: cumulative };
      });

    if (dataPoints.length > 0) {
      seriesRef.current.setData(dataPoints);
      chartRef.current?.timeScale().fitContent();
    }
  }, [entries]);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700">
        <span className="text-xs text-slate-400 font-medium">
          Risk Exposure (Cumulative)
        </span>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 160 }} />
    </div>
  );
}
