"use client";

import type { PublicSpaceEventPayload } from "@/lib/space-event-log-payload";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface EventLog {
  id: string;
  eventType: string;
  // API가 allowlist로 정규화한 공개 payload(WI-032) — 화면은 그대로 직렬화 표시.
  payload?: PublicSpaceEventPayload;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

interface EventLogTableProps {
  logs: EventLog[];
  onLoadMore?: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

const EVENT_COLORS: Record<string, string> = {
  ENTER: "bg-green-100 text-green-700",
  EXIT: "bg-cream-deep text-ink-muted",
  CHAT: "bg-blue-100 text-ink",
  INTERACTION: "bg-yellow-100 text-yellow-700",
  ADMIN_ACTION: "bg-red-100 text-red-700",
};

export function EventLogTable({ logs, onLoadMore, hasMore, isLoading }: EventLogTableProps) {
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            <th className="pb-3 font-medium">{DASHBOARD_COPY.LOGS.table.event}</th>
            <th className="pb-3 font-medium">{DASHBOARD_COPY.LOGS.table.user}</th>
            <th className="pb-3 font-medium">{DASHBOARD_COPY.LOGS.table.details}</th>
            <th className="pb-3 font-medium text-right">{DASHBOARD_COPY.LOGS.table.time}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-line">
              <td className="py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    EVENT_COLORS[log.eventType] || "bg-cream-deep text-ink-muted"
                  }`}
                >
                  {DASHBOARD_COPY.eventTypeLabel(log.eventType)}
                </span>
              </td>
              <td className="py-2 text-ink-soft">
                {log.user?.name || log.user?.email || "-"}
              </td>
              <td className="py-2 text-ink-muted text-xs max-w-xs truncate">
                {log.payload ? JSON.stringify(log.payload) : "-"}
              </td>
              <td className="py-2 text-ink-light text-xs text-right whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString("ko-KR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-ink hover:text-brand-deep disabled:opacity-50"
          >
            {isLoading ? DASHBOARD_COPY.COMMON.loading : DASHBOARD_COPY.COMMON.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
