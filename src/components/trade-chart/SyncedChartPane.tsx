"use client";

import { useEffect, useRef, useState } from "react";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  SeriesMarker,
  Time,
  MouseEventParams,
} from "lightweight-charts";
import type { OHLCCandle } from "@/lib/api";
import type { StructurePoint, Tf } from "./tradeChartData";

export interface PositionRect {
  // Position-tool rectangle. Drawn only on charts where prices live in this scale.
  entryPrice: number;
  slPrice: number;
  targetPrice: number;
  entryTimeUnix: number;
  exitTimeUnix: number | null;
  direction: "LONG" | "SHORT";
}

interface SyncedChartPaneProps {
  title: string;
  accent: "spot" | "fut" | "option";
  candles1m: OHLCCandle[];
  candles5m: OHLCCandle[];
  defaultTf?: Tf;
  // Note: default is 5m (set in destructure below).

  entryTimeUnix: number | null;
  exitTimeUnix: number | null;
  exitReason: string | null;

  position: PositionRect | null;
  markers: StructurePoint[];

  // Crosshair sync (Fyers-style)
  registerChart: (id: string, chart: IChartApi, series: ISeriesApi<"Candlestick">) => void;
  unregisterChart: (id: string) => void;
  paneId: string;
}

const ACCENT = {
  spot:   { ring: "border-cyan-500/40",   text: "text-cyan-300",   dot: "bg-cyan-500",   tag: "bg-cyan-500/15"   },
  fut:    { ring: "border-purple-500/40", text: "text-purple-300", dot: "bg-purple-500", tag: "bg-purple-500/15" },
  option: { ring: "border-amber-500/40",  text: "text-amber-300",  dot: "bg-amber-500",  tag: "bg-amber-500/15"  },
};

interface OHLCReadout {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
}

export default function SyncedChartPane(props: SyncedChartPaneProps) {
  const {
    title, accent, candles1m, candles5m, defaultTf = "5m",
    entryTimeUnix, exitTimeUnix, exitReason,
    position, markers,
    registerChart, unregisterChart, paneId,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [tf, setTf] = useState<Tf>(defaultTf);
  const [ready, setReady] = useState(false);
  const [ohlc, setOhlc] = useState<OHLCReadout | null>(null);

  const colors = ACCENT[accent];
  const candles = tf === "1m" ? candles1m : candles5m;

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    import("lightweight-charts").then((lc) => {
      if (disposed || !containerRef.current) return;
      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: { background: { color: "#0a0a10" }, textColor: "#94a3b8" },
        grid: { vertLines: { color: "#15151f" }, horzLines: { color: "#15151f" } },
        crosshair: { mode: lc.CrosshairMode.Normal },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e1e2e", rightOffset: 6 },
        rightPriceScale: { borderColor: "#1e1e2e" },
      });
      const series = chart.addCandlestickSeries({
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      });
      chartRef.current = chart;
      seriesRef.current = series;
      registerChart(paneId, chart, series);
      setReady(true);

      chart.subscribeCrosshairMove((param: MouseEventParams) => {
        if (!param.point || !param.seriesData?.size) { setOhlc(null); return; }
        const bar = param.seriesData.get(series) as CandlestickData | undefined;
        if (!bar) { setOhlc(null); return; }
        let timeStr = "--";
        if (param.time) {
          const d = new Date((param.time as number) * 1000);
          const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
          timeStr = ist.toLocaleString("en-IN", {
            month: "short", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hour12: false,
          });
        }
        const chg = bar.close - bar.open;
        const pct = bar.open ? (chg / bar.open) * 100 : 0;
        setOhlc({ time: timeStr, open: bar.open, high: bar.high, low: bar.low, close: bar.close, change: chg, changePct: pct });
      });

      observer = new ResizeObserver(() => {
        if (!containerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      });
      observer.observe(containerRef.current);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      unregisterChart(paneId);
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push candles + center on entry on tf/data change
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    series.setData(data);

    // Candles are already clipped to the trade day → show the full day.
    chart.timeScale().fitContent();
  }, [candles, tf, entryTimeUnix, exitTimeUnix, ready]);

  // Entry/exit arrow markers + structure markers.
  // Note: no full-width horizontal lines (no createPriceLine). Entry/SL/Target
  // visualization for the position lives inside the canvas overlay below.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const allMarkers: SeriesMarker<Time>[] = [];

    if (position) {
      allMarkers.push({
        time: position.entryTimeUnix as Time,
        position: position.direction === "LONG" ? "belowBar" : "aboveBar",
        color: "#3b82f6",
        shape: position.direction === "LONG" ? "arrowUp" : "arrowDown",
        text: `ENTRY ${position.entryPrice.toFixed(2)}`,
      });
      if (position.exitTimeUnix) {
        const exitColor = exitReason === "TARGET_HIT" ? "#22c55e" : exitReason === "SL_HIT" ? "#ef4444" : "#eab308";
        allMarkers.push({
          time: position.exitTimeUnix as Time,
          position: position.direction === "LONG" ? "aboveBar" : "belowBar",
          color: exitColor,
          shape: "circle",
          text: `EXIT ${exitReason ?? ""}`.trim(),
        });
      }
    } else if (entryTimeUnix) {
      // Entry arrow on charts where position rectangle isn't drawn
      allMarkers.push({
        time: entryTimeUnix as Time,
        position: "belowBar",
        color: "#3b82f6",
        shape: "arrowUp",
        text: "ENTRY",
      });
      if (exitTimeUnix) {
        const exitColor = exitReason === "TARGET_HIT" ? "#22c55e" : exitReason === "SL_HIT" ? "#ef4444" : "#eab308";
        allMarkers.push({
          time: exitTimeUnix as Time,
          position: "aboveBar",
          color: exitColor,
          shape: "circle",
          text: `EXIT ${exitReason ?? ""}`.trim(),
        });
      }
    }

    // Structure markers (skip points without a timestamp — lightweight-charts
    // markers must anchor to a time on the time scale).
    for (const m of markers) {
      if (m.timeUnix == null) continue;
      const text = m.price != null ? `${m.label} ${m.price.toFixed(2)}` : m.label;
      allMarkers.push({
        time: m.timeUnix as Time,
        position: "aboveBar",
        color: "#f59e0b",
        shape: "square",
        text,
      });
    }

    allMarkers.sort((a, b) => (a.time as number) - (b.time as number));
    series.setMarkers(allMarkers);
  }, [position, markers, exitReason, tf, ready, entryTimeUnix, exitTimeUnix]);

  // Position-rectangle overlay (custom canvas — entry→target green, entry→SL red).
  // Drawn over the chart container using time-to-x and price-to-y coordinate APIs.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!chart || !series || !container || !position) return;

    const overlay = document.createElement("canvas");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2";
    container.style.position = "relative";
    container.appendChild(overlay);

    const draw = () => {
      const w = container.clientWidth, h = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      overlay.width = w * dpr; overlay.height = h * dpr;
      overlay.style.width = `${w}px`; overlay.style.height = `${h}px`;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const ts = chart.timeScale();
      const x1 = ts.timeToCoordinate(position.entryTimeUnix as Time);
      // Project rectangle a sensible window past exit (fallback: 30 min)
      const fallbackEnd = position.entryTimeUnix + 30 * 60;
      const x2 = ts.timeToCoordinate((position.exitTimeUnix ?? fallbackEnd) as Time);
      const yEntry  = series.priceToCoordinate(position.entryPrice);
      const ySL     = series.priceToCoordinate(position.slPrice);
      const yTarget = series.priceToCoordinate(position.targetPrice);
      if (x1 == null || x2 == null || yEntry == null || ySL == null || yTarget == null) return;

      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const width = Math.max(right - left, 60);
      const lEdge = left, rEdge = lEdge + width;

      // Compute zones (LONG: target above entry, SL below; SHORT: inverted)
      const profitTop = Math.min(yEntry, yTarget);
      const profitBot = Math.max(yEntry, yTarget);
      const lossTop = Math.min(yEntry, ySL);
      const lossBot = Math.max(yEntry, ySL);

      // Profit zone (green)
      ctx.fillStyle = "rgba(34,197,94,0.20)";
      ctx.strokeStyle = "rgba(34,197,94,0.85)";
      ctx.lineWidth = 1.2;
      ctx.fillRect(lEdge, profitTop, width, profitBot - profitTop);
      ctx.strokeRect(lEdge, profitTop, width, profitBot - profitTop);

      // Loss zone (red)
      ctx.fillStyle = "rgba(239,68,68,0.20)";
      ctx.strokeStyle = "rgba(239,68,68,0.85)";
      ctx.fillRect(lEdge, lossTop, width, lossBot - lossTop);
      ctx.strokeRect(lEdge, lossTop, width, lossBot - lossTop);

      // Entry line (solid blue, edge-to-edge of rectangle)
      ctx.strokeStyle = "rgba(59,130,246,1)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(lEdge, yEntry); ctx.lineTo(rEdge, yEntry);
      ctx.stroke();

      // Corner handles (4 small filled circles like TradingView's tool)
      const handle = (cx: number, cy: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#0a0a10";
        ctx.fill();
        ctx.strokeStyle = "rgba(59,130,246,1)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      };
      const topY = Math.min(profitTop, lossTop);
      const botY = Math.max(profitBot, lossBot);
      handle(lEdge, topY);
      handle(rEdge, topY);
      handle(lEdge, botY);
      handle(rEdge, botY);
      handle(lEdge, yEntry);
      handle(rEdge, yEntry);

      // Pill helper
      const pill = (text: string, cx: number, cy: number, bg: string, fg: string) => {
        ctx.font = "bold 11px ui-monospace, monospace";
        const tw = ctx.measureText(text).width + 14;
        const th = 18;
        const x = cx - tw / 2;
        const y = cy - th / 2;
        ctx.fillStyle = bg;
        ctx.beginPath();
        const r = 4;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + tw - r, y);
        ctx.quadraticCurveTo(x + tw, y, x + tw, y + r);
        ctx.lineTo(x + tw, y + th - r);
        ctx.quadraticCurveTo(x + tw, y + th, x + tw - r, y + th);
        ctx.lineTo(x + r, y + th);
        ctx.quadraticCurveTo(x, y + th, x, y + th - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.fillText(text, x + 7, y + 13);
      };

      const risk = Math.abs(position.entryPrice - position.slPrice);
      const reward = Math.abs(position.targetPrice - position.entryPrice);
      const rr = risk > 0 ? reward / risk : 0;
      const rwdPct = position.entryPrice ? (reward / position.entryPrice) * 100 : 0;
      const rskPct = position.entryPrice ? (risk / position.entryPrice) * 100 : 0;
      const cx = (lEdge + rEdge) / 2;

      // Top pill (target side): "+reward (pct%) targetPrice"
      const targetIsAbove = position.targetPrice > position.entryPrice;
      const tgtPill = `+${reward.toFixed(2)} (${rwdPct.toFixed(2)}%) ${position.targetPrice.toFixed(2)}`;
      const tgtY = targetIsAbove ? profitTop - 12 : profitBot + 12;
      pill(tgtPill, cx, tgtY, "rgba(34,197,94,0.95)", "#06180c");

      // Bottom pill (SL side): "-risk (pct%) slPrice"
      const slIsBelow = position.slPrice < position.entryPrice;
      const slPill = `-${risk.toFixed(2)} (${rskPct.toFixed(2)}%) ${position.slPrice.toFixed(2)}`;
      const slY = slIsBelow ? lossBot + 12 : lossTop - 12;
      pill(slPill, cx, slY, "rgba(239,68,68,0.95)", "#1a0606");

      // Mid label inside loss zone: "ENTRY entryPrice • RR rr"
      const midText = `ENTRY ${position.entryPrice.toFixed(2)}  •  RR ${rr.toFixed(2)}`;
      pill(midText, cx, yEntry, "rgba(59,130,246,0.95)", "#06121f");
    };

    draw();
    const handleRange = () => draw();
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRange);
    const ro = new ResizeObserver(draw);
    ro.observe(container);

    return () => {
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRange); } catch { /* ignore */ }
      ro.disconnect();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
  }, [position, candles, tf, ready]);

  return (
    <div className={`flex flex-col flex-1 min-h-0 rounded-xl border ${colors.ring} bg-[#0a0a10] overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1e1e2e] flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${colors.text}`}>{title}</span>
        <div className="ml-auto flex gap-1">
          {(["1m", "5m"] as Tf[]).map((x) => (
            <button
              key={x}
              onClick={() => setTf(x)}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors ${
                tf === x
                  ? `${colors.tag} ${colors.text} border ${colors.ring}`
                  : "bg-[#1e1e2e] text-slate-500 hover:text-slate-300"
              }`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      {/* OHLC readout */}
      <div className="flex items-center gap-3 px-3 py-1 border-b border-[#1e1e2e] bg-[#08080d] flex-shrink-0 min-h-[24px] text-[10px] font-mono">
        {ohlc ? (
          <>
            <span className="text-slate-500">{ohlc.time}</span>
            <span><span className="text-slate-500">O </span><span className="text-slate-200">{ohlc.open.toFixed(2)}</span></span>
            <span><span className="text-slate-500">H </span><span className="text-emerald-400">{ohlc.high.toFixed(2)}</span></span>
            <span><span className="text-slate-500">L </span><span className="text-red-400">{ohlc.low.toFixed(2)}</span></span>
            <span><span className="text-slate-500">C </span><span className={ohlc.change >= 0 ? "text-emerald-400" : "text-red-400"}>{ohlc.close.toFixed(2)}</span></span>
            <span className={`px-1.5 py-0.5 rounded ${ohlc.change >= 0 ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"}`}>
              {ohlc.change >= 0 ? "+" : ""}{ohlc.change.toFixed(2)} ({ohlc.change >= 0 ? "+" : ""}{ohlc.changePct.toFixed(2)}%)
            </span>
          </>
        ) : (
          <span className="text-slate-600">Hover for OHLC</span>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 w-full relative" />
    </div>
  );
}
