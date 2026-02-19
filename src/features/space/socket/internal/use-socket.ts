"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
  MovementData,
} from "./types";
import { getSocketClient, disconnectSocket } from "./socket-client";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  spaceId: string;
  userId: string;
  nickname: string;
  avatar: string;
}

interface UseSocketReturn {
  isConnected: boolean;
  players: PlayerData[];
  sendMovement: (data: MovementData) => void;
  sendChat: (content: string, type: "group" | "whisper" | "party", targetId?: string) => void;
}

const MOVE_THROTTLE_MS = 100;

export function useSocket({
  spaceId,
  userId,
  nickname,
  avatar,
}: UseSocketOptions): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const socketRef = useRef<TypedSocket | null>(null);
  const lastMoveRef = useRef(0);
  const playersMapRef = useRef(new Map<string, PlayerData>());

  useEffect(() => {
    let mounted = true;

    function syncPlayers() {
      setPlayers(Array.from(playersMapRef.current.values()));
    }

    async function connect() {
      try {
        const sock = await getSocketClient();
        if (!mounted) return;

        socketRef.current = sock;

        sock.on("connect", () => {
          setIsConnected(true);
          sock.emit("join:space", { spaceId, userId, nickname, avatar });
        });

        sock.on("disconnect", () => {
          setIsConnected(false);
        });

        sock.on("players:list", ({ players: list }) => {
          playersMapRef.current.clear();
          for (const p of list) {
            if (p.userId !== userId) {
              playersMapRef.current.set(p.userId, p);
            }
          }
          syncPlayers();
        });

        sock.on("player:joined", (data) => {
          if (data.userId !== userId) {
            playersMapRef.current.set(data.userId, data);
            syncPlayers();
          }
        });

        sock.on("player:left", ({ userId: leftId }) => {
          playersMapRef.current.delete(leftId);
          syncPlayers();
        });

        sock.on("player:moved", ({ userId: movedId, x, y }) => {
          const player = playersMapRef.current.get(movedId);
          if (player) {
            player.position = { x, y };
          } else if (movedId !== userId) {
            playersMapRef.current.set(movedId, {
              userId: movedId,
              nickname: "Unknown",
              avatar: "default",
              position: { x, y },
            });
          }
          syncPlayers();
        });

        sock.on("error", ({ message }) => {
          console.error("[Socket] Error:", message);
        });

        if (!sock.connected) {
          sock.connect();
        }
      } catch (err) {
        console.error("[Socket] Connection failed:", err);
      }
    }

    connect();

    return () => {
      mounted = false;
      socketRef.current?.emit("leave:space", { spaceId });
      disconnectSocket();
      setIsConnected(false);
    };
  }, [spaceId, userId, nickname, avatar]);

  const sendMovement = useCallback((data: MovementData) => {
    const now = Date.now();
    if (now - lastMoveRef.current < MOVE_THROTTLE_MS) return;
    lastMoveRef.current = now;
    socketRef.current?.emit("move", data);
  }, []);

  const sendChat = useCallback(
    (content: string, type: "group" | "whisper" | "party", targetId?: string) => {
      socketRef.current?.emit("chat:send", { content, type, targetId });
    },
    []
  );

  return {
    isConnected,
    players,
    sendMovement,
    sendChat,
  };
}
