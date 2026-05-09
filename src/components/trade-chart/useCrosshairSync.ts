"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";

interface PaneRef {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  unsubscribe?: () => void;
}

// Fyers-style synchronized crosshair across multiple lightweight-charts panes.
// When the user moves the crosshair on any chart, mirror the same time on all
// other charts via setCrosshairPosition. Visible-range scrolling is also synced.
export function useCrosshairSync() {
  const panesRef = useRef<Map<string, PaneRef>>(new Map());
  const syncingRef = useRef(false);

  const register = (id: string, chart: IChartApi, series: ISeriesApi<"Candlestick">) => {
    if (panesRef.current.has(id)) return;

    const onMove = (param: MouseEventParams) => {
      if (syncingRef.current) return;
      if (!param.time) {
        syncingRef.current = true;
        panesRef.current.forEach((p, pid) => {
          if (pid === id) return;
          try { p.chart.clearCrosshairPosition(); } catch { /* ignore */ }
        });
        syncingRef.current = false;
        return;
      }
      syncingRef.current = true;
      const t = param.time as Time;
      panesRef.current.forEach((p, pid) => {
        if (pid === id) return;
        try { p.chart.setCrosshairPosition(0, t, p.series); } catch { /* ignore */ }
      });
      syncingRef.current = false;
    };
    chart.subscribeCrosshairMove(onMove);

    // Note: only crosshair is synced. Pan/zoom is independent per pane
    // (Fyres-style) so the mouse wheel doesn't fight cross-pane updates.

    panesRef.current.set(id, {
      chart,
      series,
      unsubscribe: () => {
        try { chart.unsubscribeCrosshairMove(onMove); } catch { /* ignore */ }
      },
    });
  };

  const unregister = (id: string) => {
    const p = panesRef.current.get(id);
    p?.unsubscribe?.();
    panesRef.current.delete(id);
  };

  useEffect(() => {
    const panes = panesRef.current;
    return () => {
      panes.forEach((p) => p.unsubscribe?.());
      panes.clear();
    };
  }, []);

  return { register, unregister };
}
