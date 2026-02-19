"use client";

import { useGameStore } from "@/stores/game-store";

interface LoadingScreenProps {
  spaceName: string;
}

export default function LoadingScreen({ spaceName }: LoadingScreenProps) {
  const loadingProgress = useGameStore((s) => s.loadingProgress);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900">
      <h1 className="mb-2 text-2xl font-bold text-white">{spaceName}</h1>
      <p className="mb-6 text-sm text-gray-400">Loading space...</p>

      {/* Progress bar */}
      <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-700">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${Math.max(loadingProgress, 10)}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {loadingProgress > 0 ? `${loadingProgress}%` : "Initializing..."}
      </p>
    </div>
  );
}
