"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { eventBridge, GameEvents } from "@/features/space/game";
import type { ChatMessage, ChatType } from "./chat-types";

const MAX_MESSAGES = 200;

interface UseChatOptions {
  /** socket sendChat 함수 */
  sendChat: (content: string, type: "group" | "whisper" | "party", targetId?: string) => void;
  /** 현재 유저 ID */
  userId: string;
  /** 현재 유저 닉네임 */
  nickname: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string, type?: ChatType, targetId?: string) => void;
  chatFocused: boolean;
  setChatFocused: (focused: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
}

let messageIdCounter = 0;

export function useChat({ sendChat }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatFocused, setChatFocusedState] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      if (next.length > MAX_MESSAGES) {
        return next.slice(next.length - MAX_MESSAGES);
      }
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    (content: string, type: ChatType = "group", targetId?: string) => {
      const sanitized = DOMPurify.sanitize(content, { ALLOWED_TAGS: [] }).trim();
      if (sanitized.length === 0) return;

      // system 타입은 전송하지 않음
      if (type === "system") return;

      sendChat(sanitized, type, targetId);
    },
    [sendChat]
  );

  const setChatFocused = useCallback((focused: boolean) => {
    setChatFocusedState(focused);
    eventBridge.emit(GameEvents.CHAT_FOCUS, { focused });
  }, []);

  // 시스템 메시지 헬퍼 (입장/퇴장 등)
  useEffect(() => {
    // 마운트 시 시스템 메시지 추가
    const systemMsg: ChatMessage = {
      id: `sys-${++messageIdCounter}`,
      userId: "system",
      nickname: "System",
      content: "채팅에 연결되었습니다.",
      type: "system",
      timestamp: new Date().toISOString(),
    };
    addMessage(systemMsg);
  }, [addMessage]);

  return {
    messages,
    sendMessage,
    chatFocused,
    setChatFocused,
    addMessage,
  };
}
