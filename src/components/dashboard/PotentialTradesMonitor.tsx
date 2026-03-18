"use client";

import type { Strategies, SwingStrategy, DivergenceStrategy } from "@/lib/api";

interface Props {
  strategies: Strategies | null;
}

interface PotentialTrade {
  strategy: string;
  direction: "LONG" | "SHORT";
  entry: number | null;
  sl: number | null;
  target: number | null;
  structureValid: boolean;
  timeLeft: string;
  color: string;
  detail?: string; // extra context
}

function extractSwingSetup(
  name: string,
  direction: "LONG" | "SHORT",
  s: SwingStrategy,
  color: string
): PotentialTrade | null {
  if (!s.active) return null;
  if (!s.D && !s.pending_setup) return null;

  const allPoints = s.H1 != null && s.L1 != null && s.A != null && s.B != null && s.C != null && s.D != null;

  return {
    strategy: name,
    direction,
    entry: s.pending_setup?.entry_price ?? s.D,
    sl: s.pending_setup?.stop_loss ?? (s.C != null ? s.C + (direction === "LONG" ? -0.05 : 0.05) : null),
    target: s.pending_setup?.target ?? null,
    structureValid: allPoints,
    timeLeft: "\u2014",
    color,
    detail: allPoints
      ? `D: ${s.D?.toFixed(1)} · C: ${s.C?.toFixed(1)}`
      : `Forming (${[s.H1 != null ? "H1" : null, s.L1 != null ? "L1" : null, s.A != null ? "A" : null, s.B != null ? "B" : null, s.C != null ? "C" : null].filter(Boolean).join(",")})`,
  };
}

function extractDivergenceSetups(
  name: string,
  direction: "LONG" | "SHORT",
  s: DivergenceStrategy,
  color: string
): PotentialTrade[] {
  if (!s.active) return [];

  const trades: PotentialTrade[] = [];

  // Collapse all active divergences into ONE summary row
  if (s.active_divergences.length > 0) {
    const confirmed = s.active_divergences.filter((d) => d.spot_broken || d.fut_broken).length;
    const pivotNums = s.active_divergences.map((d) => `P${d.pivot_number}`);
    // Show max 4 pivot numbers, then "+N more"
    const displayPivots = pivotNums.length <= 4
      ? pivotNums.join(", ")
      : `${pivotNums.slice(0, 3).join(", ")} +${pivotNums.length - 3} more`;

    trades.push({
      strategy: name,
      direction,
      entry: null,
      sl: null,
      target: null,
      structureValid: confirmed > 0,
      timeLeft: "5m window",
      color,
      detail: `${s.active_divergences.length} pivots (${displayPivots}) · ${confirmed} confirmed`,
    });
  }

  // First candle setup (separate row — this is actionable)
  if (s.first_candle && !s.first_candle.broken) {
    trades.push({
      strategy: `${name} 1st Candle`,
      direction,
      entry: s.first_candle.price,
      sl: null,
      target: null,
      structureValid: true,
      timeLeft: "3m window",
      color,
    });
  }

  return trades;
}

function StatusBadge({ valid }: { valid: boolean }) {
  return valid ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
      VALID
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded">
      FORMING
    </span>
  );
}

export default function PotentialTradesMonitor({ strategies }: Props) {
  const trades: PotentialTrade[] = [];

  if (strategies) {
    const bs = extractSwingSetup("Bull Swing", "LONG", strategies.bullish_swing, "#22c55e");
    if (bs) trades.push(bs);

    const bes = extractSwingSetup("Bear Swing", "SHORT", strategies.bearish_swing, "#ef4444");
    if (bes) trades.push(bes);

    trades.push(
      ...extractDivergenceSetups("Bull Div", "LONG", strategies.bullish_divergence, "#3b82f6")
    );
    trades.push(
      ...extractDivergenceSetups("Bear Div", "SHORT", strategies.bearish_divergence, "#a855f7")
    );
  }

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
          Potential Trades
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          {trades.length} setup{trades.length !== 1 ? "s" : ""} active
        </span>
      </div>

      {trades.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <div className="text-sm text-slate-600 font-mono">No active setups</div>
            <div className="text-[10px] text-slate-700 mt-1">Strategies scanning for patterns...</div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#12121a] z-10">
              <tr className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-[#1e1e2e]">
                <th className="text-left py-1.5 pr-3 font-medium">Strategy</th>
                <th className="text-left py-1.5 pr-3 font-medium">Dir</th>
                <th className="text-right py-1.5 pr-3 font-medium">Entry</th>
                <th className="text-right py-1.5 pr-3 font-medium">SL</th>
                <th className="text-right py-1.5 pr-3 font-medium">Target</th>
                <th className="text-center py-1.5 pr-3 font-medium">Structure</th>
                <th className="text-right py-1.5 font-medium">Time Left</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr
                  key={`${t.strategy}-${i}`}
                  className="border-b border-[#1e1e2e]/50 last:border-0 hover:bg-[#1a1a24] transition-colors"
                >
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <div>
                        <span className="text-xs font-medium text-slate-300">{t.strategy}</span>
                        {t.detail && (
                          <div className="text-[10px] text-slate-600 mt-0.5">{t.detail}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                        t.direction === "LONG"
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-red-400 bg-red-500/10"
                      }`}
                    >
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="text-xs font-mono text-slate-200">
                      {t.entry?.toFixed(2) ?? "\u2014"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="text-xs font-mono text-red-400">
                      {t.sl?.toFixed(2) ?? "\u2014"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="text-xs font-mono text-emerald-400">
                      {t.target?.toFixed(2) ?? "\u2014"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-center">
                    <StatusBadge valid={t.structureValid} />
                  </td>
                  <td className="py-2 text-right">
                    <span className="text-[10px] font-mono text-slate-500">{t.timeLeft}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
