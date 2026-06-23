"use client";

import { useState } from "react";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

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
        throw new Error(data.error || DASHBOARD_COPY.ANNOUNCE.error);
      }

      setContent("");
      setMessage({ type: "success", text: DASHBOARD_COPY.ANNOUNCE.success });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : DASHBOARD_COPY.COMMON.unknownError });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-line p-5">
      <h3 className="text-sm font-semibold text-ink-soft mb-3">{DASHBOARD_COPY.ANNOUNCE.title}</h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={DASHBOARD_COPY.ANNOUNCE.placeholder}
        rows={3}
        className="w-full px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 resize-none"
      />
      {message && (
        <p className={`mt-2 text-xs ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting || !content.trim()}
        className="mt-3 px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? DASHBOARD_COPY.ANNOUNCE.submitting : DASHBOARD_COPY.ANNOUNCE.submit}
      </button>
    </form>
  );
}
