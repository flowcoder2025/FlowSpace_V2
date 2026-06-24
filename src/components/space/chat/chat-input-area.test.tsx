import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { ChatInputArea } from "./chat-input-area";

// ============================================================
// WI-040: 귓속말 발견성 — 외부 prefill로 입력창에 `/닉네임 ` 채우고 포커스.
// (참가자 패널 귓속말 버튼 → EventBridge → ChatPanel → prefill prop)
// ============================================================

function renderInput(prefill?: { value: string; token: number } | null) {
  return render(
    <ChatInputArea
      onSend={vi.fn()}
      onFocusChange={vi.fn()}
      replyTo={null}
      onCancelReply={vi.fn()}
      prefill={prefill}
    />
  );
}

const props = {
  onSend: vi.fn(),
  onFocusChange: vi.fn(),
  replyTo: null,
  onCancelReply: vi.fn(),
};

afterEach(cleanup);

describe("ChatInputArea — WI-040 귓속말 prefill", () => {
  it("prefill 제공 시 입력창에 value가 채워지고 포커스된다", async () => {
    renderInput({ value: "/Alice ", token: 1 });
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("/Alice "));
    expect(document.activeElement).toBe(input);
  });

  it("token 변경 시 새 value로 재적용된다(이미 마운트된 컴포넌트)", async () => {
    const { rerender } = renderInput({ value: "/Alice ", token: 1 });
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("/Alice "));
    rerender(<ChatInputArea {...props} prefill={{ value: "/Bob ", token: 2 }} />);
    await waitFor(() => expect(input.value).toBe("/Bob "));
  });

  it("prefill 없으면 입력창은 빈 상태", () => {
    renderInput(null);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("같은 prefill 객체로 리렌더 시 사용자 입력을 덮어쓰지 않는다(effect 미재실행)", async () => {
    const prefill = { value: "/Alice ", token: 1 };
    const { rerender } = renderInput(prefill);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("/Alice "));
    // 사용자가 메시지를 마저 입력
    fireEvent.change(input, { target: { value: "/Alice 안녕하세요" } });
    // 부모의 unrelated 리렌더(같은 prefill ref) — effect dep [prefill] 미변경 → 재실행 안 함
    rerender(<ChatInputArea {...props} prefill={prefill} />);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(input.value).toBe("/Alice 안녕하세요");
  });
});
