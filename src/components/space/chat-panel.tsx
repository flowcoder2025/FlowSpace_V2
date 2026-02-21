"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatTab, ReplyTo } from "@/features/space/chat";
import { filterMessagesByTab } from "@/features/space/chat";
import type { ChatFontSize } from "@/features/space/chat";
import { FONT_SIZE_STORAGE_KEY, CHAT_FONT_SIZE_ORDER } from "@/features/space/chat";
import type { PlayerData } from "@/features/space/socket";
import { useChatDrag } from "@/features/space/hooks";
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
  players?: PlayerData[];
  socketError?: string | null;
}

const REACTIVATION_COOLDOWN = 150;

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
  const [isActive, setIsActive] = useState(false);
  const lastDeactivateRef = useRef(0);
  const { position, size, isDragging, isResizing, handleMoveStart, handleResizeStart } = useChatDrag();

  const [fontSize, setFontSizeState] = useState<ChatFontSize>(() => {
    try {
      if (typeof window === "undefined") return "medium";
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (saved && CHAT_FONT_SIZE_ORDER.includes(saved as ChatFontSize)) {
        return saved as ChatFontSize;
      }
    } catch { /* ignore */ }
    return "medium";
  });

  const setFontSize = useCallback((size: ChatFontSize) => {
    setFontSizeState(size);
    try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, size); } catch { /* ignore */ }
  }, []);

  const activate = useCallback(() => {
    if (Date.now() - lastDeactivateRef.current < REACTIVATION_COOLDOWN) return;
    setIsActive(true);
    onFocusChange(true);
  }, [onFocusChange]);

  const deactivate = useCallback(() => {
    lastDeactivateRef.current = Date.now();
    setIsActive(false);
    onFocusChange(false);
  }, [onFocusChange]);

  // isActive를 ref로 추적 (stale closure 방지)
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // 전역 Enter 키로 채팅 활성화 (비활성화는 input 내부에서 처리)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "Enter" && !isActiveRef.current) {
        e.preventDefault();
        e.stopPropagation();
        activate();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true });
  }, [activate]);

  const filteredMessages = useMemo(
    () => filterMessagesByTab(messages, activeTab, currentUserId),
    [messages, activeTab, currentUserId]
  );

  const isAdmin = role === "OWNER" || role === "STAFF";

  const playersMap = useMemo(() => {
    if (!players) return undefined;
    const map = new Map<string, PlayerData>();
    for (const p of players) map.set(p.userId, p);
    return map;
  }, [players]);

  const whisperHistory = useMemo(() => {
    const targets: string[] = [];
    const seen = new Set<string>();
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

  // 헤더(28) + 탭(28, 활성시만) + 입력(36, 활성시만) + 여유
  const tabsHeight = isActive ? 28 : 0;
  const inputHeight = isActive ? 36 : 0;
  const messageAreaHeight = size.height - 28 - tabsHeight - inputHeight;

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 50,
        willChange: isDragging || isResizing ? "transform, width, height" : "auto",
      }}
    >
      <div className="flex flex-col rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 overflow-hidden h-full">
        {/* 드래그 가능한 헤더 */}
        <div
          onMouseDown={handleMoveStart}
          className={cn(
            "h-7 flex items-center justify-between px-3 shrink-0 select-none bg-black/40 border-b border-white/5",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <span className="text-[11px] text-white/70 font-medium">채팅</span>
          <span className="text-[10px] text-white/40">
            {isActive ? "Esc로 닫기" : "Enter로 입력"}
          </span>
        </div>

        {/* 소켓 에러 배너 */}
        {socketError && (
          <div className="px-3 py-1 bg-red-900/60 text-[10px] text-red-200 shrink-0">
            {socketError}
          </div>
        )}

        {/* Tabs (활성화 시만) */}
        {isActive && (
          <ChatTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            messages={messages}
            currentUserId={currentUserId}
            currentPartyId={currentPartyId}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
          />
        )}

        {/* Messages */}
        <div
          className="flex-1 flex flex-col justify-end min-h-0 overflow-hidden"
          style={{ height: Math.max(messageAreaHeight, 60) }}
        >
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
        </div>

        {/* Input (활성화 시만) */}
        {isActive && (
          <ChatInputArea
            onSend={onSend}
            onFocusChange={onFocusChange}
            replyTo={replyTo}
            onCancelReply={() => onReply(null)}
            currentPartyId={currentPartyId}
            currentPartyName={currentPartyName}
            activeTab={activeTab}
            whisperHistory={whisperHistory}
            autoFocus
            onEscape={deactivate}
            placeholder={
              currentPartyId
                ? `파티 메시지 (${currentPartyName || "Party"})...`
                : "메시지 입력... (/닉네임 = 귓속말)"
            }
          />
        )}

        {/* 리사이즈 핸들 */}
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize rounded-br-lg",
            isResizing && "bg-white/20"
          )}
          style={{
            background: isResizing
              ? "rgba(255,255,255,0.2)"
              : "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.15) 50%)",
          }}
          title="크기 조절"
        />
      </div>
    </div>
  );
}
