import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import type { ChatTab } from "@/features/space/chat";

// ============================================================
// WI-040: 귓속말 prefill 생명주기 — stale prefill 재등장 방지(codex P2).
// ChatPanel(항상 마운트)이 CHAT_START_WHISPER 구독 → activate + prefill. ChatInputArea는
// isActive일 때만 마운트되므로, 닫은 뒤 일반 Enter 재활성화 시 과거 prefill이 재적용되면 안 된다.
// ============================================================

const { bus } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>();
  return {
    bus: {
      on: (e: string, cb: (...a: unknown[]) => void) => {
        if (!handlers.has(e)) handlers.set(e, new Set());
        handlers.get(e)!.add(cb);
      },
      off: (e: string, cb: (...a: unknown[]) => void) => handlers.get(e)?.delete(cb),
      emit: (e: string, ...args: unknown[]) =>
        handlers.get(e)?.forEach((cb) => cb(...args)),
    },
  };
});

vi.mock("@/features/space/game", () => ({
  eventBridge: bus,
  GameEvents: { CHAT_START_WHISPER: "chat:startWhisper" },
}));

import ChatPanel from "./chat-panel";

const baseProps = {
  messages: [],
  activeTab: "all" as ChatTab,
  onTabChange: vi.fn(),
  onSend: vi.fn(),
  onFocusChange: vi.fn(),
  onReply: vi.fn(),
  onReactionToggle: vi.fn(),
  onDeleteMessage: vi.fn(),
  replyTo: null,
  currentUserId: "me",
};

function getInput(): HTMLInputElement | null {
  return screen.queryByRole("textbox") as HTMLInputElement | null;
}

// jsdom은 scrollIntoView 미구현 — ChatMessageList의 자동 스크롤 effect용 stub.
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("ChatPanel — WI-040 귓속말 prefill 생명주기", () => {
  it("CHAT_START_WHISPER → 채팅 활성화 + 입력창 `/닉네임 ` prefill", async () => {
    render(<ChatPanel {...baseProps} />);
    act(() => bus.emit("chat:startWhisper", { nickname: "Alice" }));
    await waitFor(() => {
      const input = getInput();
      expect(input).not.toBeNull();
      expect(input!.value).toBe("/Alice ");
    });
  });

  it("귓속말 후 닫고 일반 Enter 재활성화 시 stale prefill 재등장 안 함(빈 입력)", async () => {
    render(<ChatPanel {...baseProps} />);
    // 1) 귓속말 시작 → 입력창에 /Alice
    act(() => bus.emit("chat:startWhisper", { nickname: "Alice" }));
    await waitFor(() => expect(getInput()?.value).toBe("/Alice "));

    // 2) Escape로 닫기(deactivate → 입력창 언마운트 + prefill 해제)
    fireEvent.keyDown(getInput()!, { key: "Escape" });
    await waitFor(() => expect(getInput()).toBeNull());

    // 3) 재활성화 cooldown(150ms) 경과 대기
    await new Promise((r) => setTimeout(r, 180));

    // 4) 일반 Enter로 재활성화 → 입력창은 빈 상태여야 함(과거 /Alice 재등장 금지)
    fireEvent.keyDown(document.body, { key: "Enter" });
    await waitFor(() => expect(getInput()).not.toBeNull());
    expect(getInput()!.value).toBe("");
  });

  it("연속 귓속말(다른 대상) → 최신 대상으로 재적용", async () => {
    render(<ChatPanel {...baseProps} />);
    act(() => bus.emit("chat:startWhisper", { nickname: "Alice" }));
    await waitFor(() => expect(getInput()?.value).toBe("/Alice "));
    act(() => bus.emit("chat:startWhisper", { nickname: "Bob" }));
    await waitFor(() => expect(getInput()?.value).toBe("/Bob "));
  });
});
