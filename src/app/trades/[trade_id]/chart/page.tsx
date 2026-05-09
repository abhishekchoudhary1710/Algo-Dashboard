"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SyncedChartPane, { type PositionRect } from "@/components/trade-chart/SyncedChartPane";
import { useCrosshairSync } from "@/components/trade-chart/useCrosshairSync";
import { loadTradeChartBundle, type TradeChartBundle } from "@/components/trade-chart/tradeChartData";

function timeToUnixIST(ts: string | null): number | null {
  if (!ts) return null;
  // ts is an IST wall-clock string ("2026-05-03 10:15:23"). The candle APIs encode
  // IST wall clock as UTC unix (calendar.timegm of naive IST), so we parse the
  // string as UTC directly — no offset.
  const isoUtc = ts.replace(" ", "T") + "Z";
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

export default function TradeChartPage() {
  const params = useParams<{ trade_id: string }>();
  const router = useRouter();
  const tradeId = decodeURIComponent(params.trade_id);

  const [bundle, setBundle] = useState<TradeChartBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sync = useCrosshairSync();

  useEffect(() => {
    let alive = true;
    setBundle(null);
    setError(null);
    loadTradeChartBundle(tradeId)
      .then((b) => { if (alive) setBundle(b); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { alive = false; };
  }, [tradeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/trades");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  const entryUnix = useMemo(
    () => bundle ? timeToUnixIST(bundle.trade.entry_time) : null,
    [bundle]
  );
  const exitUnix = useMemo(
    () => bundle ? timeToUnixIST(bundle.trade.exit_time) : null,
    [bundle]
  );

  // Position rectangle (entry/SL/target tool) lives on the OPTION chart only,
  // since SL/target are option premium values. The trade-fired block records
  // entry/sl/target in option-premium space — that's what we draw.
  const optionRect: PositionRect | null = useMemo(() => {
    if (!bundle || !entryUnix) return null;
    const b = bundle.block;
    const t = bundle.trade;
    const entryPrice = b?.entry ?? t.entry_price;
    if (entryPrice == null) return null;
    const sl = b?.sl ?? null;
    const target = b?.target ?? null;
    if (sl == null || target == null) return null;
    return {
      entryPrice,
      slPrice: sl,
      targetPrice: target,
      entryTimeUnix: entryUnix,
      exitTimeUnix: exitUnix,
      direction: t.direction === "SHORT" ? "SHORT" : "LONG",
    };
  }, [bundle, entryUnix, exitUnix]);

  if (error) {
    return (
      <div className="p-6 bg-[#0a0e17] min-h-screen">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <Link href="/trades" className="text-blue-400 text-xs underline mt-2 inline-block">← Back to trades</Link>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="p-6 bg-[#0a0e17] min-h-screen flex items-center justify-center">
        <p className="text-slate-400 animate-pulse text-sm font-mono">Loading trade chart…</p>
      </div>
    );
  }

  const t = bundle.trade;
  const pnl = t.realized_pnl;
  const pnlColor = pnl == null ? "text-slate-400" : pnl > 0 ? "text-green-400" : pnl < 0 ? "text-red-400" : "text-slate-300";
  const isBull = (t.strategy || "").includes("bullish");

  return (
    <div className="flex flex-col h-screen bg-[#06060b] overflow-hidden">
      {/* Sticky header */}
      <header className="flex-shrink-0 px-4 py-2 border-b border-[#1e1e2e] bg-gradient-to-b from-[#0d0d14] to-[#08080d]">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/trades"
            className="text-[11px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-[#1e1e2e] border border-[#2e2e3e]"
            title="Back (Esc)"
          >
            ← Trades
          </Link>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Trade</span>
            <span className="text-xs font-mono text-slate-200">{t.trade_id}</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${isBull ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {t.strategy}
          </span>
          <span className="text-[10px] font-mono text-slate-300 px-2 py-0.5 rounded bg-[#1e1e2e]">
            {t.direction} • {t.option_type ?? "--"} {t.strike ?? ""}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            <span className="text-slate-500">Entry </span>
            <span className="text-blue-400">{t.entry_price?.toFixed(2) ?? "--"}</span>
            <span className="text-slate-500"> @ </span>
            {t.entry_time?.slice(11, 19) ?? "--"}
          </span>
          {t.exit_price != null && (
            <span className="text-[10px] font-mono text-slate-400">
              <span className="text-slate-500">Exit </span>
              <span className="text-amber-400">{t.exit_price.toFixed(2)}</span>
              <span className="text-slate-500"> @ </span>
              {t.exit_time?.slice(11, 19) ?? "--"}
              {t.exit_reason && <span className="text-slate-500 ml-1">({t.exit_reason})</span>}
            </span>
          )}
          {bundle.block && (
            <span className="text-[10px] font-mono text-slate-400">
              <span className="text-slate-500">SL </span>
              <span className="text-red-400">{bundle.block.sl?.toFixed(2) ?? "--"}</span>
              <span className="text-slate-500 ml-2">Tgt </span>
              <span className="text-green-400">{bundle.block.target?.toFixed(2) ?? "--"}</span>
            </span>
          )}
          <span className={`ml-auto text-sm font-mono font-bold ${pnlColor}`}>
            {pnl == null ? "—" : `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}`}
          </span>
          {t.max_rr_achieved != null && (
            <span className="text-[10px] font-mono text-slate-400">
              <span className="text-slate-500">Max R </span>
              <span className="text-purple-300">{t.max_rr_achieved.toFixed(2)}</span>
            </span>
          )}
        </div>
        {bundle.block?.entry_method && (
          <div className="mt-1 text-[10px] font-mono text-slate-500">
            entry method: <span className="text-amber-300">{bundle.block.entry_method}</span>
            {bundle.block.div_type && <span className="ml-3">type: <span className="text-amber-300">{bundle.block.div_type}</span></span>}
            {bundle.block.pivot && <span className="ml-3">pivot: <span className="text-amber-300">{bundle.block.pivot}</span></span>}
          </div>
        )}
      </header>

      {/* Fyers-style: spot top-left + fut bottom-left, option full-height right */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 p-2">
        <div className="flex flex-col min-h-0 gap-2">
          <SyncedChartPane
            paneId="spot"
            title="NIFTY SPOT"
            accent="spot"
            candles1m={bundle.candles.spot["1m"]}
            candles5m={bundle.candles.spot["5m"]}
            entryTimeUnix={entryUnix}
            exitTimeUnix={exitUnix}
            exitReason={t.exit_reason}
            position={null}
            markers={bundle.markers.spot}
            registerChart={sync.register}
            unregisterChart={sync.unregister}
          />
          <SyncedChartPane
            paneId="fut"
            title="NIFTY FUT"
            accent="fut"
            candles1m={bundle.candles.fut["1m"]}
            candles5m={bundle.candles.fut["5m"]}
            entryTimeUnix={entryUnix}
            exitTimeUnix={exitUnix}
            exitReason={t.exit_reason}
            position={null}
            markers={bundle.markers.fut}
            registerChart={sync.register}
            unregisterChart={sync.unregister}
          />
        </div>
        <div className="flex flex-col min-h-0">
          <SyncedChartPane
            paneId="option"
            title={bundle.optionSymbol ?? `${t.strike ?? ""}${t.option_type ?? ""}`}
            accent="option"
            candles1m={bundle.candles.option["1m"]}
            candles5m={bundle.candles.option["5m"]}
            entryTimeUnix={entryUnix}
            exitTimeUnix={exitUnix}
            exitReason={t.exit_reason}
            position={optionRect}
            markers={bundle.markers.option}
            registerChart={sync.register}
            unregisterChart={sync.unregister}
          />
        </div>
      </div>
    </div>
  );
}
