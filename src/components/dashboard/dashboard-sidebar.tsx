"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardSidebarProps {
  spaceId: string;
  spaceName: string;
}

const SIDEBAR_ITEMS = [
  { label: "Overview", segment: "" },
  { label: "Members", segment: "/members" },
  { label: "Messages", segment: "/messages" },
  { label: "Logs", segment: "/logs" },
  { label: "Analytics", segment: "/analytics" },
  { label: "Settings", segment: "/settings" },
] as const;

export function DashboardSidebar({ spaceId, spaceName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/spaces/${spaceId}`;

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-gray-300 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <Link href="/my-spaces" className="text-xs text-gray-500 hover:text-gray-300">
          &larr; Back to Spaces
        </Link>
        <h2 className="mt-2 text-sm font-semibold text-white truncate">{spaceName}</h2>
        <p className="text-xs text-gray-500">Admin Dashboard</p>
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
                  ? "bg-gray-800 text-white border-r-2 border-blue-500"
                  : "hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <Link
          href={`/space/${spaceId}`}
          className="block text-xs text-gray-500 hover:text-gray-300"
        >
          Open Space &rarr;
        </Link>
      </div>
    </aside>
  );
}
