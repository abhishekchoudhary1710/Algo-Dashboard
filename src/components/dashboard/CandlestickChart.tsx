"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import type {
  OHLCResponse,
  OHLCCandle,
  SignalEvent,
  CandleUpdate,
  OptionStrike,
  OptionsListResponse,
  OptionCandlesResponse,
} from "@/lib/api";
import type { IChartApi, ISeriesApi, CandlestickData, SeriesMarker, Time } from "lightweight-charts";

interface CandlestickChartProps {
  currentCandle: CandleUpdate | null;
  signals: SignalEvent[];
  connected: boolean;
}

type Timeframe = "1m" | "5m";
type Instrument = "spot" | "fut" | "option";

interface OHLCReadout {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
}

export default function CandlestickChart({
  currentCandle,
  signals,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const optionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spotFutPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadDoneRef = useRef(false);

  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [instrument, setInstrument] = useState<Instrument>("spot");
  const [loading, setLoading] = useState(false);
  const [ohlc, setOhlc] = useState<OHLCReadout | null>(null);

  // Option watchlist state
  const [options, setOptions] = useState<OptionStrike[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CE" | "PE">("ALL");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [strikeFilter, setStrikeFilter] = useState("");
  const [searchResults, setSearchResults] = useState<OptionStrike[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chart creation (once) ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    import("lightweight-charts").then((lc) => {
      if (disposed || !containerRef.current) return;

      const chart = lc.createChart(containerRef.current!, {
        width: containerRef.current!.clientWidth,
        height: containerRef.current!.clientHeight,
        layout: { background: { color: "#0d0d14" }, textColor: "#94a3b8" },
        grid: { vertLines: { color: "#1e1e2e" }, horzLines: { color: "#1e1e2e" } },
        crosshair: { mode: lc.CrosshairMode.Normal },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1e1e2e" },
        rightPriceScale: { borderColor: "#1e1e2e" },
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

      // OHLC crosshair readout
      chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.seriesData?.size) {
          setOhlc(null);
          return;
        }
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

      // Resize observer
      observer = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      observer.observe(containerRef.current!);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // ── Load spot/fut candles ────────────────────────────────────────────
  const loadSpotFutCandles = useCallback(async () => {
    if (!seriesRef.current || instrument === "option") return;
    setLoading(true);
    try {
      const data = await fetchAPI<OHLCResponse>(
        `/api/candles/ohlc?instrument=${instrument}&timeframe=${timeframe}&count=500`
      );
      const all: OHLCCandle[] = [...data.candles];
      if (data.current_candle) {
        const last = all[all.length - 1];
        if (last && last.time === data.current_candle.time) all[all.length - 1] = data.current_candle;
        else all.push(data.current_candle);
      }
      const formatted: CandlestickData[] = all.map((c) => ({
        time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      seriesRef.current?.setData(formatted);

      if (signals.length > 0) {
        const markers: SeriesMarker<Time>[] = signals
          .filter((s) => s.instrument === instrument)
          .map((s) => {
            const bull = s.strategy.includes("bullish");
            return {
              time: Math.floor(new Date(s.timestamp).getTime() / 1000) as Time,
              position: bull ? ("belowBar" as const) : ("aboveBar" as const),
              color: bull ? "#22c55e" : "#ef4444",
              shape: bull ? ("arrowUp" as const) : ("arrowDown" as const),
              text: s.strategy.replace(/_/g, " ").toUpperCase(),
            };
          })
          .sort((a, b) => (a.time as number) - (b.time as number));
        seriesRef.current?.setMarkers(markers);
      }
      if (!initialLoadDoneRef.current) {
        chartRef.current?.timeScale().fitContent();
        initialLoadDoneRef.current = true;
      }
    } catch { /* silently fail */ }
    setLoading(false);
  }, [instrument, timeframe, signals]);

  // Poll spot/fut candles every 2s (REST-based, no WS needed)
  useEffect(() => {
    if (spotFutPollRef.current) clearInterval(spotFutPollRef.current);
    if (instrument !== "option") {
      initialLoadDoneRef.current = false;
      loadSpotFutCandles();
      spotFutPollRef.current = setInterval(loadSpotFutCandles, 2000);
    }
    return () => { if (spotFutPollRef.current) clearInterval(spotFutPollRef.current); };
  }, [instrument, timeframe, loadSpotFutCandles]);

  // Real-time spot/fut candle via WS
  useEffect(() => {
    if (
      currentCandle &&
      seriesRef.current &&
      instrument !== "option" &&
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

  // ── Load option candles ───────────────────────────────────────────────
  const loadOptionCandles = useCallback(async (token: string) => {
    if (!seriesRef.current) return;
    try {
      const data = await fetchAPI<OptionCandlesResponse>(
        `/api/options/candles?token=${encodeURIComponent(token)}&timeframe=${timeframe}&count=500`
      );
      const all: OHLCCandle[] = [...data.candles];
      if (data.current_candle) {
        const last = all[all.length - 1];
        if (last && last.time === data.current_candle.time) all[all.length - 1] = data.current_candle;
        else all.push(data.current_candle);
      }
      if (all.length === 0) return;
      const formatted: CandlestickData[] = all.map((c) => ({
        time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      seriesRef.current?.setData(formatted);
      if (!initialLoadDoneRef.current) {
        chartRef.current?.timeScale().fitContent();
        initialLoadDoneRef.current = true;
      }
    } catch { /* silently fail */ }
  }, [timeframe]);

  // Start/stop option poll
  useEffect(() => {
    if (optionPollRef.current) clearInterval(optionPollRef.current);
    if (instrument === "option" && selectedToken) {
      initialLoadDoneRef.current = false;
      loadOptionCandles(selectedToken);
      optionPollRef.current = setInterval(() => loadOptionCandles(selectedToken), 2000);
    }
    return () => { if (optionPollRef.current) clearInterval(optionPollRef.current); };
  }, [instrument, selectedToken, loadOptionCandles]);

  // Reload option candles when timeframe changes
  useEffect(() => {
    if (instrument === "option" && selectedToken) loadOptionCandles(selectedToken);
  }, [timeframe, instrument, selectedToken, loadOptionCandles]);

  // ── Option watchlist polling ──────────────────────────────────────────
  const fetchOptions = useCallback(async () => {
    try {
      const data = await fetchAPI<OptionsListResponse>("/api/options/list");
      setOptions(data.options);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    fetchOptions();
    const t = setInterval(fetchOptions, 3000);
    return () => clearInterval(t);
  }, [fetchOptions]);

  // ── Strike selection ──────────────────────────────────────────────────
  function selectStrike(opt: OptionStrike) {
    setSelectedToken(opt.token);
    setSelectedSymbol(opt.symbol);
    setInstrument("option");
    setSearchResults([]);
    setStrikeFilter("");
  }

  // ── Symbol search (debounced, triggers when input length >= 8) ────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = strikeFilter.trim();
    // Only search when it looks like a full/partial symbol (not just a strike number)
    if (q.length >= 8 && /[A-Za-z]/.test(q)) {
      searchTimerRef.current = setTimeout(async () => {
        try {
          const data = await fetchAPI<OptionsListResponse>(
            `/api/options/search?q=${encodeURIComponent(q)}&timeframe=${timeframe}`
          );
          setSearchResults(data.options);
        } catch { setSearchResults([]); }
      }, 400);
    } else {
      setSearchResults([]);
    }
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [strikeFilter, timeframe]);

  // ── Derived: filtered + grouped options ──────────────────────────────
  const expiries = Array.from(new Set(options.map((o) => o.expiry))).sort();
  const isSymbolSearch = strikeFilter.trim().length >= 8 && /[A-Za-z]/.test(strikeFilter);
  const filtered = options.filter((o) => {
    if (typeFilter !== "ALL" && o.option_type !== typeFilter) return false;
    if (expiryFilter && o.expiry !== expiryFilter) return false;
    if (strikeFilter) {
      const q = strikeFilter.trim().toUpperCase();
      const matchesStrike = String(o.strike).includes(q);
      const matchesSymbol = o.symbol.toUpperCase().includes(q);
      if (!matchesStrike && !matchesSymbol) return false;
    }
    return true;
  });
  const grouped: Record<string, OptionStrike[]> = {};
  filtered.forEach((o) => { (grouped[o.expiry] = grouped[o.expiry] || []).push(o); });

  // ── Instrument label ─────────────────────────────────────────────────
  const instLabel =
    instrument === "option" && selectedSymbol
      ? selectedSymbol
      : instrument === "spot" ? "NIFTY SPOT" : "NIFTY FUT";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-[#1e1e2e]">

      {/* ── Option Watchlist (left panel) ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-[#1e1e2e] bg-[#0d0d14]">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-[#1e1e2e] flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              Option Strikes
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 font-mono">
              {options.length}
            </span>
          </div>
          {/* Filters */}
          <div className="flex gap-1 mb-1.5">
            {(["ALL", "CE", "PE"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`flex-1 py-0.5 text-[10px] font-bold font-mono rounded transition-colors ${
                  typeFilter === f
                    ? f === "CE" ? "bg-emerald-900/60 text-emerald-400"
                      : f === "PE" ? "bg-red-900/60 text-red-400"
                      : "bg-blue-900/60 text-blue-400"
                    : "bg-[#1e1e2e] text-slate-500 hover:text-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="flex-1 bg-[#1e1e2e] border border-[#2e2e3e] text-slate-400 text-[10px] font-mono px-1.5 py-1 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="">All expiries</option>
              {expiries.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <input
              type="text"
              value={strikeFilter}
              onChange={(e) => setStrikeFilter(e.target.value)}
              placeholder="Strike / Symbol…"
              className="flex-1 bg-[#1e1e2e] border border-[#2e2e3e] text-slate-400 text-[10px] font-mono px-1.5 py-1 rounded focus:outline-none focus:border-blue-500 placeholder-slate-600"
            />
          </div>
        </div>

        {/* Strike list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Historical search results (shown when typing a symbol) */}
          {isSymbolSearch && searchResults.length > 0 && (
            <div>
              <div className="sticky top-0 z-10 px-3 py-1 text-[9px] font-bold font-mono uppercase tracking-widest text-purple-400 bg-[#111118] border-y border-[#1e1e2e]">
                Historical matches
              </div>
              {searchResults.map((opt) => {
                const isSelected = opt.token === selectedToken;
                const isCE = opt.option_type === "CE";
                return (
                  <button
                    key={opt.token}
                    onClick={() => selectStrike(opt)}
                    className={`w-full flex flex-col gap-0.5 px-3 py-1.5 border-b border-[#1a1a28] text-left transition-colors hover:bg-[#1e1e2e] ${
                      isSelected ? "bg-blue-900/20 border-l-2 border-l-blue-500 pl-[10px]" : ""
                    }`}
                  >
                    <span className="font-mono text-[10px] text-slate-300 truncate">{opt.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-slate-500">{opt.strike}</span>
                      <span className={`font-mono text-[9px] ${isCE ? "text-emerald-400" : "text-red-400"}`}>
                        {opt.option_type}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {isSymbolSearch && searchResults.length === 0 && strikeFilter.trim().length >= 8 && (
            <div className="p-4 text-center text-[11px] text-slate-600 font-mono italic">Searching…</div>
          )}

          {/* Live subscribed strikes (hidden during symbol search if results exist) */}
          {(!isSymbolSearch || searchResults.length === 0) && Object.keys(grouped).length === 0 ? (
            <div className="p-4 text-center text-[11px] text-slate-600 font-mono italic">
              {options.length === 0 ? "No strikes subscribed" : "No matches"}
            </div>
          ) : (!isSymbolSearch || searchResults.length === 0) ? (
            Object.keys(grouped).sort().map((expiry) => (
              <div key={expiry}>
                <div className="sticky top-0 z-10 px-3 py-1 text-[9px] font-bold font-mono uppercase tracking-widest text-slate-500 bg-[#111118] border-y border-[#1e1e2e]">
                  {expiry}
                </div>
                {grouped[expiry].map((opt) => {
                  const isSelected = opt.token === selectedToken;
                  const isCE = opt.option_type === "CE";
                  return (
                    <button
                      key={opt.token}
                      onClick={() => selectStrike(opt)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 border-b border-[#1a1a28] text-left transition-colors hover:bg-[#1e1e2e] ${
                        isSelected ? "bg-blue-900/20 border-l-2 border-l-blue-500 pl-[10px]" : ""
                      }`}
                    >
                      <span className="font-mono font-bold text-[11px] text-slate-200 w-12 flex-shrink-0">
                        {opt.strike}
                      </span>
                      <span className={`font-mono font-bold text-[10px] w-6 flex-shrink-0 ${isCE ? "text-emerald-400" : "text-red-400"}`}>
                        {opt.option_type}
                      </span>
                      <span className="font-mono text-[11px] text-slate-300 flex-1 text-right">
                        {opt.ltp != null ? `₹${opt.ltp.toFixed(2)}` : "--"}
                      </span>
                      <span className="font-mono text-[9px] text-slate-600 w-6 text-right flex-shrink-0">
                        {timeframe === "1m" ? opt.candles_1m : opt.candles_5m}c
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          ) : null}
        </div>
      </div>

      {/* ── Chart Area (right) ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d14]">

        {/* Controls bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e1e2e] flex-shrink-0">
          {/* Timeframe */}
          <div className="flex gap-1">
            {(["1m", "5m"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded transition-colors ${
                  timeframe === tf
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-[#1e1e2e] text-slate-500 hover:text-slate-300"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-[#2e2e3e]" />

          {/* Instrument tabs */}
          <div className="flex gap-1">
            {(["spot", "fut"] as const).map((inst) => (
              <button
                key={inst}
                onClick={() => setInstrument(inst)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded uppercase transition-colors ${
                  instrument === inst
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "bg-[#1e1e2e] text-slate-500 hover:text-slate-300"
                }`}
              >
                {inst}
              </button>
            ))}
            {selectedToken && (
              <button
                onClick={() => setInstrument("option")}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded transition-colors max-w-[140px] truncate ${
                  instrument === "option"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                    : "bg-[#1e1e2e] text-slate-500 hover:text-slate-300"
                }`}
                title={selectedSymbol}
              >
                {selectedSymbol.length > 18 ? selectedSymbol.slice(-14) : selectedSymbol}
              </button>
            )}
          </div>

          {/* Instrument label + loading */}
          <div className="ml-auto flex items-center gap-3">
            {loading && (
              <span className="text-[10px] text-slate-600 font-mono animate-pulse">loading…</span>
            )}
            <span className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
              {instLabel}
            </span>
          </div>
        </div>

        {/* OHLC hover readout */}
        <div className="flex items-center gap-4 px-3 py-1 border-b border-[#1e1e2e] bg-[#0a0a10] flex-shrink-0 min-h-[26px]">
          {ohlc ? (
            <>
              <span className="text-[10px] font-mono text-slate-500">{ohlc.time}</span>
              <span className="text-[10px] font-mono">
                <span className="text-slate-500">O </span>
                <span className="text-slate-200">{ohlc.open.toFixed(2)}</span>
              </span>
              <span className="text-[10px] font-mono">
                <span className="text-slate-500">H </span>
                <span className="text-emerald-400">{ohlc.high.toFixed(2)}</span>
              </span>
              <span className="text-[10px] font-mono">
                <span className="text-slate-500">L </span>
                <span className="text-red-400">{ohlc.low.toFixed(2)}</span>
              </span>
              <span className="text-[10px] font-mono">
                <span className="text-slate-500">C </span>
                <span className={ohlc.change >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {ohlc.close.toFixed(2)}
                </span>
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                ohlc.change >= 0 ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"
              }`}>
                {ohlc.change >= 0 ? "+" : ""}{ohlc.change.toFixed(2)} ({ohlc.change >= 0 ? "+" : ""}{ohlc.changePct.toFixed(2)}%)
              </span>
            </>
          ) : (
            <span className="text-[10px] font-mono text-slate-600">Hover over a candle to see OHLC</span>
          )}
        </div>

        {/* Chart canvas — fills all remaining space */}
        <div ref={containerRef} className="flex-1 min-h-0 w-full" />
      </div>
    </div>
  );
}
