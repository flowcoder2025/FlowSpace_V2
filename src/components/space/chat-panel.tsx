"use client";

import { useState, useMemo } from "react";
import type { ChatMessage, ChatTab, ReplyTo } from "@/features/space/chat";
import { filterMessagesByTab } from "@/features/space/chat/internal/chat-filter";
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
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  const filteredMessages = useMemo(
    () => filterMessagesByTab(messages, activeTab, currentUserId),
    [messages, activeTab, currentUserId]
  );

  const isAdmin = role === "OWNER" || role === "STAFF";

  return (
    <div className="absolute bottom-4 left-4 z-40 w-96">
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
          />

          {/* Input */}
          <ChatInputArea
            onSend={onSend}
            onFocusChange={onFocusChange}
            replyTo={replyTo}
            onCancelReply={() => onReply(null)}
            currentPartyId={currentPartyId}
            currentPartyName={currentPartyName}
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
