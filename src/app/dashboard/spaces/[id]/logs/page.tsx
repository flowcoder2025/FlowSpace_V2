"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { EventLogTable } from "@/components/dashboard/event-log-table";

const EVENT_TYPES = ["", "ENTER", "EXIT", "CHAT", "INTERACTION", "ADMIN_ACTION"] as const;

interface LogEntry {
  id: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

export default function LogsPage() {
  const params = useParams<{ id: string }>();
  const spaceId = params.id;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (nextCursor?: string | null) => {
      setIsLoading(true);
      try {
        const qs = new URLSearchParams();
        if (filter) qs.set("eventType", filter);
        if (nextCursor) qs.set("cursor", nextCursor);

        const res = await fetch(`/api/spaces/${spaceId}/admin/logs?${qs}`);
        if (!res.ok) throw new Error("Failed to load logs");
        const data = await res.json();

        if (nextCursor) {
          setLogs((prev) => [...prev, ...data.logs]);
        } else {
          setLogs(data.logs);
        }
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "로그를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [spaceId, filter]
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Event Logs</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-line rounded px-3 py-1.5"
        >
          <option value="">All Events</option>
          {EVENT_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-line p-5">
        <EventLogTable
          logs={logs}
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={() => loadLogs(cursor)}
        />
      </div>
    </div>
  );
}
