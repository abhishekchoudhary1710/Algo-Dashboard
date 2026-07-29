"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { fetchAPI } from "@/lib/api";
import StrikeComparisonPanel, {
  ShadowFillRow,
  useShadowFills,
} from "@/components/dashboard/StrikeComparisonPanel";

type RestatedTrade = {
  trade_id: string;
  entry_time: string;
  strategy: string;
  option_type: string;
  strike: number | null;
  exit_reason: string | null;
  realized_pnl: number | null;
  rr_at_exit: number | null;
  risk_budget: number | null;
  new_symbol: string | null;
  new_qty: number | null;
  new_plan_risk: number | null;
  new_entry: number | null;
  new_exit_reason: string | null;
  new_exit_price: number | null;
  new_pnl: number | null;
  new_rr: number | null;
  plan_trade: boolean;
  bias_day: boolean;
};

type RestatedSummary = {
  count: number;
  restated: number;
  skipped_by_rule: number;
  risk_budget: number | null;
  old_total: number;
  new_total: number;
  new_wins: number;
  plan_count: number;
  plan_old_total: number;
  plan_new_total: number;
  plan_new_wins: number;
  bias_count: number;
  bias_new_total: number;
  bias_new_wins: number;
};

type RestatedResponse = {
  trades: RestatedTrade[];
  summary: RestatedSummary;
  error?: string;
};

function Pnl({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <span className="text-slate-600">--</span>;
  const v = Number(value);
  const color =
    v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-slate-400";
  return (
    <span className={`font-mono font-medium ${color}`}>
      {v > 0 ? "+" : ""}
      {v.toFixed(0)}
    </span>
  );
}

const EXIT_STYLES: Record<string, string> = {
  CHART_TARGET_HIT: "bg-green-500/15 text-green-400 border-green-500/30",
  TARGET_HIT: "bg-green-500/15 text-green-400 border-green-500/30",
  CHART_SL_HIT: "bg-red-500/15 text-red-400 border-red-500/30",
  OPTION_SL_HIT: "bg-red-500/15 text-red-400 border-red-500/30",
  SL_HIT: "bg-red-500/15 text-red-400 border-red-500/30",
  DISASTER_STOP: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  TIME_EXIT: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  SKIP_RULE: "bg-slate-600/20 text-slate-500 border-slate-600/30",
};

function ExitBadge({ reason }: { reason: string | null }) {
  if (!reason) return <span className="text-slate-600">--</span>;
  const style = EXIT_STYLES[reason] || "bg-slate-700 text-slate-400";
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${style}`}
    >
      {reason.replace(/_/g, " ")}
    </span>
  );
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-semibold font-mono mt-1 ${accent || "text-slate-200"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function RestatedTradesPage() {
  const [data, setData] = useState<RestatedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"bias" | "plan" | "all">("bias");
  const [openTrade, setOpenTrade] = useState<string | null>(null);
  const shadow = useShadowFills();

  useEffect(() => {
    fetchAPI<RestatedResponse>("/api/trades/restated")
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  }, []);

  if (error)
    return (
      <div className="p-6 text-red-400">
        Failed to load restated trades: {error}
        <p className="text-slate-500 text-sm mt-2">
          (The /api/trades/restated endpoint activates on the next algo
          restart.)
        </p>
      </div>
    );
  if (!data) return <div className="p-6 text-slate-400">Loading…</div>;

  const s = data.summary;
  const rows = data.trades.filter((t) =>
    view === "all" ? true : view === "plan" ? t.plan_trade : t.plan_trade && t.bias_day
  );
  const rupee = (v: number) => `₹${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("en-IN")}`;

  // Per-view stats, recomputed for whichever filter is active
  const done = rows.filter((t) => t.new_pnl !== null && t.new_pnl !== undefined);
  const winsArr = done.filter((t) => Number(t.new_pnl) > 0);
  const lossArr = done.filter((t) => Number(t.new_pnl) <= 0);
  const avg = (arr: RestatedTrade[], key: "new_pnl" | "new_plan_risk") =>
    arr.length ? arr.reduce((a, t) => a + Number(t[key] || 0), 0) / arr.length : 0;
  const avgRisk = avg(done, "new_plan_risk");
  const avgWin = avg(winsArr, "new_pnl");
  const avgLoss = avg(lossArr, "new_pnl");
  const rewardRisk = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Restated Trades — New Rules
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every historical trade under the current live rules — chart-level
            exits + delta sizing at ₹{s.risk_budget ? Math.round(s.risk_budget) : "--"} risk.
          </p>
        </div>
        <Link
          href="/trades"
          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          ← All Trades
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile
          label="Short-bias days (your plan)"
          value={rupee(s.bias_new_total ?? 0)}
          sub={s.bias_count !== undefined ? `${s.bias_new_wins}/${s.bias_count} wins (${s.bias_count ? Math.round((100 * s.bias_new_wins) / s.bias_count) : 0}%)` : "restart algo to activate"}
          accent={(s.bias_new_total ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
        />
        <Tile
          label="Plan trades (new rules)"
          value={rupee(s.plan_new_total)}
          sub={`${s.plan_new_wins}/${s.plan_count} wins (${s.plan_count ? Math.round((100 * s.plan_new_wins) / s.plan_count) : 0}%)`}
          accent={s.plan_new_total >= 0 ? "text-green-400" : "text-red-400"}
        />
        <Tile
          label="All restated (new rules)"
          value={rupee(s.new_total)}
          sub={`${s.new_wins}/${s.restated} wins — both sides, unfiltered`}
        />
        <Tile
          label="Coverage"
          value={`${s.restated}/${s.count}`}
          sub={`${s.skipped_by_rule} refused by skip rule`}
        />
      </div>

      <div className="flex items-center gap-2">
        {([
          ["bias", "Short-bias days"],
          ["plan", "Plan trades (first PE, before 12:30)"],
          ["all", "All trades"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded border ${view === key ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300" : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-2">{rows.length} rows</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Avg planned risk" value={`₹${Math.round(avgRisk).toLocaleString("en-IN")}`} sub="per trade, this view" />
        <Tile
          label="Avg reward (win)"
          value={rupee(avgWin)}
          sub={`${winsArr.length} winners`}
          accent="text-green-400"
        />
        <Tile
          label="Avg loss"
          value={rupee(avgLoss)}
          sub={`${lossArr.length} losers`}
          accent="text-red-400"
        />
        <Tile
          label="Reward : Risk (realized)"
          value={`${rewardRisk.toFixed(2)} : 1`}
          sub="avg win / avg loss"
          accent={rewardRisk >= 2 ? "text-green-400" : rewardRisk >= 1 ? "text-slate-200" : "text-red-400"}
        />
        <Tile
          label="Expectancy / trade"
          value={rupee(done.length ? (winsArr.length * avgWin + lossArr.length * avgLoss) / done.length : 0)}
          sub="win% x avgWin - loss% x avgLoss"
          accent={(winsArr.length * avgWin + lossArr.length * avgLoss) >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      <StrikeComparisonPanel
        data={shadow}
        tradeIds={rows.map((t) => t.trade_id)}
        viewLabel={
          view === "bias"
            ? "Short-bias days"
            : view === "plan"
            ? "Plan trades"
            : "All trades"
        }
      />

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Entry</th>
              <th className="px-3 py-2 text-left">Contract</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Plan risk</th>
              <th className="px-3 py-2 text-left">Exit</th>
              <th className="px-3 py-2 text-right">P&L ₹</th>
              <th className="px-3 py-2 text-right">RR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((t) => (
              <Fragment key={t.trade_id}>
              <tr
                onClick={() =>
                  setOpenTrade(openTrade === t.trade_id ? null : t.trade_id)
                }
                title="Click to compare strikes for this trade"
                className={`hover:bg-slate-800/40 cursor-pointer ${t.new_exit_reason === "SKIP_RULE" ? "opacity-50" : ""} ${openTrade === t.trade_id ? "bg-slate-800/40" : ""}`}
              >
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono text-xs">
                  {t.entry_time?.slice(0, 16).replace("T", " ")}
                  {t.bias_day && (
                    <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 align-middle">
                      BIAS
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                  {t.new_symbol || "--"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {t.new_qty ?? "--"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {t.new_plan_risk ? Math.round(Number(t.new_plan_risk)) : "--"}
                </td>
                <td className="px-3 py-2">
                  <ExitBadge reason={t.new_exit_reason} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Pnl value={t.new_pnl} />
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {t.new_rr !== null && t.new_rr !== undefined
                    ? Number(t.new_rr).toFixed(2)
                    : "--"}
                </td>
              </tr>
              {openTrade === t.trade_id && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <ShadowFillRow fills={shadow?.fills?.[t.trade_id]} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 max-w-3xl">
        Each row is a historical signal traded with the current live rules:
        current-expiry strike nearest the risk budget, delta-based quantity,
        exits triggered by the spot/futures chart, 2× disaster cap. SKIP RULE
        rows are trades the system would have refused (1-lot risk ≥ 2× budget).
      </p>
    </div>
  );
}
