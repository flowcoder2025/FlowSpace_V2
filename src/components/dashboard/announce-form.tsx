"use client";

import { useState } from "react";

interface AnnounceFormProps {
  spaceId: string;
}

export function AnnounceForm({ spaceId }: AnnounceFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/admin/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send announcement");
      }

      setContent("");
      setMessage({ type: "success", text: "공지가 발송되었습니다." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Send Announcement</h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="공지사항을 입력하세요..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      {message && (
        <p className={`mt-2 text-xs ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting || !content.trim()}
        className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? "발송 중..." : "공지 발송"}
      </button>
    </form>
  );
}
