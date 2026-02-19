"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import type { ReplyTo, ChatTab } from "@/features/space/chat";
import { MAX_CONTENT_LENGTH } from "@/features/space/chat";

interface ChatInputAreaProps {
  onSend: (content: string) => void;
  onFocusChange: (focused: boolean) => void;
  replyTo: ReplyTo | null;
  onCancelReply: () => void;
  currentPartyId?: string;
  currentPartyName?: string;
  placeholder?: string;
  activeTab?: ChatTab;
  /** 귓속말 히스토리 (닉네임 목록) */
  whisperHistory?: string[];
}

/** 탭별 입력 프롬프트 색상 */
const TAB_RING_COLOR: Record<string, string> = {
  all: "focus:ring-blue-500",
  whisper: "focus:ring-purple-500",
  party: "focus:ring-green-500",
  system: "focus:ring-yellow-500",
  links: "focus:ring-blue-500",
};

export function ChatInputArea({
  onSend,
  onFocusChange,
  replyTo,
  onCancelReply,
  currentPartyId,
  currentPartyName,
  placeholder = "메시지 입력...",
  activeTab = "all",
  whisperHistory = [],
}: ChatInputAreaProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [whisperIdx, setWhisperIdx] = useState(-1);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setInput("");
    setWhisperIdx(-1);
  }, [input, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }
      if (e.key === "Escape") {
        onCancelReply();
        inputRef.current?.blur();
        return;
      }

      // 귓속말 히스토리 탐색 (/ 시작 시 ↑↓)
      if (whisperHistory.length > 0 && input.startsWith("/")) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const nextIdx = Math.min(whisperIdx + 1, whisperHistory.length - 1);
          setWhisperIdx(nextIdx);
          setInput(`/${whisperHistory[nextIdx]} `);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const nextIdx = whisperIdx - 1;
          if (nextIdx < 0) {
            setWhisperIdx(-1);
            setInput("/");
          } else {
            setWhisperIdx(nextIdx);
            setInput(`/${whisperHistory[nextIdx]} `);
          }
          return;
        }
      }
    },
    [handleSend, onCancelReply, input, whisperHistory, whisperIdx]
  );

  const ringColor = TAB_RING_COLOR[activeTab] || TAB_RING_COLOR.all;

  /** 답장 미리보기 (30자 제한) */
  const replyPreview = replyTo
    ? replyTo.content.length > 30
      ? replyTo.content.slice(0, 30) + "..."
      : replyTo.content
    : null;

  return (
    <div className="border-t border-gray-700">
      {/* 답장 표시 */}
      {replyTo && (
        <div className="flex items-center justify-between px-2 py-1 bg-gray-700/50 text-xs text-gray-400">
          <span className="truncate">
            &#8617; {replyTo.senderNickname}: {replyPreview}
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
          onChange={(e) => {
            setInput(e.target.value);
            // / 시작이 아니면 히스토리 인덱스 리셋
            if (!e.target.value.startsWith("/")) {
              setWhisperIdx(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          placeholder={placeholder}
          maxLength={MAX_CONTENT_LENGTH}
          className={`flex-1 rounded bg-gray-700 px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 ${ringColor}`}
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
