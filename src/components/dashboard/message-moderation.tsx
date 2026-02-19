"use client";

import { useState } from "react";

interface ChatMsg {
  id: string;
  senderName: string;
  content: string;
  type: string;
  isDeleted: boolean;
  createdAt: string;
}

interface MessageModerationProps {
  spaceId: string;
  messages: ChatMsg[];
  onRefresh: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
}

export function MessageModeration({
  spaceId,
  messages,
  onRefresh,
  hasMore,
  onLoadMore,
  isLoading,
}: MessageModerationProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(messageId: string) {
    if (!confirm("이 메시지를 삭제하시겠습니까?")) return;

    setDeletingId(messageId);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/admin/messages/${messageId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Delete failed");
      }
      onRefresh();
    } catch {
      alert("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start justify-between p-3 rounded-md border ${
              msg.isDeleted ? "bg-red-50 border-red-200 opacity-60" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{msg.senderName}</span>
                <span className="text-xs text-gray-400">
                  {new Date(msg.createdAt).toLocaleString("ko-KR")}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {msg.type}
                </span>
                {msg.isDeleted && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                    Deleted
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-700 truncate">{msg.content}</p>
            </div>
            {!msg.isDeleted && (
              <button
                onClick={() => handleDelete(msg.id)}
                disabled={deletingId === msg.id}
                className="ml-3 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

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
