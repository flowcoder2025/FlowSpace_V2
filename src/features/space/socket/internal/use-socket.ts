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
import { MOVE_THROTTLE_MS, DEFAULT_NICKNAME } from "@/features/space/chat/internal/chat-constants";

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

interface SocketErrorData {
  code: string;
  message: string;
}

// Media event data types
export interface RecordingStatusData {
  isRecording: boolean;
  recorderId: string;
  recorderNickname: string;
  startedAt: number;
}

export interface SpotlightData {
  participantId: string;
  nickname: string;
  isActive: boolean;
}

export interface ProximityChangedData {
  enabled: boolean;
  changedBy: string;
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
  onSocketError?: (data: SocketErrorData) => void;
  // Media events
  onRecordingStarted?: (data: RecordingStatusData) => void;
  onRecordingStopped?: (data: RecordingStatusData) => void;
  onSpotlightActivated?: (data: SpotlightData) => void;
  onSpotlightDeactivated?: (data: SpotlightData) => void;
  onProximityChanged?: (data: ProximityChangedData) => void;
}

interface UseSocketReturn {
  isConnected: boolean;
  socketError: string | null;
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
  // Avatar
  sendAvatarUpdate: (avatar: string) => void;
  // Media emitters
  sendRecordingStart: () => void;
  sendRecordingStop: () => void;
  sendSpotlightActivate: () => void;
  sendSpotlightDeactivate: () => void;
  sendProximitySet: (enabled: boolean) => void;
}

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
  onSocketError,
  onRecordingStarted,
  onRecordingStopped,
  onSpotlightActivated,
  onSpotlightDeactivated,
  onProximityChanged,
}: UseSocketOptions): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
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
  const onSocketErrorRef = useRef(onSocketError);
  const onRecordingStartedRef = useRef(onRecordingStarted);
  const onRecordingStoppedRef = useRef(onRecordingStopped);
  const onSpotlightActivatedRef = useRef(onSpotlightActivated);
  const onSpotlightDeactivatedRef = useRef(onSpotlightDeactivated);
  const onProximityChangedRef = useRef(onProximityChanged);

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
    onSocketErrorRef.current = onSocketError;
    onRecordingStartedRef.current = onRecordingStarted;
    onRecordingStoppedRef.current = onRecordingStopped;
    onSpotlightActivatedRef.current = onSpotlightActivated;
    onSpotlightDeactivatedRef.current = onSpotlightDeactivated;
    onProximityChangedRef.current = onProximityChanged;
  }, [
    onChatMessage, onWhisperReceive, onWhisperSent, onMessageIdUpdate,
    onMessageFailed, onMessageDeleted, onReactionUpdated, onPartyMessage,
    onMemberMuted, onMemberUnmuted, onMemberKicked, onAnnouncement,
    onEditorTileUpdated, onEditorObjectPlaced, onEditorObjectMoved, onEditorObjectDeleted,
    onSocketError,
    onRecordingStarted, onRecordingStopped,
    onSpotlightActivated, onSpotlightDeactivated, onProximityChanged,
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
          setSocketError(null);
          sock.emit("join:space", { spaceId, userId, nickname, avatar });
        });

        sock.on("disconnect", () => {
          setIsConnected(false);
        });

        sock.on("connect_error", (err) => {
          console.error("[Socket] Connect error:", err.message);
          setSocketError(`소켓 연결 실패: ${err.message}`);
          setIsConnected(false);
        });

        // ── 재연결 모니터링 ──
        sock.io.on("reconnect_attempt", (attempt) => {
          console.log(`[Socket] Reconnect attempt #${attempt}`);
          setSocketError(`재연결 시도 중... (#${attempt})`);
        });

        sock.io.on("reconnect", () => {
          console.log("[Socket] Reconnected successfully");
          setSocketError(null);
          setIsConnected(true);
          // 재연결 시 자동 join:space 재발송
          sock.emit("join:space", { spaceId, userId, nickname, avatar });
        });

        sock.io.on("reconnect_error", (err) => {
          console.error("[Socket] Reconnect error:", err.message);
        });

        sock.io.on("reconnect_failed", () => {
          console.error("[Socket] Reconnect failed after all attempts");
          setSocketError("서버 연결에 실패했습니다. 페이지를 새로고침해주세요.");
        });

        // ── 플레이어 이벤트 ──
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
              nickname: DEFAULT_NICKNAME,
              avatar: "default",
              position: { x, y },
            });
          }
          syncPlayers();
        });

        sock.on("player:avatar-updated", ({ userId: updatedId, avatar: newAvatar }) => {
          const player = playersMapRef.current.get(updatedId);
          if (player) {
            player.avatar = newAvatar;
            syncPlayers();
          }
        });

        // ── Chat events ──
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

        // ── Whisper events ──
        sock.on("whisper:receive", (data) => {
          onWhisperReceiveRef.current?.(data);
        });

        sock.on("whisper:sent", (data) => {
          onWhisperSentRef.current?.(data);
        });

        // ── Party events ──
        sock.on("party:message", (data) => {
          onPartyMessageRef.current?.({ ...data, type: "party" });
        });

        // ── Reaction events ──
        sock.on("reaction:updated", (data) => {
          onReactionUpdatedRef.current?.(data);
        });

        // ── Admin events ──
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

        // ── Error events (세분화) ──
        sock.on("chat:error", (data) => {
          onSocketErrorRef.current?.(data);
        });
        sock.on("whisper:error", (data) => {
          onSocketErrorRef.current?.(data);
        });
        sock.on("party:error", (data) => {
          onSocketErrorRef.current?.(data);
        });
        sock.on("admin:error", (data) => {
          onSocketErrorRef.current?.(data);
        });

        // ── Editor events ──
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

        // ── Media events ──
        sock.on("recording:started", (data) => {
          onRecordingStartedRef.current?.(data);
        });
        sock.on("recording:stopped", (data) => {
          onRecordingStoppedRef.current?.(data);
        });
        sock.on("spotlight:activated", (data) => {
          onSpotlightActivatedRef.current?.(data);
        });
        sock.on("spotlight:deactivated", (data) => {
          onSpotlightDeactivatedRef.current?.(data);
        });
        sock.on("proximity:changed", (data) => {
          onProximityChangedRef.current?.(data);
        });
        sock.on("media:error", (data) => {
          onSocketErrorRef.current?.(data);
        });

        sock.on("error", ({ message }) => {
          console.error("[Socket] Error:", message);
        });

        if (!sock.connected) {
          sock.connect();
        }
      } catch (err) {
        console.error("[Socket] Connection failed:", err);
        setSocketError("소켓 연결에 실패했습니다.");
      }
    }

    connect();

    // ── 브라우저 가시성 처리 ──
    function handleBeforeUnload() {
      socketRef.current?.emit("leave:space", { spaceId });
      disconnectSocket();
    }

    function handlePageHide() {
      // 모바일 Safari 대응
      socketRef.current?.emit("leave:space", { spaceId });
      disconnectSocket();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        console.log("[Socket] Page hidden — relying on server ping timeout");
      } else {
        console.log("[Socket] Page visible");
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
      const sock = socketRef.current;
      if (!sock || !sock.connected) {
        console.error("[Socket] sendChat failed: socket not connected", { hasSocket: !!sock, connected: sock?.connected });
        return;
      }
      sock.emit("chat:send", { content, type, targetId, replyTo });
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

  // Avatar emitter
  const sendAvatarUpdate = useCallback((avatar: string) => {
    socketRef.current?.emit("avatar:update", { avatar });
  }, []);

  // Media emitters
  const sendRecordingStart = useCallback(() => {
    socketRef.current?.emit("recording:start");
  }, []);

  const sendRecordingStop = useCallback(() => {
    socketRef.current?.emit("recording:stop");
  }, []);

  const sendSpotlightActivate = useCallback(() => {
    socketRef.current?.emit("spotlight:activate");
  }, []);

  const sendSpotlightDeactivate = useCallback(() => {
    socketRef.current?.emit("spotlight:deactivate");
  }, []);

  const sendProximitySet = useCallback((enabled: boolean) => {
    socketRef.current?.emit("proximity:set", { enabled });
  }, []);

  return {
    isConnected,
    socketError,
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
    sendAvatarUpdate,
    sendRecordingStart,
    sendRecordingStop,
    sendSpotlightActivate,
    sendSpotlightDeactivate,
    sendProximitySet,
  };
}
