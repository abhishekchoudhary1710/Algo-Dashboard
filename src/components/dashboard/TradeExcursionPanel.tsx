"use client";

import type { TradeExcursion } from "@/lib/api";
import Explainable from "@/components/Explainable";

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
      <Explainable
        title="Trade Excursions"
        explanation="Tracks how far each active/completed trade moved in your favor (MFE) and against you (MAE) in real-time. Excursion analysis helps evaluate trade quality beyond just win/loss — showing if you're capturing enough of the move or if exits are too early/late."
      >
        <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
            Trade Excursions
          </span>
          <span className="text-[10px] font-mono text-slate-600">
            {excursions.length} trade{excursions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </Explainable>

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
                  <Explainable title="Spot Stop Loss" explanation="The NIFTY spot index price level at which this trade's stop loss is set. If the spot price crosses this level, the trade is exited to limit losses. 'HIT' badge means this SL was triggered during the trade.">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 w-12">Spot SL</span>
                      <span className="text-[10px] font-mono text-slate-300">
                        {t.spot_sl ? t.spot_sl.toFixed(1) : "\u2014"}
                      </span>
                      {t.spot_sl_hit && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1 rounded">HIT</span>
                      )}
                    </div>
                  </Explainable>
                  <Explainable title="Option Stop Loss" explanation="The option premium price at which the stop loss is set. This is a separate SL from the spot SL — it triggers if the option price drops to this level. Options can move differently from spot due to IV changes and time decay.">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 w-12">Opt SL</span>
                      <span className="text-[10px] font-mono text-slate-300">
                        {t.option_sl ? t.option_sl.toFixed(1) : "\u2014"}
                      </span>
                      {t.option_sl_hit && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1 rounded">HIT</span>
                      )}
                    </div>
                  </Explainable>
                </div>

                {/* Row 3: RR Progress Bars */}
                <div className="grid grid-cols-2 gap-3">
                  <Explainable title="Spot R:R (Risk-Reward)" explanation="Reward-to-Risk ratio based on spot (index) price movement.\n\nCalculated as: (Current Favorable Move) ÷ (Risk = Entry − Stop Loss)\n\nThe progress bar fills toward a 2.0 target. Colors:\n• Red (<1.0) — risk exceeds reward so far\n• Yellow (1.0–2.0) — in profit but below target\n• Green (≥2.0) — target R:R achieved">
                    <div>
                      <div className="text-[10px] text-slate-600 mb-0.5">Spot R:R</div>
                      <RRBar rr={t.spot_rr_achieved} />
                    </div>
                  </Explainable>
                  <Explainable title="Option R:R (Risk-Reward)" explanation="Reward-to-Risk ratio based on option premium movement.\n\nCalculated as: (Option Price Move in Favor) ÷ (Option Premium Risked)\n\nThis can differ from Spot R:R because option premiums are affected by delta, theta (time decay), and implied volatility — not just the underlying spot price.">
                    <div>
                      <div className="text-[10px] text-slate-600 mb-0.5">Option R:R</div>
                      <RRBar rr={t.option_rr_achieved} />
                    </div>
                  </Explainable>
                </div>

                {/* Row 4: MFE / MAE compact */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600 pt-1 border-t border-[#1e1e2e]">
                  <Explainable inline title="MFE (Max Favorable Excursion)" explanation="The maximum profit point (in spot price) this trade reached before the current price. Shows the best the trade has been. If MFE is much higher than the final exit, it means the trade gave back significant gains.">
                    <span>MFE <span className="font-mono text-emerald-400">{t.spot_mfe.toFixed(1)}</span></span>
                  </Explainable>
                  <Explainable inline title="MAE (Max Adverse Excursion)" explanation="The maximum loss point (in spot price) this trade reached. Shows the worst drawdown during the trade. A high MAE relative to the stop loss suggests the trade came close to being stopped out.">
                    <span>MAE <span className="font-mono text-red-400">{t.spot_mae.toFixed(1)}</span></span>
                  </Explainable>
                  <Explainable inline title="Option MFE" explanation="Maximum favorable movement in the option premium price. Shows the highest unrealized profit the option position reached during this trade.">
                    <span>Opt MFE <span className="font-mono text-emerald-400">{t.option_mfe.toFixed(1)}</span></span>
                  </Explainable>
                  <Explainable inline title="Option MAE" explanation="Maximum adverse movement in the option premium price. Shows the deepest unrealized loss the option position experienced during this trade.">
                    <span>Opt MAE <span className="font-mono text-red-400">{t.option_mae.toFixed(1)}</span></span>
                  </Explainable>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
