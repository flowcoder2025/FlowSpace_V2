"use client";

import { useGameStore } from "@/stores/game-store";

interface LoadingScreenProps {
  spaceName: string;
}

export default function LoadingScreen({ spaceName }: LoadingScreenProps) {
  const loadingProgress = useGameStore((s) => s.loadingProgress);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink">
      <h1 className="mb-2 font-serif text-3xl font-medium text-cream">{spaceName}</h1>
      <p className="mb-6 text-sm text-cream/60">스페이스를 불러오는 중...</p>

      {/* Progress bar */}
      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-cream/10">
        <div
          className="h-full rounded-full bg-cream transition-all duration-300"
          style={{ width: `${Math.max(loadingProgress, 10)}%` }}
        />
      </div>

      <p className="mt-3 text-xs text-cream/50">
        {loadingProgress > 0 ? `${loadingProgress}%` : "초기화 중..."}
      </p>
    </div>
  );
}
