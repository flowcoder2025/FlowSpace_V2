"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import type { ChatMessage } from "@/features/space/chat";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  onFocusChange: (focused: boolean) => void;
}

export default function ChatPanel({ messages, onSend, onFocusChange }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    },
    [handleSend]
  );

  const handleFocus = useCallback(() => {
    onFocusChange(true);
  }, [onFocusChange]);

  const handleBlur = useCallback(() => {
    onFocusChange(false);
  }, [onFocusChange]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="absolute bottom-4 left-4 z-40 w-80">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-1 rounded bg-gray-800/80 px-3 py-1.5 text-sm text-white hover:bg-gray-700/80"
      >
        Chat {!isOpen && messages.length > 0 && `(${messages.length})`}
      </button>

      {isOpen && (
        <div className="flex flex-col rounded bg-gray-800/90 overflow-hidden">
          {/* Messages area */}
          <div className="h-60 overflow-y-auto p-2 space-y-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.type === "system"
                    ? "text-xs text-gray-500 italic py-0.5"
                    : msg.type === "whisper"
                      ? "text-sm text-purple-300 py-0.5"
                      : "text-sm text-white py-0.5"
                }
              >
                {msg.type === "system" ? (
                  <span>{msg.content}</span>
                ) : (
                  <>
                    <span className="text-xs text-gray-500 mr-1">
                      {formatTime(msg.timestamp)}
                    </span>
                    <span className="font-semibold text-blue-300">{msg.nickname}</span>
                    {msg.type === "whisper" && (
                      <span className="text-xs text-purple-400 ml-1">(귓속말)</span>
                    )}
                    <span className="ml-1">{msg.content}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex border-t border-gray-700 p-2 gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="메시지 입력..."
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
      )}
    </div>
  );
}
