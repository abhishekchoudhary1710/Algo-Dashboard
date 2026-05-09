// Data helpers for the per-trade chart view.
// Builds a self-contained bundle: trade row + matching trade-fired block +
// candles for spot, futures and the traded option strike (1m + 5m).

import { fetchAPI } from "@/lib/api";
import type {
  Trade,
  TradesHistoryResponse,
  TradeFiredBlock,
  TradeFiredResponse,
  OHLCResponse,
  OHLCCandle,
  OptionsListResponse,
  OptionStrike,
  OptionCandlesResponse,
} from "@/lib/api";

export type Tf = "1m" | "5m";
export type PaneInstrument = "spot" | "fut" | "option";

export interface StructurePoint {
  label: string;       // L1, H1, A, B, C, D, Mother, Child, Pullback, Pivot, ...
  price: number | null;     // null when log only recorded a timestamp
  timeUnix: number | null;  // null when log only recorded a price (e.g. A/B levels)
  raw: string;
}

export interface TradeChartBundle {
  trade: Trade;
  block: TradeFiredBlock | null;
  optionToken: string | null;
  optionSymbol: string | null;
  signalSource: PaneInstrument; // where the signal originated (spot / fut / option)
  candles: {
    spot:   { "1m": OHLCCandle[]; "5m": OHLCCandle[] };
    fut:    { "1m": OHLCCandle[]; "5m": OHLCCandle[] };
    option: { "1m": OHLCCandle[]; "5m": OHLCCandle[] };
  };
  // structure points keyed by the chart they belong on
  markers: {
    spot:   StructurePoint[];
    fut:    StructurePoint[];
    option: StructurePoint[];
  };
}

// Parse "value @ HH:MM:SS" or "value @ YYYY-MM-DD HH:MM:SS" (IST wall clock).
// Returns price + the unix-seconds encoding used by the candle APIs:
// the IST wall-clock parsed as if it were UTC (server uses calendar.timegm on
// naive IST datetimes, so there is NO timezone shift to apply here).
function parseStructureValue(raw: string, fallbackDate: string | null): { price: number; timeUnix: number } | null {
  if (!raw) return null;
  const m = raw.match(/([-\d.]+)\s*@\s*([\d\-: ]+)/);
  if (!m) return null;
  const price = parseFloat(m[1]);
  if (!Number.isFinite(price)) return null;
  const tstr = m[2].trim();
  let dateStr: string;
  if (/^\d{4}-\d{2}-\d{2}/.test(tstr)) {
    dateStr = tstr;
  } else {
    if (!fallbackDate) return null;
    dateStr = `${fallbackDate} ${tstr}`;
  }
  const isoUtc = dateStr.replace(" ", "T") + "Z";
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) return null;
  return { price, timeUnix: Math.floor(ms / 1000) };
}

function pickSignalSource(trade: Trade, block: TradeFiredBlock | null): PaneInstrument {
  // Use the trade-fired block's div_type when available — it reads
  // "spot_holding" / "spot_breaking" / "futures_holding" / "futures_breaking" / etc.
  const dt = (block?.div_type || "").toLowerCase();
  if (dt.includes("spot")) return "spot";
  if (dt.includes("fut") || dt.includes("future")) return "fut";
  // Swing structure points (H1/L1/A/B/C/D) are computed on futures candles.
  const s = (trade.strategy || "").toLowerCase();
  if (s.includes("swing")) return "fut";
  return "fut";
}

// Restrict to a specific IST trading day's window (08:00–16:30 IST).
// `tradeDate` is "YYYY-MM-DD". Candle times are "IST-as-UTC" unix seconds, so we
// build the bounds by parsing IST wall clock as UTC.
function clipToDay(candles: OHLCCandle[], tradeDate: string | null): OHLCCandle[] {
  if (!tradeDate) return candles;
  const dayStart = Math.floor(Date.parse(`${tradeDate}T08:00:00Z`) / 1000);
  const dayEnd   = Math.floor(Date.parse(`${tradeDate}T16:30:00Z`) / 1000);
  return candles.filter((c) => {
    const t = Number(c.time);
    return t >= dayStart && t <= dayEnd;
  });
}

async function fetchOhlc(
  instrument: "spot" | "fut",
  tf: Tf,
  tradeDate: string | null
): Promise<OHLCCandle[]> {
  try {
    // 5000 candles covers ~13 days of 1m or 65 days of 5m — enough to find any trade.
    const data = await fetchAPI<OHLCResponse>(
      `/api/candles/ohlc?instrument=${instrument}&timeframe=${tf}&count=5000`
    );
    const all = [...data.candles];
    if (data.current_candle) {
      const last = all[all.length - 1];
      if (last && last.time === data.current_candle.time) all[all.length - 1] = data.current_candle;
      else all.push(data.current_candle);
    }
    return clipToDay(all, tradeDate);
  } catch {
    return [];
  }
}

async function fetchOptionCandles(token: string, tf: Tf, tradeDate: string | null): Promise<OHLCCandle[]> {
  try {
    const data = await fetchAPI<OptionCandlesResponse>(
      `/api/options/candles?token=${encodeURIComponent(token)}&timeframe=${tf}&count=5000`
    );
    const all = [...data.candles];
    if (data.current_candle) {
      const last = all[all.length - 1];
      if (last && last.time === data.current_candle.time) all[all.length - 1] = data.current_candle;
      else all.push(data.current_candle);
    }
    return clipToDay(all, tradeDate);
  } catch {
    return [];
  }
}

async function findOptionToken(
  symbol: string | null,
  strike: number | null,
  optionType: string | null
): Promise<{ token: string | null; symbol: string | null }> {
  // Try exact symbol first via /api/options/search, then /api/options/list.
  if (symbol) {
    try {
      const r = await fetchAPI<OptionsListResponse>(
        `/api/options/search?q=${encodeURIComponent(symbol)}&timeframe=1m`
      );
      const exact = r.options.find((o: OptionStrike) => o.symbol === symbol);
      if (exact) return { token: exact.token, symbol: exact.symbol };
      if (r.options.length > 0) return { token: r.options[0].token, symbol: r.options[0].symbol };
    } catch { /* fall through */ }
  }
  // Fall back to live list
  try {
    const r = await fetchAPI<OptionsListResponse>("/api/options/list");
    if (strike != null && optionType) {
      const m = r.options.find(
        (o) => Number(o.strike) === Number(strike) && o.option_type === optionType
      );
      if (m) return { token: m.token, symbol: m.symbol };
    }
  } catch { /* ignore */ }
  return { token: null, symbol: symbol };
}

function matchTradeFiredBlock(trade: Trade, blocks: TradeFiredBlock[]): TradeFiredBlock | null {
  if (!blocks.length) return null;
  // 1) order_id ↔ entry_order_id
  if (trade.entry_order_id) {
    const m = blocks.find((b) => b.order_id && b.order_id === trade.entry_order_id);
    if (m) return m;
  }
  // 2) timestamp + strike + option_type
  if (trade.entry_time && trade.strike != null) {
    const tradeT = Date.parse(trade.entry_time + "Z");
    let best: TradeFiredBlock | null = null;
    let bestDiff = Infinity;
    for (const b of blocks) {
      if (!b.timestamp || b.strike == null) continue;
      if (Number(b.strike) !== Number(trade.strike)) continue;
      if (trade.option_type && b.option_type && b.option_type !== trade.option_type) continue;
      const bt = Date.parse(b.timestamp.replace(" ", "T") + "Z");
      if (Number.isNaN(bt)) continue;
      const d = Math.abs(bt - tradeT);
      if (d < bestDiff) { bestDiff = d; best = b; }
    }
    if (best && bestDiff < 10 * 60 * 1000) return best;
  }
  return null;
}

// Parse "YYYY-MM-DD HH:MM:SS[.fraction]" (IST wall clock) to unix-as-UTC seconds.
function parseTimestamp(s: string): number | null {
  const t = s.trim().split(".")[0]; // strip subsecond
  if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(t)) return null;
  const ms = Date.parse(t.replace(" ", "T") + "Z");
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function extractStructurePoints(
  block: TradeFiredBlock | null,
  trade: Trade,
  entryTimeUnix: number | null
): StructurePoint[] {
  if (!block) return [];
  const out: StructurePoint[] = [];
  const seen = new Set<string>();
  const tradeDate = trade.entry_time ? trade.entry_time.slice(0, 10) : null;

  const push = (label: string, price: number | null, timeUnix: number | null, raw: string) => {
    const key = `${label}@${timeUnix ?? "0"}@${price ?? "0"}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, price, timeUnix, raw });
  };

  // Top-level structure dict (swing: H1/L1/A/B/C/D, sometimes with "value @ time")
  for (const [label, raw] of Object.entries(block.structure || {})) {
    const withTs = parseStructureValue(raw, tradeDate);
    if (withTs) {
      push(label, withTs.price, withTs.timeUnix, raw);
      continue;
    }
    // Bare numeric (e.g. "23828.80") — anchor to entry time so it renders.
    const num = parseFloat(raw);
    if (Number.isFinite(num)) push(label, num, entryTimeUnix, raw);
  }

  // Pivot candle (block top-level field) — render as marker
  if (block.pivot_candle) {
    const t = parseTimestamp(block.pivot_candle);
    if (t != null) push("Pivot", null, t, block.pivot_candle);
  }

  // Walk all section lines. Match many forms:
  //   "Mother: 2026-04-15 11:00:00"        → time only
  //   "Child: 2026-04-15 11:01:00"
  //   "Pullback Candle: <timestamp>"
  //   "Pivot Candle: <timestamp>"
  //   "L1 (Pivot Low): 23855.40 at 2026-04-15 15:10:00"
  //   "H1 (Pivot High): 24230.50 at 2026-04-15 14:50:00"
  //   "Stop Loss: 23862.00"                → ignored (full-chart line removed)
  //   "A: 23828.80"                        → bare price, anchored to entry
  //   "Entry Time: 2026-04-15 11:02:03"    → ignored (we already have entry)
  for (const sec of block.sections || []) {
    for (const ln of sec.lines || []) {
      const s = ln.trim();

      // Skip noise
      if (/^(Entry Price|Current Price|Stop Loss|Target|Risk|Entry Time)\s*:/i.test(s)) continue;

      // Form: "Label: <price> at <timestamp>"
      let m = s.match(/^([A-Za-z][\w\s\(\)]*?):\s*([\d.]+)\s+at\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
      if (m) {
        const lbl = m[1].replace(/\s*\(.*\)\s*/, "").trim(); // strip "(Pivot Low)"
        const price = parseFloat(m[2]);
        const time = parseTimestamp(m[3]);
        push(lbl, Number.isFinite(price) ? price : null, time, s);
        continue;
      }

      // Form: "Label: <timestamp>"  (Mother / Child / Pullback Candle / Pivot Candle / sl_candle_time)
      m = s.match(/^([A-Za-z][\w\s]*?):\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*$/);
      if (m) {
        const lbl = m[1].replace(/\s*Candle$/i, "").trim(); // "Pullback Candle" → "Pullback"
        const time = parseTimestamp(m[2]);
        if (time != null) push(lbl, null, time, s);
        continue;
      }

      // Form: "Label: <price>"  (bare numeric levels — A/B/C/D/L1/H1)
      m = s.match(/^([A-Z][A-Za-z0-9_]*):\s*([-\d.]+)\s*$/);
      if (m) {
        const lbl = m[1];
        if (!["A", "B", "C", "D", "L1", "H1"].includes(lbl)) continue;
        const price = parseFloat(m[2]);
        if (Number.isFinite(price) && entryTimeUnix != null) {
          push(lbl, price, entryTimeUnix, s);
        }
        continue;
      }
    }
  }

  return out.sort((a, b) => (a.timeUnix ?? 0) - (b.timeUnix ?? 0));
}

function isOptionDerivedLabel(label: string): boolean {
  // Most structure labels are spot/fut derived. Option-derived markers would be
  // prefixed with "opt_" or contain "premium". Conservative: nothing today.
  return label.startsWith("opt_") || /premium/i.test(label);
}

export async function loadTradeChartBundle(tradeId: string): Promise<TradeChartBundle> {
  // 1. Fetch trade row
  const hist = await fetchAPI<TradesHistoryResponse>("/api/trades/history?days=180");
  const trade = hist.trades.find((t) => t.trade_id === tradeId);
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  // 2. Fetch trade-fired blocks + match
  let block: TradeFiredBlock | null = null;
  try {
    const blocksResp = await fetchAPI<TradeFiredResponse>("/api/trade-fired?source=all&limit=2000");
    block = matchTradeFiredBlock(trade, blocksResp.blocks);
  } catch { /* ignore */ }

  // 3. Resolve option token (best-effort)
  const { token: optionToken, symbol: optionSymbol } = await findOptionToken(
    block?.symbol ?? null,
    trade.strike,
    trade.option_type
  );

  const tradeDate = trade.entry_time ? trade.entry_time.slice(0, 10) : null;

  // 4. Fetch all candles in parallel (clipped to trade-day window)
  const [spot1, spot5, fut1, fut5, opt1, opt5] = await Promise.all([
    fetchOhlc("spot", "1m", tradeDate),
    fetchOhlc("spot", "5m", tradeDate),
    fetchOhlc("fut",  "1m", tradeDate),
    fetchOhlc("fut",  "5m", tradeDate),
    optionToken ? fetchOptionCandles(optionToken, "1m", tradeDate) : Promise.resolve([] as OHLCCandle[]),
    optionToken ? fetchOptionCandles(optionToken, "5m", tradeDate) : Promise.resolve([] as OHLCCandle[]),
  ]);

  // 5. Build markers per pane
  const entryTimeUnix = trade.entry_time
    ? Math.floor(Date.parse(trade.entry_time.replace(" ", "T") + "Z") / 1000)
    : null;
  const allPoints = extractStructurePoints(block, trade, entryTimeUnix);
  const signalSource = pickSignalSource(trade, block);
  const optionPts = allPoints.filter((p) => isOptionDerivedLabel(p.label));
  const sourcePts = allPoints.filter((p) => !isOptionDerivedLabel(p.label));

  return {
    trade,
    block,
    optionToken,
    optionSymbol,
    signalSource,
    candles: {
      spot:   { "1m": spot1, "5m": spot5 },
      fut:    { "1m": fut1, "5m": fut5 },
      option: { "1m": opt1, "5m": opt5 },
    },
    markers: {
      spot:   signalSource === "spot" ? sourcePts : [],
      fut:    signalSource === "fut"  ? sourcePts : [],
      option: optionPts,
    },
  };
}
