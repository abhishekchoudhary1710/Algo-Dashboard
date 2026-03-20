"use client";

import type { TradeExcursion } from "@/lib/api";

interface TradeExcursionPanelProps {
  excursions: TradeExcursion[];
}

const STRATEGY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  bullish_swing:       { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Bull Swing" },
  bearish_swing:       { bg: "bg-red-500/15",     text: "text-red-400",     label: "Bear Swing" },
  bullish_divergence:  { bg: "bg-blue-500/15",    text: "text-blue-400",    label: "Bull Div" },
  bearish_divergence:  { bg: "bg-purple-500/15",  text: "text-purple-400",  label: "Bear Div" },
  ce_buying:           { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Bull Swing" },
  pe_selling:          { bg: "bg-red-500/15",     text: "text-red-400",     label: "Bear Swing" },
};

function getStrategyBadge(strategy: string) {
  const s = (strategy || "").toLowerCase();
  for (const [key, val] of Object.entries(STRATEGY_BADGE)) {
    if (s === key || s.includes(key.split("_")[0])) return val;
  }
  return { bg: "bg-slate-700", text: "text-slate-400", label: strategy || "\u2014" };
}

const EXIT_REASON: Record<string, { cls: string; label: string }> = {
  TRACKING:          { cls: "text-blue-400 bg-blue-500/10 border-blue-500/30",       label: "LIVE" },
  OPTION_SL_HIT:     { cls: "text-red-400 bg-red-500/10 border-red-500/30",          label: "OPT SL" },
  OPTION_TARGET_HIT: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "TARGET" },
  SPOT_SL_HIT:       { cls: "text-orange-400 bg-orange-500/10 border-orange-500/30",  label: "SPOT SL" },
  SPOT_TARGET_HIT:   { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "TARGET" },
  TIME_EXIT:         { cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",  label: "TIMEOUT" },
  CLOSED:            { cls: "text-slate-400 bg-slate-500/10 border-slate-500/30",     label: "CLOSED" },
};

function getExitReason(status: string) {
  return EXIT_REASON[status] || { cls: "text-slate-500 bg-slate-800 border-slate-700", label: status };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    const match = ts.match(/(\d{2}:\d{2})/);
    return match ? match[1] : ts;
  }
}

/** RR Progress Bar: 0 to 2.0 target */
function RRBar({ rr }: { rr: number }) {
  const target = 2.0;
  const pct = Math.min((rr / target) * 100, 100);
  const color =
    rr >= target ? "bg-emerald-400" : rr >= 1.0 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono font-bold w-8 text-right ${
        rr >= 2.0 ? "text-emerald-400" : rr >= 1.0 ? "text-yellow-400" : "text-red-400"
      }`}>
        {rr.toFixed(1)}
      </span>
    </div>
  );
}

export default function TradeExcursionPanel({ excursions }: TradeExcursionPanelProps) {
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
          Trade Excursions
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          {excursions.length} trade{excursions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-y-auto flex-1 px-2 py-2 space-y-2">
        {excursions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-sm text-slate-600 font-mono">No active trades</div>
              <div className="text-[10px] text-slate-700 mt-1">Excursion tracking begins on trade entry</div>
            </div>
          </div>
        ) : (
          excursions.map((t) => {
            const badge = getStrategyBadge(t.strategy);
            const exit = getExitReason(t.status);
            const isLive = t.status === "TRACKING";

            return (
              <div
                key={t.order_id}
                className={`bg-[#0d0d14] rounded-lg border p-3 space-y-2 ${
                  isLive ? "border-blue-500/30" : "border-[#1e1e2e]"
                } ${t.is_positive ? "ring-1 ring-emerald-500/20" : ""}`}
              >
                {/* Row 1: Strategy + Option + Duration + Exit Reason */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {t.option_display_name}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {formatTime(t.timestamp)} · {formatDuration(t.duration_seconds)}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${exit.cls}`}>
                    {exit.label}
                  </span>
                </div>

                {/* Row 2: SL values side-by-side */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 w-12">Spot SL</span>
                    <span className="text-[10px] font-mono text-slate-300">
                      {t.spot_sl ? t.spot_sl.toFixed(1) : "\u2014"}
                    </span>
                    {t.spot_sl_hit && (
                      <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1 rounded">HIT</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 w-12">Opt SL</span>
                    <span className="text-[10px] font-mono text-slate-300">
                      {t.option_sl ? t.option_sl.toFixed(1) : "\u2014"}
                    </span>
                    {t.option_sl_hit && (
                      <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1 rounded">HIT</span>
                    )}
                  </div>
                </div>

                {/* Row 3: RR Progress Bars */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-600 mb-0.5">Spot R:R</div>
                    <RRBar rr={t.spot_rr_achieved} />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600 mb-0.5">Option R:R</div>
                    <RRBar rr={t.option_rr_achieved} />
                  </div>
                </div>

                {/* Row 4: MFE / MAE compact */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600 pt-1 border-t border-[#1e1e2e]">
                  <span>MFE <span className="font-mono text-emerald-400">{t.spot_mfe.toFixed(1)}</span></span>
                  <span>MAE <span className="font-mono text-red-400">{t.spot_mae.toFixed(1)}</span></span>
                  <span>Opt MFE <span className="font-mono text-emerald-400">{t.option_mfe.toFixed(1)}</span></span>
                  <span>Opt MAE <span className="font-mono text-red-400">{t.option_mae.toFixed(1)}</span></span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
