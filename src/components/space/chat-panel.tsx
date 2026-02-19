"use client";

import { useState, useMemo, useCallback } from "react";
import type { ChatMessage, ChatTab, ReplyTo } from "@/features/space/chat";
import { filterMessagesByTab } from "@/features/space/chat";
import type { ChatFontSize } from "@/features/space/chat";
import { FONT_SIZE_STORAGE_KEY, CHAT_FONT_SIZE_ORDER } from "@/features/space/chat";
import type { PlayerData } from "@/features/space/socket";
import { ChatTabs } from "./chat/chat-tabs";
import { ChatMessageList } from "./chat/chat-message-list";
import { ChatInputArea } from "./chat/chat-input-area";

interface ChatPanelProps {
  messages: ChatMessage[];
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  onSend: (content: string) => void;
  onFocusChange: (focused: boolean) => void;
  onReply: (reply: ReplyTo | null) => void;
  onReactionToggle: (messageId: string, type: "thumbsup" | "heart" | "check") => void;
  onDeleteMessage: (messageId: string) => void;
  replyTo: ReplyTo | null;
  currentUserId: string;
  role?: "OWNER" | "STAFF" | "PARTICIPANT";
  currentPartyId?: string;
  currentPartyName?: string;
  /** SSOT 닉네임 해석용 플레이어 목록 */
  players?: PlayerData[];
  /** 소켓 에러 메시지 */
  socketError?: string | null;
}

export default function ChatPanel({
  messages,
  activeTab,
  onTabChange,
  onSend,
  onFocusChange,
  onReply,
  onReactionToggle,
  onDeleteMessage,
  replyTo,
  currentUserId,
  role,
  currentPartyId,
  currentPartyName,
  players,
  socketError,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  // 폰트 크기 (localStorage 연동, lazy init)
  const [fontSize, setFontSizeState] = useState<ChatFontSize>(() => {
    try {
      if (typeof window === "undefined") return "medium";
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (saved && CHAT_FONT_SIZE_ORDER.includes(saved as ChatFontSize)) {
        return saved as ChatFontSize;
      }
    } catch {
      // ignore
    }
    return "medium";
  });

  const setFontSize = useCallback((size: ChatFontSize) => {
    setFontSizeState(size);
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    } catch {
      // ignore
    }
  }, []);

  const filteredMessages = useMemo(
    () => filterMessagesByTab(messages, activeTab, currentUserId),
    [messages, activeTab, currentUserId]
  );

  const isAdmin = role === "OWNER" || role === "STAFF";

  // playersMap 생성 (SSOT)
  const playersMap = useMemo(() => {
    if (!players) return undefined;
    const map = new Map<string, PlayerData>();
    for (const p of players) {
      map.set(p.userId, p);
    }
    return map;
  }, [players]);

  // 귓속말 히스토리 (메시지에서 추출, 최근 우선, 중복 제거)
  const whisperHistory = useMemo(() => {
    const targets: string[] = [];
    const seen = new Set<string>();
    // 역순으로 탐색하여 최근 귓속말 대상 우선
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type !== "whisper") continue;
      if (m.userId === currentUserId && m.targetNickname) {
        if (!seen.has(m.targetNickname)) {
          seen.add(m.targetNickname);
          targets.push(m.targetNickname);
        }
      }
    }
    return targets;
  }, [messages, currentUserId]);

  return (
    <div className="absolute bottom-4 left-4 z-40 w-96">
      {/* 소켓 에러 배너 */}
      {socketError && (
        <div className="mb-1 rounded bg-red-900/80 px-3 py-1.5 text-xs text-red-200">
          {socketError}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-1 rounded bg-gray-800/80 px-3 py-1.5 text-sm text-white hover:bg-gray-700/80"
      >
        Chat {!isOpen && messages.length > 0 && `(${messages.length})`}
      </button>

      {isOpen && (
        <div className="flex flex-col rounded bg-gray-800/90 overflow-hidden">
          {/* Tabs */}
          <ChatTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            messages={messages}
            currentUserId={currentUserId}
            currentPartyId={currentPartyId}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
          />

          {/* Messages */}
          <ChatMessageList
            messages={filteredMessages}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onReply={(msg) =>
              onReply({ id: msg.id, senderNickname: msg.nickname, content: msg.content })
            }
            onReactionToggle={onReactionToggle}
            onDeleteMessage={onDeleteMessage}
            playersMap={playersMap}
            fontSize={fontSize}
          />

          {/* Input */}
          <ChatInputArea
            onSend={onSend}
            onFocusChange={onFocusChange}
            replyTo={replyTo}
            onCancelReply={() => onReply(null)}
            currentPartyId={currentPartyId}
            currentPartyName={currentPartyName}
            activeTab={activeTab}
            whisperHistory={whisperHistory}
            placeholder={
              currentPartyId
                ? `파티 메시지 (${currentPartyName || "Party"})...`
                : "메시지 입력... (/닉네임 = 귓속말)"
            }
          />
        </div>
      )}
    </div>
  );
}
