"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "~" },
  { href: "/trades", label: "Trades", icon: "%" },
  { href: "/orders", label: "Orders", icon: "#" },
  { href: "/pnl", label: "P&L", icon: "$" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col min-h-screen">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">AlgoTrading</h1>
        <p className="text-xs text-slate-400">by Abhishek Choudhary</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base font-mono">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">NIFTY Options Bot</p>
        <p className="text-[10px] text-slate-600 mt-1">Abhishek Choudhary | AI/ML Developer</p>
      </div>
    </aside>
  );
}
