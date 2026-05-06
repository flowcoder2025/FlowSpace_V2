"use client";

import { ROUTES } from "@/constants/navigation";
import { type ReactNode } from "react";

interface SpaceHudProps {
  spaceName: string;
  isConnected: boolean;
  playerCount: number;
  editorSlot?: ReactNode;
}

export default function SpaceHud({ spaceName, isConnected, playerCount, editorSlot }: SpaceHudProps) {
  return (
    <div className="absolute left-4 top-4 z-40 flex items-center gap-3 rounded-lg bg-ink/80 px-3 py-2 backdrop-blur-md ring-1 ring-cream/10">
      {/* Exit button */}
      <a
        href={ROUTES.MY_SPACES}
        className="flex items-center gap-1 rounded-md bg-cream/10 px-2 py-1 text-xs text-cream transition-colors hover:bg-cream/20"
      >
        <span>&larr;</span>
        <span>나가기</span>
      </a>

      {/* Space name */}
      <h2 className="text-sm font-semibold text-cream">{spaceName}</h2>

      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-green-400" : "bg-red-400"
          }`}
        />
        <span className="text-xs text-cream/70">
          {isConnected ? "연결됨" : "연결 끊김"}
        </span>
      </div>

      {/* Player count */}
      <span className="text-xs text-cream/70">
        {playerCount}명 접속 중
      </span>

      {/* Editor toggle slot */}
      {editorSlot}
    </div>
  );
}
