"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MessageModeration } from "@/components/dashboard/message-moderation";
import {
  localDateToStartInstant,
  localDateToEndInstant,
} from "@/components/dashboard/date-range";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface ChatMsg {
  id: string;
  senderName: string;
  content: string;
  type: string;
  isDeleted: boolean;
  createdAt: string;
}

// 표시용 타입 옵션(서버는 MessageType enum으로 검증 — SSOT). "" = 전체.
const MESSAGE_TYPE_OPTIONS = [
  "MESSAGE",
  "WHISPER",
  "PARTY",
  "SYSTEM",
  "ANNOUNCEMENT",
] as const;

export default function MessagesPage() {
  const params = useParams<{ id: string }>();
  const spaceId = params.id;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadMessages = useCallback(
    async (nextCursor?: string | null) => {
      setIsLoading(true);
      try {
        const qs = new URLSearchParams();
        if (nextCursor) qs.set("cursor", nextCursor);
        if (typeFilter) qs.set("type", typeFilter);
        const startInstant = localDateToStartInstant(startDate);
        const endInstant = localDateToEndInstant(endDate);
        if (startInstant) qs.set("startDate", startInstant);
        if (endInstant) qs.set("endDate", endInstant);

        const res = await fetch(`/api/spaces/${spaceId}/admin/messages?${qs}`);
        if (!res.ok) throw new Error(DASHBOARD_COPY.MESSAGES.loadError);
        const data = await res.json();

        if (nextCursor) {
          setMessages((prev) => [...prev, ...data.messages]);
        } else {
          setMessages(data.messages);
        }
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : DASHBOARD_COPY.MESSAGES.loadError
        );
      } finally {
        setIsLoading(false);
      }
    },
    [spaceId, typeFilter, startDate, endDate]
  );

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{DASHBOARD_COPY.MESSAGES.title}</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={DASHBOARD_COPY.MESSAGES.typeFilterAriaLabel}
          className="text-sm border border-line rounded px-3 py-1.5"
        >
          <option value="">{DASHBOARD_COPY.MESSAGES.allTypes}</option>
          {MESSAGE_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {DASHBOARD_COPY.messageTypeLabel(t)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label={DASHBOARD_COPY.LOGS.startDateAriaLabel}
          className="text-sm border border-line rounded px-3 py-1.5"
        />
        <span className="text-ink-muted text-sm">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label={DASHBOARD_COPY.LOGS.endDateAriaLabel}
          className="text-sm border border-line rounded px-3 py-1.5"
        />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="bg-white rounded-lg border border-line p-5">
        <MessageModeration
          spaceId={spaceId}
          messages={messages}
          onRefresh={() => loadMessages()}
          hasMore={hasMore}
          onLoadMore={() => loadMessages(cursor)}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
