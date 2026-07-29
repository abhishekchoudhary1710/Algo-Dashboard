"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";

export type ShadowFill = {
  trade_id: string;
  policy: string;
  expiry: string | null;
  dte: number | null;
  strike: number | null;
  entry_price: number | null;
  exit_price: number | null;
  exit_reason: string | null;
  quantity: number | null;
  plan_risk: number | null;
  pnl: number | null;
  rr: number | null;
  status: string;
};

type ShadowSummary = {
  policy: string;
  n: number;
  no_data: number;
  skipped: number;
  total: number;
  wins: number;
  win_pct: number;
  avg_win: number;
  avg_loss: number;
  disasters: number;
  avg_dte: number;
  /** avg win / |avg loss| — realised reward:risk across the filtered trades */
  reward_risk: number;
  /** avg planned risk (delta-sized), i.e. what 1R was worth in rupees */
  avg_risk: number;
};

export type ShadowResponse = {
  summary: ShadowSummary[];
  fills: Record<string, Record<string, ShadowFill>>;
  note?: string;
  error?: string;
};

// Display order + labels. Keep in sync with POLICIES in
// scripts/compute_shadow_fills.py.
export const POLICY_ORDER = [
  "CUR_ATM",
  "CUR_ITM1",
  "CUR_ITM2",
  "NXT_ATM",
  "NXT_ITM1",
  "NXT_ITM2",
] as const;

export const POLICY_LABEL: Record<string, string> = {
  CUR_ATM: "Cur ATM",
  CUR_ITM1: "Cur ITM+100",
  CUR_ITM2: "Cur ITM+200",
  NXT_ATM: "Next ATM",
  NXT_ITM1: "Next ITM+100",
  NXT_ITM2: "Next ITM+200",
};

const rupee = (v: number) =>
  `₹${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("en-IN")}`;

/** Fetch once, share with the parent table so both render from one request. */
export function useShadowFills() {
  const [data, setData] = useState<ShadowResponse | null>(null);
  useEffect(() => {
    fetchAPI<ShadowResponse>("/api/trades/shadow-fills")
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);
  return data;
}

/** Aggregate the shadow fills for exactly the trades passed in, so the panel
 *  always reflects whichever filter the table is showing. */
function summarise(
  fills: Record<string, Record<string, ShadowFill>>,
  tradeIds: string[]
): ShadowSummary[] {
  return POLICY_ORDER.map((policy) => {
    let n = 0, noData = 0, skipped = 0, total = 0, wins = 0;
    let winSum = 0, lossSum = 0, lossN = 0, disasters = 0, dteSum = 0;
    let riskSum = 0;
    for (const id of tradeIds) {
      const f = fills[id]?.[policy];
      if (!f || f.status === "NO_DATA") {
        noData++;
        continue;
      }
      if (f.status === "SKIP_RULE") {
        skipped++;
        continue;
      }
      const pnl = Number(f.pnl ?? 0);
      n++;
      total += pnl;
      if (pnl > 0) {
        wins++;
        winSum += pnl;
      } else {
        lossN++;
        lossSum += pnl;
      }
      if (f.exit_reason === "DISASTER_STOP") disasters++;
      dteSum += Number(f.dte ?? 0);
      riskSum += Number(f.plan_risk ?? 0);
    }
    const avgWin = wins ? winSum / wins : 0;
    const avgLoss = lossN ? lossSum / lossN : 0;
    return {
      policy,
      n,
      no_data: noData,
      skipped,
      total: Math.round(total * 100) / 100,
      wins,
      win_pct: n ? Math.round((1000 * wins) / n) / 10 : 0,
      avg_win: Math.round(avgWin),
      avg_loss: Math.round(avgLoss),
      disasters,
      avg_dte: n ? Math.round((10 * dteSum) / n) / 10 : 0,
      reward_risk: avgLoss !== 0 ? Math.round((100 * avgWin) / Math.abs(avgLoss)) / 100 : 0,
      avg_risk: n ? Math.round(riskSum / n) : 0,
    };
  });
}

export default function StrikeComparisonPanel({
  data,
  tradeIds,
  viewLabel,
}: {
  data: ShadowResponse | null;
  tradeIds: string[];
  viewLabel?: string;
}) {
  if (!data || data.error || !data.fills) return null;

  const rows = summarise(data.fills, tradeIds).filter(
    (r) => r.n > 0 || r.no_data > 0
  );
  if (!rows.length || rows.every((r) => r.n === 0)) return null;

  // Best on total P&L, and separately on average loss — the loss column is the
  // more stable signal, so it is worth flagging when the two disagree.
  const bestTotal = rows.reduce((a, b) => (b.total > a.total ? b : a));
  const bestLoss = rows.reduce((a, b) => (b.avg_loss > a.avg_loss ? b : a));
  const bestRR = rows.reduce((a, b) => (b.reward_risk > a.reward_risk ? b : a));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-200">
            Strike comparison — what other strikes would have made
          </h2>
          <span className="text-[11px] text-slate-500">
            {viewLabel ? `${viewLabel} · ` : ""}
            {tradeIds.length} trade{tradeIds.length === 1 ? "" : "s"} in view
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          The trades currently filtered above, replayed against alternative
          contracts using the same signal, same chart exits and same delta
          sizing — only the strike and expiry differ. Last-traded prices, no
          bid-ask: use this to rank policies, not as realisable P&amp;L.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Policy</th>
              <th className="text-right px-3 py-2 font-medium">Trades</th>
              <th className="text-right px-3 py-2 font-medium">Total P&amp;L</th>
              <th className="text-right px-3 py-2 font-medium">Win %</th>
              <th className="text-right px-3 py-2 font-medium">Avg win</th>
              <th className="text-right px-3 py-2 font-medium">Avg loss</th>
              <th className="text-right px-3 py-2 font-medium" title="avg win / avg loss">
                R:R
              </th>
              <th className="text-right px-3 py-2 font-medium" title="avg planned risk — what 1R was worth">
                Avg risk
              </th>
              <th className="text-right px-3 py-2 font-medium">Disaster</th>
              <th className="text-right px-3 py-2 font-medium">Avg DTE</th>
              <th className="text-right px-3 py-2 font-medium">No data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBestTotal = r.policy === bestTotal.policy;
              const isBestLoss = r.policy === bestLoss.policy;
              const isBestRR = r.policy === bestRR.policy && r.reward_risk > 0;
              return (
                <tr
                  key={r.policy}
                  className={`border-t border-slate-800 ${
                    isBestTotal ? "bg-green-500/5" : ""
                  }`}
                >
                  <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                    {POLICY_LABEL[r.policy] ?? r.policy}
                    {isBestTotal && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 align-middle">
                        best total
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">
                    {r.n}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono font-medium ${
                      r.total > 0
                        ? "text-green-400"
                        : r.total < 0
                        ? "text-red-400"
                        : "text-slate-400"
                    }`}
                  >
                    {rupee(r.total)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">
                    {r.win_pct}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-green-400/80">
                    {rupee(r.avg_win)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      isBestLoss ? "text-amber-300" : "text-red-400/80"
                    }`}
                    title={isBestLoss ? "Smallest average loss" : undefined}
                  >
                    {rupee(r.avg_loss)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      isBestRR ? "text-amber-300" : "text-slate-300"
                    }`}
                    title={isBestRR ? "Best reward:risk" : undefined}
                  >
                    {r.reward_risk ? `${r.reward_risk.toFixed(2)} : 1` : "--"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {r.avg_risk ? `₹${r.avg_risk.toLocaleString("en-IN")}` : "--"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {r.disasters}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {r.avg_dte}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {r.no_data || "--"}
                    {r.skipped ? ` (+${r.skipped} skip)` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-2 text-[11px] text-slate-600 border-t border-slate-800">
        Amber = smallest average loss (
        {POLICY_LABEL[bestLoss.policy] ?? bestLoss.policy}) and best reward:risk
        ({POLICY_LABEL[bestRR.policy] ?? bestRR.policy}). Average loss and R:R
        are usually steadier signals than total P&amp;L — a total can be carried
        by a few large wins. Avg risk is the delta-sized planned risk, i.e. what
        1R was worth on that policy.
      </p>
    </div>
  );
}

/** Per-trade breakdown, shown when a restated row is expanded. */
export function ShadowFillRow({
  fills,
}: {
  fills: Record<string, ShadowFill> | undefined;
}) {
  if (!fills) {
    return (
      <div className="px-4 py-3 text-xs text-slate-600">
        No strike comparison for this trade — run{" "}
        <code className="text-slate-500">
          python -m scripts.compute_shadow_fills --all
        </code>
        .
      </div>
    );
  }
  return (
    <div className="px-4 py-3 bg-slate-950/40">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {POLICY_ORDER.map((policy) => {
          const f = fills[policy];
          const label = POLICY_LABEL[policy] ?? policy;
          if (!f || f.status !== "OK") {
            return (
              <div
                key={policy}
                className="border border-slate-800 rounded p-2 opacity-50"
              >
                <p className="text-[10px] uppercase text-slate-500">{label}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {f?.status === "SKIP_RULE" ? "skip rule" : "no data"}
                </p>
              </div>
            );
          }
          const pnl = Number(f.pnl ?? 0);
          return (
            <div
              key={policy}
              className="border border-slate-800 rounded p-2 bg-slate-900/60"
            >
              <p className="text-[10px] uppercase text-slate-500">{label}</p>
              <p
                className={`text-sm font-mono font-medium ${
                  pnl > 0 ? "text-green-400" : pnl < 0 ? "text-red-400" : "text-slate-400"
                }`}
              >
                {rupee(pnl)}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
                {f.strike} · {f.quantity}q · {f.dte}d
              </p>
              <p className="text-[10px] text-slate-600 font-mono">
                {f.entry_price} → {f.exit_price}
              </p>
              {f.exit_reason === "DISASTER_STOP" && (
                <p className="text-[10px] text-amber-500/80 mt-0.5">disaster</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
