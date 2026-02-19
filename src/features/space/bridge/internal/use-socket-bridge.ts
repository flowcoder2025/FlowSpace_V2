/**
 * Socket <-> EventBridge 양방향 브릿지
 *
 * Socket 이벤트 -> EventBridge (REMOTE_*)
 * EventBridge (PLAYER_MOVED) -> Socket emit
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { eventBridge, GameEvents, type PlayerPosition } from "@/features/space/game";
import { useSocket, type PlayerData } from "@/features/space/socket";

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

interface UseSocketBridgeOptions {
  spaceId: string;
  userId: string;
  nickname: string;
  avatar: string;
  onChatMessage?: (data: ChatMessageData) => void;
  onWhisperReceive?: (data: { senderId: string; senderNickname: string; content: string; timestamp: string }) => void;
  onWhisperSent?: (data: { targetNickname: string; content: string; timestamp: string }) => void;
  onMessageIdUpdate?: (data: { tempId: string; realId: string }) => void;
  onMessageFailed?: (data: { tempId: string; error: string }) => void;
  onMessageDeleted?: (data: { messageId: string; deletedBy: string }) => void;
  onReactionUpdated?: (data: { messageId: string; reactions: Array<{ type: "thumbsup" | "heart" | "check"; userId: string; userNickname: string }> }) => void;
  onPartyMessage?: (data: ChatMessageData) => void;
  onMemberMuted?: (data: { memberId: string; nickname: string; mutedBy: string }) => void;
  onMemberUnmuted?: (data: { memberId: string; nickname: string; unmutedBy: string }) => void;
  onMemberKicked?: (data: { memberId: string; nickname: string; kickedBy: string }) => void;
  onAnnouncement?: (data: { content: string; announcer: string; timestamp: string }) => void;
  onEditorTileUpdated?: (data: { userId: string; layer: string; col: number; row: number; tileIndex: number }) => void;
  onEditorObjectPlaced?: (data: { userId: string; id: string; objectType: string; positionX: number; positionY: number; label?: string }) => void;
  onEditorObjectMoved?: (data: { userId: string; id: string; positionX: number; positionY: number }) => void;
  onEditorObjectDeleted?: (data: { userId: string; id: string }) => void;
}

interface UseSocketBridgeReturn {
  isConnected: boolean;
  socketError: string | null;
  players: PlayerData[];
  sendChat: (content: string, type: "group" | "whisper" | "party", targetId?: string) => void;
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

export function useSocketBridge(options: UseSocketBridgeOptions): UseSocketBridgeReturn {
  const {
    spaceId, userId, nickname, avatar,
    onChatMessage, onWhisperReceive, onWhisperSent,
    onMessageIdUpdate, onMessageFailed, onMessageDeleted,
    onReactionUpdated, onPartyMessage,
    onMemberMuted, onMemberUnmuted, onMemberKicked, onAnnouncement,
    onEditorTileUpdated, onEditorObjectPlaced, onEditorObjectMoved, onEditorObjectDeleted,
  } = options;

  const {
    isConnected, socketError, players, sendMovement, sendChat,
    sendWhisper, sendReactionToggle, sendAdminCommand,
    joinParty, leaveParty, sendPartyMessage,
    sendEditorTileUpdate, sendEditorObjectPlace,
    sendEditorObjectMove, sendEditorObjectDelete,
  } = useSocket({
    spaceId, userId, nickname, avatar,
    onChatMessage, onWhisperReceive, onWhisperSent,
    onMessageIdUpdate, onMessageFailed, onMessageDeleted,
    onReactionUpdated, onPartyMessage,
    onMemberMuted, onMemberUnmuted, onMemberKicked, onAnnouncement,
    onEditorTileUpdated, onEditorObjectPlaced, onEditorObjectMoved, onEditorObjectDeleted,
  });

  const prevPlayersRef = useRef<Map<string, PlayerData>>(new Map());

  // EventBridge -> Socket: PLAYER_MOVED -> sock.emit("move")
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

  // Socket -> EventBridge: players 변경 감지 -> REMOTE_* 이벤트 발행
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

  return {
    isConnected, socketError, players, sendChat,
    sendWhisper, sendReactionToggle, sendAdminCommand,
    joinParty, leaveParty, sendPartyMessage,
    sendEditorTileUpdate, sendEditorObjectPlace,
    sendEditorObjectMove, sendEditorObjectDelete,
  };
}
