"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MessageModeration } from "@/components/dashboard/message-moderation";

interface ChatMsg {
  id: string;
  senderName: string;
  content: string;
  type: string;
  isDeleted: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const params = useParams<{ id: string }>();
  const spaceId = params.id;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(
    async (nextCursor?: string | null) => {
      setIsLoading(true);
      try {
        const qs = new URLSearchParams();
        if (nextCursor) qs.set("cursor", nextCursor);

        const res = await fetch(`/api/spaces/${spaceId}/admin/messages?${qs}`);
        if (!res.ok) throw new Error("Failed to load messages");
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
          err instanceof Error ? err.message : "메시지를 불러오지 못했습니다."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [spaceId]
  );

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Messages</h1>
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
