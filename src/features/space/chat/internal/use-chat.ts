"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { eventBridge, GameEvents } from "@/features/space/game";
import type { ChatMessage, ChatTab, ReplyTo } from "./chat-types";
import { parseInput } from "./chat-parser";
import { useChatStorage } from "./use-chat-storage";

const MAX_MESSAGES = 200;

interface UseChatOptions {
  /** socket sendChat 함수 */
  sendChat: (content: string, type: "group" | "whisper" | "party", targetId?: string) => void;
  /** socket whisper:send */
  sendWhisper?: (targetNickname: string, content: string) => void;
  /** socket reaction:toggle */
  sendReactionToggle?: (messageId: string, reactionType: "thumbsup" | "heart" | "check") => void;
  /** socket admin commands */
  sendAdminCommand?: (command: string, data: Record<string, unknown>) => void;
  /** 공간 ID (localStorage 캐싱에 사용) */
  spaceId: string;
  /** 현재 유저 ID */
  userId: string;
  /** 현재 유저 닉네임 */
  nickname: string;
  /** 현재 유저 role */
  role?: "OWNER" | "STAFF" | "PARTICIPANT";
  /** 현재 파티 ID */
  currentPartyId?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  activeTab: ChatTab;
  setActiveTab: (tab: ChatTab) => void;
  sendMessage: (content: string) => void;
  chatFocused: boolean;
  setChatFocused: (focused: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  replyTo: ReplyTo | null;
  setReplyTo: (reply: ReplyTo | null) => void;
  toggleReaction: (messageId: string, reactionType: "thumbsup" | "heart" | "check") => void;
  deleteMessage: (messageId: string) => void;
  clearCache: () => void;
}

let messageIdCounter = 0;

export function useChat({
  sendChat,
  sendWhisper,
  sendReactionToggle,
  sendAdminCommand,
  spaceId,
  userId,
  nickname,
  role,
  currentPartyId,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatFocused, setChatFocusedState] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>("all");
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

  // tempId → realId 매핑
  const tempIdMapRef = useRef(new Map<string, string>());

  // localStorage 캐싱
  const { loadCachedMessages, clearCache } = useChatStorage({ spaceId, messages });

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      // 중복 방지 (tempId 매핑)
      if (msg.tempId) {
        const exists = prev.find((m) => m.tempId === msg.tempId);
        if (exists) return prev;
      }

      const next = [...prev, msg];
      if (next.length > MAX_MESSAGES) {
        return next.slice(next.length - MAX_MESSAGES);
      }
      return next;
    });
  }, []);

  /** tempId → realId 업데이트 */
  const handleMessageIdUpdate = useCallback((tempId: string, realId: string) => {
    tempIdMapRef.current.set(tempId, realId);
    setMessages((prev) =>
      prev.map((m) => (m.tempId === tempId ? { ...m, id: realId } : m))
    );
  }, []);

  /** 메시지 전송 실패 처리 */
  const handleMessageFailed = useCallback((tempId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.tempId === tempId ? { ...m, failed: true } : m))
    );
  }, []);

  /** 메시지 삭제 처리 */
  const handleMessageDeleted = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
    );
  }, []);

  /** 리액션 업데이트 처리 */
  const handleReactionUpdated = useCallback(
    (
      messageId: string,
      reactions: Array<{ type: "thumbsup" | "heart" | "check"; userId: string; userNickname: string }>
    ) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId || m.tempId === messageId ? { ...m, reactions } : m))
      );
    },
    []
  );

  /** 통합 메시지 전송 (파싱 포함) */
  const sendMessage = useCallback(
    (rawContent: string) => {
      const sanitized = DOMPurify.sanitize(rawContent, { ALLOWED_TAGS: [] }).trim();
      if (sanitized.length === 0) return;

      const isAdmin = role === "OWNER" || role === "STAFF";
      const parsed = parseInput(sanitized, { isAdmin });

      switch (parsed.type) {
        case "admin": {
          if (!sendAdminCommand || !parsed.adminCommand) break;
          if (parsed.adminCommand === "announce") {
            sendAdminCommand("admin:announce", { content: parsed.content });
          } else if (parsed.targetNickname) {
            sendAdminCommand(`admin:${parsed.adminCommand}`, {
              targetNickname: parsed.targetNickname,
            });
          }
          break;
        }

        case "whisper": {
          if (sendWhisper && parsed.targetNickname) {
            const tempId = `whisper-${Date.now()}-${userId}`;
            // 낙관적 추가
            addMessage({
              id: tempId,
              tempId,
              userId,
              nickname,
              content: parsed.content,
              type: "whisper",
              targetNickname: parsed.targetNickname,
              timestamp: new Date().toISOString(),
            });
            sendWhisper(parsed.targetNickname, parsed.content);
          }
          break;
        }

        default: {
          const socketType = currentPartyId ? ("party" as const) : ("group" as const);

          // 서버에서 broadcast → addMessage에서 중복 방지
          sendChat(sanitized, socketType);

          // replyTo 리셋
          if (replyTo) {
            setReplyTo(null);
          }
          break;
        }
      }
    },
    [sendChat, sendWhisper, sendAdminCommand, userId, nickname, role, currentPartyId, addMessage, replyTo]
  );

  /** 리액션 토글 */
  const toggleReaction = useCallback(
    (messageId: string, reactionType: "thumbsup" | "heart" | "check") => {
      if (sendReactionToggle) {
        sendReactionToggle(messageId, reactionType);
      }

      // 낙관적 업데이트
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId && m.tempId !== messageId) return m;
          const reactions = [...(m.reactions || [])];
          const idx = reactions.findIndex((r) => r.userId === userId && r.type === reactionType);
          if (idx >= 0) {
            reactions.splice(idx, 1);
          } else {
            reactions.push({ type: reactionType, userId, userNickname: nickname });
          }
          return { ...m, reactions };
        })
      );
    },
    [sendReactionToggle, userId, nickname]
  );

  /** 메시지 삭제 요청 */
  const deleteMessage = useCallback(
    (messageId: string) => {
      if (sendAdminCommand) {
        sendAdminCommand("chat:delete", { messageId });
      }
    },
    [sendAdminCommand]
  );

  const setChatFocused = useCallback((focused: boolean) => {
    setChatFocusedState(focused);
    eventBridge.emit(GameEvents.CHAT_FOCUS, { focused });
  }, []);

  // 마운트 시 캐시 로드 + 시스템 메시지
  useEffect(() => {
    const cached = loadCachedMessages();
    if (cached.length > 0) {
      setMessages(cached);
    }

    const systemMsg: ChatMessage = {
      id: `sys-${++messageIdCounter}`,
      userId: "system",
      nickname: "System",
      content: "채팅에 연결되었습니다.",
      type: "system",
      timestamp: new Date().toISOString(),
    };
    addMessage(systemMsg);
  }, [addMessage, loadCachedMessages]);

  return {
    messages,
    activeTab,
    setActiveTab,
    sendMessage,
    chatFocused,
    setChatFocused,
    addMessage,
    replyTo,
    setReplyTo,
    toggleReaction,
    deleteMessage,
    clearCache,
    // 내부 핸들러 노출 (socket bridge에서 호출)
    _handleMessageIdUpdate: handleMessageIdUpdate,
    _handleMessageFailed: handleMessageFailed,
    _handleMessageDeleted: handleMessageDeleted,
    _handleReactionUpdated: handleReactionUpdated,
  } as UseChatReturn & {
    _handleMessageIdUpdate: typeof handleMessageIdUpdate;
    _handleMessageFailed: typeof handleMessageFailed;
    _handleMessageDeleted: typeof handleMessageDeleted;
    _handleReactionUpdated: typeof handleReactionUpdated;
  };
}
