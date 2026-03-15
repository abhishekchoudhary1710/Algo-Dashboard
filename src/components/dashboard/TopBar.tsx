"use client";

import { useEffect, useState, useRef } from "react";
import type { TickData, HeartbeatData } from "@/lib/api";

interface TopBarProps {
  tickData: TickData | null;
  heartbeat: HeartbeatData | null;
  connected: boolean;
  botRunning: boolean;
  killSwitch: boolean;
  ordersCount: number;
}

function usePriceFlash(price: number) {
  const prevRef = useRef(price);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (price > prevRef.current) setFlash("up");
    else if (price < prevRef.current) setFlash("down");
    prevRef.current = price;

    const t = setTimeout(() => setFlash(null), 500);
    return () => clearTimeout(t);
  }, [price]);

  return flash;
}

function isMarketOpen(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const totalMins = hours * 60 + minutes;
  return totalMins >= 555 && totalMins <= 930; // 9:15 - 15:30 IST
}

export default function TopBar({
  tickData,
  heartbeat,
  connected,
  botRunning,
  killSwitch,
  ordersCount,
}: TopBarProps) {
  const [clock, setClock] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);

  const spotFlash = usePriceFlash(tickData?.spot_ltp ?? 0);
  const futFlash = usePriceFlash(tickData?.fut_ltp ?? 0);

  useEffect(() => {
    const update = () => {
      setClock(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Kolkata",
        })
      );
      setMarketOpen(isMarketOpen());
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const feedAlive = heartbeat?.feed_alive ?? false;
  const connectionColor = connected
    ? feedAlive
      ? "bg-green-500"
      : "bg-yellow-500"
    : "bg-red-500";

  const premium = tickData ? tickData.premium : 0;
  const uptime = heartbeat
    ? `${Math.floor(heartbeat.uptime_seconds / 3600)}h ${Math.floor(
        (heartbeat.uptime_seconds % 3600) / 60
      )}m`
    : "--";

  return (
    <div className="bg-[#0d1117] border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-4 text-xs flex-wrap">
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-white tracking-wider">
          ALGOTERMINAL
        </span>
        <span
          className={`w-2 h-2 rounded-full ${connectionColor} ${
            connected && feedAlive ? "animate-pulse" : ""
          }`}
        />
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            killSwitch
              ? "bg-red-900/50 text-red-400"
              : botRunning
              ? "bg-green-900/50 text-green-400"
              : "bg-yellow-900/50 text-yellow-400"
          }`}
        >
          {killSwitch ? "KILLED" : botRunning ? "LIVE" : "STOPPED"}
        </span>
      </div>

      {/* Center: Prices */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <span className="text-slate-500 block">SPOT</span>
          <span
            className={`font-mono font-bold text-sm ${
              spotFlash === "up"
                ? "text-green-400"
                : spotFlash === "down"
                ? "text-red-400"
                : "text-white"
            }`}
          >
            {tickData?.spot_ltp ? tickData.spot_ltp.toFixed(2) : "--"}
          </span>
        </div>
        <div className="text-center">
          <span className="text-slate-500 block">FUT</span>
          <span
            className={`font-mono font-bold text-sm ${
              futFlash === "up"
                ? "text-green-400"
                : futFlash === "down"
                ? "text-red-400"
                : "text-white"
            }`}
          >
            {tickData?.fut_ltp ? tickData.fut_ltp.toFixed(2) : "--"}
          </span>
        </div>
        <div className="text-center">
          <span className="text-slate-500 block">PREMIUM</span>
          <span
            className={`font-mono font-bold text-sm ${
              premium > 0 ? "text-green-400" : premium < 0 ? "text-red-400" : "text-slate-300"
            }`}
          >
            {premium > 0 ? "+" : ""}
            {premium.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-4 text-slate-400">
        <span>
          Ticks: <span className="text-slate-200 font-mono">{tickData?.tick_count?.toLocaleString() ?? "--"}</span>
        </span>
        <span>
          Uptime: <span className="text-slate-200">{uptime}</span>
        </span>
        <span>
          Orders: <span className="text-slate-200 font-mono">{ordersCount}</span>
        </span>
        <span className="font-mono text-slate-200">{clock}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            marketOpen
              ? "bg-green-900/30 text-green-400"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {marketOpen ? "MARKET OPEN" : "CLOSED"}
        </span>
      </div>
    </div>
  );
}
