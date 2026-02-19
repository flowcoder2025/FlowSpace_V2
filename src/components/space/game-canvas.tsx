"use client";

import { useEffect, useRef } from "react";

interface GameCanvasProps {
  spaceId: string;
  userId: string;
  nickname: string;
  avatar: string;
}

export default function GameCanvas({ spaceId, userId, nickname, avatar }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    async function initGame() {
      // Dynamic import to avoid SSR
      const { createGame } = await import("@/features/space/game");

      if (destroyed || !container) return;

      const game = await createGame(container, {
        spaceId,
        userId,
        nickname,
        avatar,
      });

      if (destroyed) {
        game.destroy(true);
        return;
      }

      gameRef.current = game;
    }

    initGame();

    return () => {
      destroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [spaceId, userId, nickname, avatar]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
