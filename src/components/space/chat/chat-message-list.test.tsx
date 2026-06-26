import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";
import { ChatMessageList } from "./chat-message-list";
import type { ChatMessage } from "@/features/space/chat";

// jsdom은 scrollIntoView 미구현·ResizeObserver 미제공.
// ResizeObserver는 "최신 콜백 캡처형" mock으로 대체 — resize 재고정 동작을 결정적으로 발화시킨다.
// (effect 의존성 [autoScroll]로 재구독되므로 roCallback은 항상 최신 클로저를 가리킨다.)
let roCallback: (() => void) | null = null;

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  class MockResizeObserver {
    constructor(cb: () => void) {
      roCallback = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;
});

beforeEach(() => {
  roCallback = null;
});

function makeMsg(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    userId: "u1",
    nickname: "닉네임",
    content: "안녕하세요",
    type: "message",
    timestamp: new Date("2026-06-26T10:00:00Z").toISOString(),
    ...over,
  };
}

const baseProps = {
  currentUserId: "u1",
  isAdmin: false,
  onReply: vi.fn(),
  onReactionToggle: vi.fn(),
  onDeleteMessage: vi.fn(),
};

/** scrollHeight/clientHeight는 jsdom에서 0 — 테스트용으로 정의(레이아웃 부재 보완). */
function stubMetrics(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
}

describe("ChatMessageList 스크롤 높이 사슬 회귀 가드", () => {
  // 버그: 중간 래퍼가 auto 높이라 자식 h-full(=100%)이 bounded되지 않아
  //       overflow-y-auto가 스크롤할 게 없었음 → 오래된 메시지 위로 잘리고 스크롤 불가.
  // 수정: 래퍼/스크롤 컨테이너에 h-full + min-h-0 으로 definite height 확보.
  it("바깥 래퍼가 고정높이 부모를 채우도록 h-full + min-h-0 을 가진다", () => {
    const { container } = render(
      <ChatMessageList {...baseProps} messages={[makeMsg()]} />
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("relative");
    expect(outer.className).toContain("h-full");
    expect(outer.className).toContain("min-h-0");
  });

  it("스크롤 컨테이너가 bounded(h-full + min-h-0) + overflow-y-auto 이고 justify-end 를 쓰지 않는다", () => {
    const { container } = render(
      <ChatMessageList {...baseProps} messages={[makeMsg()]} />
    );
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller).not.toBeNull();
    expect(scroller.className).toContain("h-full");
    expect(scroller.className).toContain("min-h-0");
    // justify-end 는 overflow 시 "위로 스크롤 불가" 브라우저 버그 유발 → 금지(mt-auto 패턴 사용).
    expect(scroller.className).not.toContain("justify-end");
  });

  it("메시지 콘텐츠 래퍼가 mt-auto 로 하단 정렬(적은 메시지) — overflow 시 0으로 접혀 스크롤 보존", () => {
    const { container } = render(
      <ChatMessageList {...baseProps} messages={[makeMsg()]} />
    );
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    const content = scroller.firstElementChild as HTMLElement;
    expect(content.className).toContain("mt-auto");
    // 메시지는 콘텐츠 래퍼 안(스크롤 대상)에 렌더된다.
    expect(content.textContent).toContain("안녕하세요");
  });
});

describe("ChatMessageList 리사이즈 하단 재고정(ResizeObserver)", () => {
  // 패널 리사이즈/폰트 변경으로 컨테이너 크기가 바뀌어도 메시지 수가 그대로면
  // 자동 스크롤 effect([messages])가 안 돌아 하단 고정이 풀리던 엣지를 보완.
  it("하단에 붙어 있으면(autoScroll=true) 리사이즈 시 scrollTop을 scrollHeight로 재고정", () => {
    const { container } = render(
      <ChatMessageList {...baseProps} messages={[makeMsg()]} />
    );
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    stubMetrics(scroller, 500, 100);
    scroller.scrollTop = 0;

    expect(roCallback).not.toBeNull();
    act(() => roCallback!());

    expect(scroller.scrollTop).toBe(500);
  });

  it("위로 스크롤한 상태(autoScroll=false)에서는 리사이즈가 하단으로 강제하지 않는다", () => {
    const { container } = render(
      <ChatMessageList {...baseProps} messages={[makeMsg()]} />
    );
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    stubMetrics(scroller, 500, 100);

    // 위로 스크롤 → isAtBottom=false(500-0-100=400 ≥ 50) → setAutoScroll(false)
    scroller.scrollTop = 0;
    act(() => {
      fireEvent.scroll(scroller);
    });

    // effect 재구독으로 roCallback은 autoScroll=false 클로저. 재고정 발화해도 이동 없어야 함.
    scroller.scrollTop = 10;
    act(() => roCallback!());

    expect(scroller.scrollTop).toBe(10);
  });
});
