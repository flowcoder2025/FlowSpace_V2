"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { ChatMessage } from "@/features/space/chat";
import { parseContentWithUrls } from "@/features/space/chat";
import type { ChatFontSize } from "@/features/space/chat";
import { FONT_SIZE_PX } from "@/features/space/chat";
import type { PlayerData } from "@/features/space/socket";

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  isAdmin: boolean;
  onReply: (msg: ChatMessage) => void;
  onReactionToggle: (messageId: string, type: "thumbsup" | "heart" | "check") => void;
  onDeleteMessage: (messageId: string) => void;
  /** SSOT 닉네임 해석용 플레이어 맵 */
  playersMap?: Map<string, PlayerData>;
  /** 폰트 크기 */
  fontSize?: ChatFontSize;
}

const REACTION_EMOJI: Record<string, string> = {
  thumbsup: "\uD83D\uDC4D",
  heart: "\u2764\uFE0F",
  check: "\u2705",
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `[${h}:${m}]`;
}

export function ChatMessageList({
  messages,
  currentUserId,
  isAdmin,
  onReply,
  onReactionToggle,
  onDeleteMessage,
  playersMap,
  fontSize = "medium",
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fontSizePx = FONT_SIZE_PX[fontSize];

  /** SSOT 닉네임 해석: playersMap에서 실시간 닉네임 가져오기 */
  const resolveNickname = useCallback(
    (userId: string, fallback: string): string => {
      if (!playersMap) return fallback;
      const player = playersMap.get(userId);
      return player?.nickname ?? fallback;
    },
    [playersMap]
  );

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // 스크롤 위치 감지
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  }, []);

  const getMessageClass = (msg: ChatMessage): string => {
    if (msg.isDeleted) return "text-white/30 italic py-0.5 line-through";
    if (msg.failed) return "text-red-400 py-0.5";
    switch (msg.type) {
      case "system":
        return "text-yellow-400/70 italic py-0.5";
      case "announcement":
        return "text-yellow-300 font-semibold py-1 px-1 bg-amber-500/10 rounded";
      case "whisper":
        return "text-purple-200 py-0.5 hover:bg-purple-500/10 rounded";
      case "party":
        return "text-blue-200 py-0.5 hover:bg-white/5 rounded";
      default:
        return "text-white/90 py-0.5 hover:bg-white/5 rounded";
    }
  };

  /** URL 포함 콘텐츠 렌더링 */
  const renderContent = (content: string) => {
    const parts = parseContentWithUrls(content);
    if (parts.length === 1 && parts[0].type === "text") {
      return <span>{content}</span>;
    }
    return (
      <>
        {parts.map((part, i) =>
          part.type === "url" ? (
            <a
              key={i}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              {part.value}
            </a>
          ) : (
            <span key={i}>{part.value}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto p-2 space-y-0.5 chat-scrollbar"
        style={{ fontSize: `${fontSizePx}px` }}
      >
        {messages.map((msg, idx) => {
          const displayNickname = msg.type === "system"
            ? msg.nickname
            : resolveNickname(msg.userId, msg.nickname);

          return (
            <div
              key={`${msg.id}-${idx}`}
              className={`group relative ${getMessageClass(msg)}`}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 시스템/공지 메시지 */}
              {(msg.type === "system" || msg.type === "announcement") ? (
                <span>
                  {msg.type === "announcement" && "[공지] "}
                  {msg.content}
                </span>
              ) : (
                <>
                  {/* 답장 인용 */}
                  {msg.replyTo && (
                    <div className="text-gray-500 border-l-2 border-gray-600 pl-1 mb-0.5 truncate" style={{ fontSize: `${fontSizePx - 2}px` }}>
                      {msg.replyTo.senderNickname}: {msg.replyTo.content}
                    </div>
                  )}

                  {/* 메시지 본문 */}
                  <span className="text-white/40 mr-1" style={{ fontSize: `${fontSizePx - 2}px` }}>{formatTime(msg.timestamp)}</span>
                  <span className={`font-semibold ${msg.userId === currentUserId ? "text-primary" : "text-emerald-400"}`}>{displayNickname}</span>
                  {msg.type === "whisper" && (
                    <span className="text-purple-400 ml-1" style={{ fontSize: `${fontSizePx - 2}px` }}>
                      {msg.targetNickname ? `\u2192 ${msg.targetNickname}` : "(귓속말)"}
                    </span>
                  )}
                  {msg.type === "party" && msg.partyName && (
                    <span className="text-green-400 ml-1" style={{ fontSize: `${fontSizePx - 2}px` }}>[{msg.partyName}]</span>
                  )}
                  <span className="ml-1">
                    {msg.isDeleted ? "(삭제된 메시지)" : renderContent(msg.content)}
                  </span>
                  {msg.failed && <span className="text-red-500 ml-1" style={{ fontSize: `${fontSizePx - 2}px` }}>(전송 실패)</span>}

                  {/* 리액션 표시 */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex gap-1 mt-0.5 pl-12">
                      {groupReactions(msg.reactions).map(([type, count]) => (
                        <button
                          key={type}
                          onClick={() => onReactionToggle(msg.id, type as "thumbsup" | "heart" | "check")}
                          className="inline-flex items-center gap-0.5 bg-white/10 hover:bg-white/20 rounded px-1 py-0.5"
                          style={{ fontSize: `${fontSizePx - 2}px` }}
                        >
                          <span>{REACTION_EMOJI[type]}</span>
                          <span className="text-white/60">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* 호버 액션 */}
              {hoveredId === msg.id && msg.type !== "system" && !msg.isDeleted && (
                <div className="absolute top-0 right-1 flex gap-0.5 bg-black/60 backdrop-blur-sm rounded shadow-lg p-0.5 drop-shadow-md">
                  <button
                    onClick={() => onReply(msg)}
                    className="text-[11px] text-white/60 hover:text-white hover:bg-white/20 rounded px-1"
                    title="답장"
                  >
                    &#8617;
                  </button>
                  {(["thumbsup", "heart", "check"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => onReactionToggle(msg.id, type)}
                      className="text-[11px] hover:bg-white/20 rounded px-1"
                      title={type}
                    >
                      {REACTION_EMOJI[type]}
                    </button>
                  ))}
                  {isAdmin && (
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className="text-[11px] text-red-400 hover:text-red-300 hover:bg-white/20 rounded px-1"
                      title="삭제"
                    >
                      &#x2715;
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 최신 메시지로 스크롤 버튼 */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white/80 text-[11px] rounded-full px-3 py-1.5 shadow-lg hover:bg-black/80 border border-white/10 animate-bounce"
        >
          &#x2193; 최신 메시지
        </button>
      )}
    </div>
  );
}

/** 리액션을 타입별 그룹핑 */
function groupReactions(
  reactions: Array<{ type: string; userId: string; userNickname: string }>
): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const r of reactions) {
    map.set(r.type, (map.get(r.type) || 0) + 1);
  }
  return Array.from(map.entries());
}
