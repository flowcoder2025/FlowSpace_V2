"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface DashboardSidebarProps {
  spaceId: string;
  spaceName: string;
}

const SIDEBAR_ITEMS = [
  { label: DASHBOARD_COPY.NAV.items.overview, segment: "" },
  { label: DASHBOARD_COPY.NAV.items.members, segment: "/members" },
  { label: DASHBOARD_COPY.NAV.items.messages, segment: "/messages" },
  { label: DASHBOARD_COPY.NAV.items.logs, segment: "/logs" },
  { label: DASHBOARD_COPY.NAV.items.media, segment: "/media" },
  { label: DASHBOARD_COPY.NAV.items.analytics, segment: "/analytics" },
  { label: DASHBOARD_COPY.NAV.items.settings, segment: "/settings" },
] as const;

export function DashboardSidebar({ spaceId, spaceName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/spaces/${spaceId}`;

  return (
    <aside className="w-60 min-h-screen bg-ink text-ink-light flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-cream/10">
        <Link href="/my-spaces" className="text-xs text-ink-muted hover:text-ink-light">
          {DASHBOARD_COPY.NAV.backToSpaces}
        </Link>
        <h2 className="mt-2 text-sm font-semibold text-white truncate">{spaceName}</h2>
        <p className="text-xs text-ink-muted">{DASHBOARD_COPY.NAV.adminDashboard}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {SIDEBAR_ITEMS.map((item) => {
          const href = `${basePath}${item.segment}`;
          const isActive =
            item.segment === ""
              ? pathname === basePath
              : pathname.startsWith(href);

          return (
            <Link
              key={item.segment}
              href={href}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-ink text-white border-r-2 border-ink"
                  : "hover:bg-ink hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-cream/10">
        <Link
          href={`/space/${spaceId}`}
          className="block text-xs text-ink-muted hover:text-ink-light"
        >
          {DASHBOARD_COPY.NAV.openSpace}
        </Link>
      </div>
    </aside>
  );
}
