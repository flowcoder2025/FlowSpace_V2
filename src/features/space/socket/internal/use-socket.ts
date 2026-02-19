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

interface ChatMessageData {
  id?: string;
  tempId?: string;
  userId: string;
  nickname: string;
  content: string;
  type: string;
  timestamp: string;
  replyTo?: { id: string; senderNickname: string; content: string };
  partyId?: string;
  partyName?: string;
}

interface WhisperReceiveData {
  id?: string;
  senderId: string;
  senderNickname: string;
  content: string;
  timestamp: string;
}

interface WhisperSentData {
  id?: string;
  targetNickname: string;
  content: string;
  timestamp: string;
}

interface ReactionUpdatedData {
  messageId: string;
  reactions: Array<{ type: "thumbsup" | "heart" | "check"; userId: string; userNickname: string }>;
}

interface EditorTileUpdatedData {
  userId: string;
  layer: string;
  col: number;
  row: number;
  tileIndex: number;
}

interface EditorObjectPlacedData {
  userId: string;
  id: string;
  objectType: string;
  positionX: number;
  positionY: number;
  label?: string;
}

interface EditorObjectMovedData {
  userId: string;
  id: string;
  positionX: number;
  positionY: number;
}

interface EditorObjectDeletedData {
  userId: string;
  id: string;
}

interface UseSocketOptions {
  spaceId: string;
  userId: string;
  nickname: string;
  avatar: string;
  onChatMessage?: (data: ChatMessageData) => void;
  onWhisperReceive?: (data: WhisperReceiveData) => void;
  onWhisperSent?: (data: WhisperSentData) => void;
  onMessageIdUpdate?: (data: { tempId: string; realId: string }) => void;
  onMessageFailed?: (data: { tempId: string; error: string }) => void;
  onMessageDeleted?: (data: { messageId: string; deletedBy: string }) => void;
  onReactionUpdated?: (data: ReactionUpdatedData) => void;
  onPartyMessage?: (data: ChatMessageData) => void;
  onMemberMuted?: (data: { memberId: string; nickname: string; mutedBy: string }) => void;
  onMemberUnmuted?: (data: { memberId: string; nickname: string; unmutedBy: string }) => void;
  onMemberKicked?: (data: { memberId: string; nickname: string; kickedBy: string }) => void;
  onAnnouncement?: (data: { content: string; announcer: string; timestamp: string }) => void;
  onEditorTileUpdated?: (data: EditorTileUpdatedData) => void;
  onEditorObjectPlaced?: (data: EditorObjectPlacedData) => void;
  onEditorObjectMoved?: (data: EditorObjectMovedData) => void;
  onEditorObjectDeleted?: (data: EditorObjectDeletedData) => void;
}

interface UseSocketReturn {
  isConnected: boolean;
  players: PlayerData[];
  sendMovement: (data: MovementData) => void;
  sendChat: (content: string, type: "group" | "whisper" | "party", targetId?: string, replyTo?: { id: string; senderNickname: string; content: string }) => void;
  sendWhisper: (targetNickname: string, content: string) => void;
  sendReactionToggle: (messageId: string, reactionType: "thumbsup" | "heart" | "check") => void;
  sendAdminCommand: (command: string, data: Record<string, unknown>) => void;
  joinParty: (zoneId: string) => void;
  leaveParty: (zoneId: string) => void;
  sendPartyMessage: (content: string) => void;
  sendEditorTileUpdate: (data: { layer: string; col: number; row: number; tileIndex: number }) => void;
  sendEditorObjectPlace: (data: { id: string; objectType: string; positionX: number; positionY: number; label?: string }) => void;
  sendEditorObjectMove: (data: { id: string; positionX: number; positionY: number }) => void;
  sendEditorObjectDelete: (data: { id: string }) => void;
}

const MOVE_THROTTLE_MS = 100;

export function useSocket({
  spaceId,
  userId,
  nickname,
  avatar,
  onChatMessage,
  onWhisperReceive,
  onWhisperSent,
  onMessageIdUpdate,
  onMessageFailed,
  onMessageDeleted,
  onReactionUpdated,
  onPartyMessage,
  onMemberMuted,
  onMemberUnmuted,
  onMemberKicked,
  onAnnouncement,
  onEditorTileUpdated,
  onEditorObjectPlaced,
  onEditorObjectMoved,
  onEditorObjectDeleted,
}: UseSocketOptions): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const socketRef = useRef<TypedSocket | null>(null);
  const lastMoveRef = useRef(0);
  const playersMapRef = useRef(new Map<string, PlayerData>());

  // Refs for callbacks to avoid stale closures
  const onChatMessageRef = useRef(onChatMessage);
  const onWhisperReceiveRef = useRef(onWhisperReceive);
  const onWhisperSentRef = useRef(onWhisperSent);
  const onMessageIdUpdateRef = useRef(onMessageIdUpdate);
  const onMessageFailedRef = useRef(onMessageFailed);
  const onMessageDeletedRef = useRef(onMessageDeleted);
  const onReactionUpdatedRef = useRef(onReactionUpdated);
  const onPartyMessageRef = useRef(onPartyMessage);
  const onMemberMutedRef = useRef(onMemberMuted);
  const onMemberUnmutedRef = useRef(onMemberUnmuted);
  const onMemberKickedRef = useRef(onMemberKicked);
  const onAnnouncementRef = useRef(onAnnouncement);
  const onEditorTileUpdatedRef = useRef(onEditorTileUpdated);
  const onEditorObjectPlacedRef = useRef(onEditorObjectPlaced);
  const onEditorObjectMovedRef = useRef(onEditorObjectMoved);
  const onEditorObjectDeletedRef = useRef(onEditorObjectDeleted);

  useEffect(() => {
    onChatMessageRef.current = onChatMessage;
    onWhisperReceiveRef.current = onWhisperReceive;
    onWhisperSentRef.current = onWhisperSent;
    onMessageIdUpdateRef.current = onMessageIdUpdate;
    onMessageFailedRef.current = onMessageFailed;
    onMessageDeletedRef.current = onMessageDeleted;
    onReactionUpdatedRef.current = onReactionUpdated;
    onPartyMessageRef.current = onPartyMessage;
    onMemberMutedRef.current = onMemberMuted;
    onMemberUnmutedRef.current = onMemberUnmuted;
    onMemberKickedRef.current = onMemberKicked;
    onAnnouncementRef.current = onAnnouncement;
    onEditorTileUpdatedRef.current = onEditorTileUpdated;
    onEditorObjectPlacedRef.current = onEditorObjectPlaced;
    onEditorObjectMovedRef.current = onEditorObjectMoved;
    onEditorObjectDeletedRef.current = onEditorObjectDeleted;
  }, [
    onChatMessage, onWhisperReceive, onWhisperSent, onMessageIdUpdate,
    onMessageFailed, onMessageDeleted, onReactionUpdated, onPartyMessage,
    onMemberMuted, onMemberUnmuted, onMemberKicked, onAnnouncement,
    onEditorTileUpdated, onEditorObjectPlaced, onEditorObjectMoved, onEditorObjectDeleted,
  ]);

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

        // Chat events
        sock.on("chat:message", (data) => {
          onChatMessageRef.current?.(data);
        });

        sock.on("chat:messageIdUpdate", (data) => {
          onMessageIdUpdateRef.current?.(data);
        });

        sock.on("chat:messageFailed", (data) => {
          onMessageFailedRef.current?.(data);
        });

        sock.on("chat:messageDeleted", (data) => {
          onMessageDeletedRef.current?.(data);
        });

        // Whisper events
        sock.on("whisper:receive", (data) => {
          onWhisperReceiveRef.current?.(data);
        });

        sock.on("whisper:sent", (data) => {
          onWhisperSentRef.current?.(data);
        });

        // Party events
        sock.on("party:message", (data) => {
          onPartyMessageRef.current?.({ ...data, type: "party" });
        });

        // Reaction events
        sock.on("reaction:updated", (data) => {
          onReactionUpdatedRef.current?.(data);
        });

        // Admin events
        sock.on("member:muted", (data) => {
          onMemberMutedRef.current?.(data);
        });

        sock.on("member:unmuted", (data) => {
          onMemberUnmutedRef.current?.(data);
        });

        sock.on("member:kicked", (data) => {
          onMemberKickedRef.current?.(data);
        });

        sock.on("space:announcement", (data) => {
          onAnnouncementRef.current?.(data);
        });

        // Editor events
        sock.on("editor:tile-updated", (data) => {
          onEditorTileUpdatedRef.current?.(data);
        });
        sock.on("editor:object-placed", (data) => {
          onEditorObjectPlacedRef.current?.(data);
        });
        sock.on("editor:object-moved", (data) => {
          onEditorObjectMovedRef.current?.(data);
        });
        sock.on("editor:object-deleted", (data) => {
          onEditorObjectDeletedRef.current?.(data);
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
    (content: string, type: "group" | "whisper" | "party", targetId?: string, replyTo?: { id: string; senderNickname: string; content: string }) => {
      socketRef.current?.emit("chat:send", { content, type, targetId, replyTo });
    },
    []
  );

  const sendWhisper = useCallback(
    (targetNickname: string, content: string) => {
      socketRef.current?.emit("whisper:send", { targetNickname, content });
    },
    []
  );

  const sendReactionToggle = useCallback(
    (messageId: string, reactionType: "thumbsup" | "heart" | "check") => {
      socketRef.current?.emit("reaction:toggle", { messageId, reactionType });
    },
    []
  );

  const sendAdminCommand = useCallback(
    (command: string, data: Record<string, unknown>) => {
      const sock = socketRef.current;
      if (!sock) return;

      switch (command) {
        case "admin:mute":
          sock.emit("admin:mute", data as { targetNickname: string; duration?: number });
          break;
        case "admin:unmute":
          sock.emit("admin:unmute", data as { targetNickname: string });
          break;
        case "admin:kick":
          sock.emit("admin:kick", data as { targetNickname: string });
          break;
        case "admin:announce":
          sock.emit("admin:announce", data as { content: string });
          break;
        case "chat:delete":
          sock.emit("chat:delete", data as { messageId: string });
          break;
      }
    },
    []
  );

  const joinParty = useCallback((zoneId: string) => {
    socketRef.current?.emit("party:join", { zoneId });
  }, []);

  const leaveParty = useCallback((zoneId: string) => {
    socketRef.current?.emit("party:leave", { zoneId });
  }, []);

  const sendPartyMessage = useCallback((content: string) => {
    socketRef.current?.emit("party:message", { content });
  }, []);

  const sendEditorTileUpdate = useCallback(
    (data: { layer: string; col: number; row: number; tileIndex: number }) => {
      socketRef.current?.emit("editor:tile-update", data);
    },
    []
  );

  const sendEditorObjectPlace = useCallback(
    (data: { id: string; objectType: string; positionX: number; positionY: number; label?: string }) => {
      socketRef.current?.emit("editor:object-place", data);
    },
    []
  );

  const sendEditorObjectMove = useCallback(
    (data: { id: string; positionX: number; positionY: number }) => {
      socketRef.current?.emit("editor:object-move", data);
    },
    []
  );

  const sendEditorObjectDelete = useCallback(
    (data: { id: string }) => {
      socketRef.current?.emit("editor:object-delete", data);
    },
    []
  );

  return {
    isConnected,
    players,
    sendMovement,
    sendChat,
    sendWhisper,
    sendReactionToggle,
    sendAdminCommand,
    joinParty,
    leaveParty,
    sendPartyMessage,
    sendEditorTileUpdate,
    sendEditorObjectPlace,
    sendEditorObjectMove,
    sendEditorObjectDelete,
  };
}
