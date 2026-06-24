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
    // prefill effect는 rAF로 적용된다 — clear가 빠지면 rAF settle 후 "/Alice "가 재등장하므로
    // rAF 2프레임 대기 후 단언해야 deactivate clear 결함을 실제로 검출한다(동기 단언=false-pass).
    await act(async () => {
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r(null)))
      );
    });
    expect(getInput()!.value).toBe("");
  });

  it("연속 귓속말(다른 대상) → 최신 대상으로 재적용", async () => {
    render(<ChatPanel {...baseProps} />);
    act(() => bus.emit("chat:startWhisper", { nickname: "Alice" }));
    await waitFor(() => expect(getInput()?.value).toBe("/Alice "));
    act(() => bus.emit("chat:startWhisper", { nickname: "Bob" }));
    await waitFor(() => expect(getInput()?.value).toBe("/Bob "));
  });

  it("닫은 직후(cooldown 내) 귓속말 클릭도 활성화됨 — activate force 우회", async () => {
    render(<ChatPanel {...baseProps} />);
    // 먼저 열고 즉시 닫아 재활성화 cooldown(150ms)을 시작시킨다.
    act(() => bus.emit("chat:startWhisper", { nickname: "Alice" }));
    await waitFor(() => expect(getInput()?.value).toBe("/Alice "));
    fireEvent.keyDown(getInput()!, { key: "Escape" });
    await waitFor(() => expect(getInput()).toBeNull());
    // cooldown 경과 전(지연 없음) 귓속말 → force 우회로 즉시 활성화되어야 함.
    // (force 없이 activate()면 cooldown에 막혀 입력창이 안 열려 이 단언이 timeout FAIL.)
    act(() => bus.emit("chat:startWhisper", { nickname: "Bob" }));
    await waitFor(() => expect(getInput()?.value).toBe("/Bob "));
  });
});
