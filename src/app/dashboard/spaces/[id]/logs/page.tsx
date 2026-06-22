"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { EventLogTable } from "@/components/dashboard/event-log-table";
import {
  localDateToStartInstant,
  localDateToEndInstant,
} from "@/components/dashboard/date-range";

// 표시용 이벤트 타입 옵션(서버는 SpaceEventType enum으로 검증 — SSOT). "" = 전체.
const EVENT_TYPES = [
  "",
  "ENTER",
  "EXIT",
  "INTERACTION",
  "CHAT",
  "ADMIN_ACTION",
  "VIDEO_START",
  "VIDEO_END",
  "SCREEN_SHARE_START",
  "SCREEN_SHARE_END",
] as const;

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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
        const startInstant = localDateToStartInstant(startDate);
        const endInstant = localDateToEndInstant(endDate);
        if (startInstant) qs.set("startDate", startInstant);
        if (endInstant) qs.set("endDate", endInstant);

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
    [spaceId, filter, startDate, endDate]
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-ink">Event Logs</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="이벤트 타입 필터"
            className="text-sm border border-line rounded px-3 py-1.5"
          >
            <option value="">All Events</option>
            {EVENT_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="시작 날짜"
            className="text-sm border border-line rounded px-3 py-1.5"
          />
          <span className="text-ink-muted text-sm">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="종료 날짜"
            className="text-sm border border-line rounded px-3 py-1.5"
          />
        </div>
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
