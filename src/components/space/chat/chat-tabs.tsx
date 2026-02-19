"use client";

import { useMemo } from "react";
import type { ChatMessage, ChatTab } from "@/features/space/chat";
import type { ChatFontSize } from "@/features/space/chat";
import { CHAT_FONT_SIZE_ORDER } from "@/features/space/chat";

interface ChatTabsProps {
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  messages: ChatMessage[];
  currentUserId: string;
  currentPartyId?: string;
  fontSize?: ChatFontSize;
  onFontSizeChange?: (size: ChatFontSize) => void;
}

const TAB_CONFIG: Array<{ key: ChatTab; label: string; emoji?: string }> = [
  { key: "all", label: "All" },
  { key: "party", label: "Party", emoji: "\uD83C\uDFE0" },
  { key: "whisper", label: "Whisper" },
  { key: "system", label: "System" },
  { key: "links", label: "Links" },
];

export function ChatTabs({
  activeTab,
  onTabChange,
  messages,
  currentUserId,
  currentPartyId,
  fontSize = "medium",
  onFontSizeChange,
}: ChatTabsProps) {
  // 탭별 미확인 메시지 수 (최근 메시지 기반)
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const recentMessages = messages.slice(-20);
    for (const tab of ["party", "whisper", "system"] as const) {
      counts[tab] = recentMessages.filter((m) => {
        if (m.userId === currentUserId) return false;
        switch (tab) {
          case "party":
            return m.type === "party";
          case "whisper":
            return m.type === "whisper";
          case "system":
            return m.type === "system" || m.type === "announcement";
          default:
            return false;
        }
      }).length;
    }
    return counts;
  }, [messages, currentUserId]);

  /** 폰트 크기 순환 */
  const cycleFontSize = (direction: "up" | "down") => {
    if (!onFontSizeChange) return;
    const idx = CHAT_FONT_SIZE_ORDER.indexOf(fontSize);
    if (direction === "up" && idx < CHAT_FONT_SIZE_ORDER.length - 1) {
      onFontSizeChange(CHAT_FONT_SIZE_ORDER[idx + 1]);
    } else if (direction === "down" && idx > 0) {
      onFontSizeChange(CHAT_FONT_SIZE_ORDER[idx - 1]);
    }
  };

  return (
    <div className="flex items-center border-b border-gray-700 px-1 overflow-x-auto">
      <div className="flex flex-1">
        {TAB_CONFIG.map(({ key, label, emoji }) => {
          // 파티탭은 파티존에 있을 때만 표시
          if (key === "party" && !currentPartyId) return null;

          const unread = key !== "all" ? (unreadCounts[key] || 0) : 0;
          const isActive = activeTab === key;

          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`relative px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {emoji && <span className="mr-0.5">{emoji}</span>}
              {label}
              {unread > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 폰트 크기 조절 */}
      {onFontSizeChange && (
        <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
          <button
            onClick={() => cycleFontSize("down")}
            disabled={fontSize === "small"}
            className="text-[10px] text-gray-400 hover:text-white disabled:text-gray-600 px-1"
            title="글자 작게"
          >
            A-
          </button>
          <button
            onClick={() => cycleFontSize("up")}
            disabled={fontSize === "large"}
            className="text-xs text-gray-400 hover:text-white disabled:text-gray-600 px-1"
            title="글자 크게"
          >
            A+
          </button>
        </div>
      )}
    </div>
  );
}
