"use client";

interface EventLog {
  id: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
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
  EXIT: "bg-gray-100 text-gray-600",
  CHAT: "bg-blue-100 text-blue-700",
  INTERACTION: "bg-yellow-100 text-yellow-700",
  ADMIN_ACTION: "bg-red-100 text-red-700",
};

export function EventLogTable({ logs, onLoadMore, hasMore, isLoading }: EventLogTableProps) {
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 font-medium">Event</th>
            <th className="pb-3 font-medium">User</th>
            <th className="pb-3 font-medium">Details</th>
            <th className="pb-3 font-medium text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-100">
              <td className="py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    EVENT_COLORS[log.eventType] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {log.eventType}
                </span>
              </td>
              <td className="py-2 text-gray-700">
                {log.user?.name || log.user?.email || "-"}
              </td>
              <td className="py-2 text-gray-500 text-xs max-w-xs truncate">
                {log.payload ? JSON.stringify(log.payload) : "-"}
              </td>
              <td className="py-2 text-gray-400 text-xs text-right whitespace-nowrap">
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
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
