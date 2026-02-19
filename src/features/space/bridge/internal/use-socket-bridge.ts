/**
 * Socket ↔ EventBridge 양방향 브릿지
 *
 * Socket 이벤트 → EventBridge (REMOTE_*)
 * EventBridge (PLAYER_MOVED) → Socket emit
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { eventBridge, GameEvents, type PlayerPosition } from "@/features/space/game";
import { useSocket, type PlayerData } from "@/features/space/socket";

interface ChatMessageData {
  userId: string;
  nickname: string;
  content: string;
  type: string;
  timestamp: string;
}

interface UseSocketBridgeOptions {
  spaceId: string;
  userId: string;
  nickname: string;
  avatar: string;
  onChatMessage?: (data: ChatMessageData) => void;
}

interface UseSocketBridgeReturn {
  isConnected: boolean;
  players: PlayerData[];
  sendChat: (content: string, type: "group" | "whisper" | "party", targetId?: string) => void;
}

export function useSocketBridge(options: UseSocketBridgeOptions): UseSocketBridgeReturn {
  const { spaceId, userId, nickname, avatar, onChatMessage } = options;
  const { isConnected, players, sendMovement, sendChat } = useSocket({
    spaceId,
    userId,
    nickname,
    avatar,
    onChatMessage,
  });

  const prevPlayersRef = useRef<Map<string, PlayerData>>(new Map());

  // EventBridge → Socket: PLAYER_MOVED → sock.emit("move")
  const onPlayerMoved = useCallback(
    (payload: unknown) => {
      const data = payload as PlayerPosition;
      sendMovement({
        x: data.x,
        y: data.y,
        direction: data.direction,
      });
    },
    [sendMovement]
  );

  useEffect(() => {
    eventBridge.on(GameEvents.PLAYER_MOVED, onPlayerMoved);
    return () => {
      eventBridge.off(GameEvents.PLAYER_MOVED, onPlayerMoved);
    };
  }, [onPlayerMoved]);

  // Socket → EventBridge: players 변경 감지 → REMOTE_* 이벤트 발행
  useEffect(() => {
    const prevMap = prevPlayersRef.current;
    const currentMap = new Map(players.map((p) => [p.userId, p]));

    // 새 플레이어 (joined)
    for (const [id, player] of currentMap) {
      if (!prevMap.has(id)) {
        eventBridge.emit(GameEvents.REMOTE_PLAYER_JOINED, {
          userId: player.userId,
          x: player.position.x,
          y: player.position.y,
          direction: "down",
          nickname: player.nickname,
          avatar: player.avatar,
        });
      } else {
        // 위치 변경 (moved)
        const prev = prevMap.get(id)!;
        if (prev.position.x !== player.position.x || prev.position.y !== player.position.y) {
          eventBridge.emit(GameEvents.REMOTE_PLAYER_MOVED, {
            userId: player.userId,
            x: player.position.x,
            y: player.position.y,
            direction: "down",
            nickname: player.nickname,
            avatar: player.avatar,
          });
        }
      }
    }

    // 떠난 플레이어 (left)
    for (const [id] of prevMap) {
      if (!currentMap.has(id)) {
        eventBridge.emit(GameEvents.REMOTE_PLAYER_LEFT, { userId: id });
      }
    }

    prevPlayersRef.current = currentMap;
  }, [players]);

  return { isConnected, players, sendChat };
}
