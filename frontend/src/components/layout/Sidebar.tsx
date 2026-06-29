"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookText, Star, Settings, TrendingUp } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Trade Journal", icon: BookText },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[220px] flex-shrink-0 flex-col border-r border-base-border bg-base-raised px-3 py-5">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-indigo to-accent-cyan shadow-glow_indigo">
          <TrendingUp size={18} className="text-base" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display text-lg font-bold leading-tight text-text-primary">SHER</div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Market Terminal</div>
        </div>
      </div>

      <div className="mb-4 h-px bg-base-border" />

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-indigo/15 text-accent-cyan border-l-2 border-accent-cyan -ml-[2px] pl-[14px]"
                  : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
              )}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 text-[10px] leading-relaxed text-text-tertiary">
        Analysis & decision support only.
        <br />
        Not financial advice.
      </div>
    </aside>
  );
}
