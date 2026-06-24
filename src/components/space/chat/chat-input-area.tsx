"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
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
  whisperHistory?: string[];
  /** 마운트 시 자동 포커스 */
  autoFocus?: boolean;
  /** Escape 키 콜백 */
  onEscape?: () => void;
  /**
   * 외부(참가자 패널 귓속말, WI-040)에서 입력창을 prefill할 때 사용. `token`이 바뀔 때마다
   * `value`를 입력에 적용하고 포커스한다(동일 닉네임 재클릭·이미 열린 상태도 재적용). 조건부
   * 마운트(ChatPanel `isActive`)라 fresh 마운트 시엔 첫 effect에서, 이미 마운트면 token 변경으로 적용.
   */
  prefill?: { value: string; token: number } | null;
}


export function ChatInputArea({
  onSend,
  onFocusChange,
  replyTo,
  onCancelReply,
  currentPartyId,
  currentPartyName,
  placeholder = "메시지 입력...",
  whisperHistory = [],
  autoFocus = false,
  onEscape,
  prefill,
}: ChatInputAreaProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [whisperIdx, setWhisperIdx] = useState(-1);

  // autoFocus: 마운트 시 입력창 포커스
  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // WI-040: 외부 귓속말 prefill — 입력창에 `/닉네임 `을 채우고 caret을 끝에 두고 포커스.
  // prefill 객체는 ChatPanel state(이벤트마다 새 ref·token++)라 unrelated 리렌더엔 재실행 안 됨.
  // setState/focus를 rAF로 미뤄 effect 본문 동기 setState(set-state-in-effect 린트)를 피하고,
  // 조건부 마운트 직후 ref 안정화 뒤 caret을 끝에 둔다(unmount/연속 prefill 시 cleanup이 취소).
  useEffect(() => {
    if (!prefill) return;
    const raf = requestAnimationFrame(() => {
      setInput(prefill.value);
      setWhisperIdx(-1);
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prefill.value.length, prefill.value.length);
    });
    return () => cancelAnimationFrame(raf);
  }, [prefill]);


  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      // 빈 입력 + Enter → 비활성화
      onEscape?.();
      return;
    }
    onSend(trimmed);
    setInput("");
    setWhisperIdx(-1);
    // 전송 후 비활성화 (레거시 패턴)
    onEscape?.();
  }, [input, onSend, onEscape]);

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
        onEscape?.();
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
    [handleSend, onCancelReply, onEscape, input, whisperHistory, whisperIdx]
  );

  /** 답장 미리보기 (30자 제한) */
  const replyPreview = replyTo
    ? replyTo.content.length > 30
      ? replyTo.content.slice(0, 30) + "..."
      : replyTo.content
    : null;

  return (
    <div className="border-t border-white/5">
      {/* 답장 표시 */}
      {replyTo && (
        <div className="flex items-center justify-between px-2 py-1 bg-primary/10 border-l-2 border-primary/60 text-[11px] text-primary">
          <span className="truncate">
            &#8617; {replyTo.senderNickname}: {replyPreview}
          </span>
          <button
            onClick={onCancelReply}
            className="ml-1 text-white/40 hover:text-white/80 flex-shrink-0"
          >
            &#x2715;
          </button>
        </div>
      )}

      {/* 파티 모드 표시 */}
      {currentPartyId && (
        <div className="px-2 py-0.5 bg-blue-500/10 text-[10px] text-blue-400">
          &#x1F3E0; {currentPartyName || "Party"} 채팅 중
        </div>
      )}

      {/* 입력 영역 */}
      <div className="px-2 py-1.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (!e.target.value.startsWith("/")) {
              setWhisperIdx(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          placeholder={placeholder}
          maxLength={MAX_CONTENT_LENGTH}
          className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-white/40"
        />
      </div>
    </div>
  );
}
