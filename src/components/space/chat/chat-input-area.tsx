"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import type { ReplyTo } from "@/features/space/chat";

interface ChatInputAreaProps {
  onSend: (content: string) => void;
  onFocusChange: (focused: boolean) => void;
  replyTo: ReplyTo | null;
  onCancelReply: () => void;
  currentPartyId?: string;
  currentPartyName?: string;
  placeholder?: string;
}

export function ChatInputArea({
  onSend,
  onFocusChange,
  replyTo,
  onCancelReply,
  currentPartyId,
  currentPartyName,
  placeholder = "메시지 입력...",
}: ChatInputAreaProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setInput("");
  }, [input, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        onCancelReply();
        inputRef.current?.blur();
      }
    },
    [handleSend, onCancelReply]
  );

  return (
    <div className="border-t border-gray-700">
      {/* 답장 표시 */}
      {replyTo && (
        <div className="flex items-center justify-between px-2 py-1 bg-gray-700/50 text-xs text-gray-400">
          <span className="truncate">
            &#8617; {replyTo.senderNickname}: {replyTo.content}
          </span>
          <button
            onClick={onCancelReply}
            className="ml-1 text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            &#x2715;
          </button>
        </div>
      )}

      {/* 파티 모드 표시 */}
      {currentPartyId && (
        <div className="px-2 py-0.5 bg-green-900/30 text-xs text-green-400">
          &#x1F3E0; {currentPartyName || "Party"} 채팅 중
        </div>
      )}

      {/* 입력 영역 */}
      <div className="flex p-2 gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          placeholder={placeholder}
          maxLength={500}
          className="flex-1 rounded bg-gray-700 px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500"
        >
          전송
        </button>
      </div>
    </div>
  );
}
