"use client";

import { useState, useEffect, useCallback } from "react";

interface GenerationProgressProps {
  assetId: string;
  onComplete?: (asset: AssetResult) => void;
}

interface AssetResult {
  id: string;
  status: string;
  filePath?: string;
  thumbnailPath?: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기 중...",
  PROCESSING: "생성 중...",
  COMPLETED: "완료!",
  FAILED: "실패",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  PROCESSING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  FAILED: "bg-red-500",
};

const STATUS_PROGRESS: Record<string, number> = {
  PENDING: 10,
  PROCESSING: 50,
  COMPLETED: 100,
  FAILED: 0,
};

const POLL_INTERVAL = 2000;

export function GenerationProgress({ assetId, onComplete }: GenerationProgressProps) {
  const [status, setStatus] = useState("PENDING");
  const [progress, setProgress] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (!res.ok) {
        setError("Failed to fetch status");
        return true; // stop polling
      }

      const data = await res.json();
      setStatus(data.status);
      setProgress(STATUS_PROGRESS[data.status] ?? 0);

      if (data.status === "COMPLETED") {
        onComplete?.({
          id: data.id,
          status: data.status,
          filePath: data.filePath,
          thumbnailPath: data.thumbnailPath,
        });
        return true; // stop polling
      }

      if (data.status === "FAILED") {
        const meta = data.metadata as { error?: string } | null;
        setError(meta?.error || "Generation failed");
        return true; // stop polling
      }

      return false; // continue polling
    } catch {
      setError("Network error");
      return true;
    }
  }, [assetId, onComplete]);

  useEffect(() => {
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const done = await fetchStatus();
      if ((done || stopped) && intervalId) {
        clearInterval(intervalId);
      }
    };

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL);

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchStatus]);

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {STATUS_LABELS[status] || status}
        </span>
        <span className="text-sm text-gray-500">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${STATUS_COLORS[status] || "bg-gray-400"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
