import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ============================================================
// WI-040: 참가자 패널 귓속말 버튼 — 모든 사용자(self 제외)에게 노출,
// 공백 없는 닉네임만(slash 문법 한계), 클릭 시 EventBridge로 CHAT_START_WHISPER emit.
// 무거운 의존성(game 배럴/use-space-members/VideoTile)은 모킹, canWhisperTarget은 실제 파서.
// ============================================================

// vi.mock 팩토리는 파일 상단으로 호이스팅 → 참조 변수는 vi.hoisted로 정의해야 함.
const { emitSpy } = vi.hoisted(() => ({ emitSpy: vi.fn() }));
vi.mock("@/features/space/game", () => ({
  eventBridge: { emit: emitSpy, on: vi.fn(), off: vi.fn() },
  GameEvents: { CHAT_START_WHISPER: "chat:startWhisper" },
}));

// MemberActionsMenu는 member/actorRole 없으면 null — 관리 메뉴를 무력화해 귓속말 버튼만 검사.
vi.mock("../use-space-members", () => ({
  useSpaceMembers: () => ({ membersByUserId: new Map(), actorRole: null, refetch: vi.fn() }),
  managedUserIdFromIdentity: (id: string) => id.replace(/^user-/, ""),
}));

vi.mock("./VideoTile", () => ({ VideoTile: () => null }));

// canWhisperTarget는 실제 구현(공개 배럴 경유 — 모듈 경계 준수). 배럴 전체를 mock으로
// 대체하되 실제 canWhisperTarget만 노출해 무거운 훅(useChat 등)을 끌어오지 않는다.
vi.mock("@/features/space/chat", async () => {
  const actual = await vi.importActual<typeof import("@/features/space/chat")>(
    "@/features/space/chat"
  );
  return { canWhisperTarget: actual.canWhisperTarget };
});

import { ParticipantPanel } from "./ParticipantPanel";
import { SPACE_COPY } from "@/constants/space-copy";

const WHISPER = SPACE_COPY.PARTICIPANT_PANEL.whisper;

function setup(players: Array<{ userId: string; nickname: string }>, currentUserId = "me") {
  return render(
    <ParticipantPanel
      participantTracks={new Map()}
      localParticipantId={null}
      spaceId="s1"
      players={players}
      currentUserId={currentUserId}
      currentNickname="나"
    />
  );
}

beforeEach(() => emitSpy.mockReset());
afterEach(cleanup);

describe("ParticipantPanel — WI-040 귓속말 버튼", () => {
  it("비-self·공백없는 닉네임 → 귓속말 버튼 노출 + 클릭 시 CHAT_START_WHISPER emit", () => {
    setup([{ userId: "u1", nickname: "Alice" }]);
    const btn = screen.getByRole("button", { name: WHISPER.ariaLabel("Alice") });
    fireEvent.click(btn);
    expect(emitSpy).toHaveBeenCalledWith("chat:startWhisper", { nickname: "Alice" });
  });

  it("self 참가자에게는 귓속말 버튼 미노출", () => {
    setup([{ userId: "u1", nickname: "Alice" }], "me");
    // self row(나)는 액션 영역 자체가 없음 → "나"에 대한 귓속말 버튼 없음
    expect(screen.queryByRole("button", { name: WHISPER.ariaLabel("나") })).toBeNull();
  });

  it("공백 포함 닉네임 → 귓속말 버튼 미노출(slash 오배송 방지)", () => {
    setup([{ userId: "u2", nickname: "Staff Kim" }]);
    expect(
      screen.queryByRole("button", { name: WHISPER.ariaLabel("Staff Kim") })
    ).toBeNull();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("동일 닉네임 참가자 2명+ → 양쪽 모두 귓속말 버튼 미노출(nickname 오배송 방지·codex P2)", () => {
    setup([
      { userId: "u1", nickname: "Alice" },
      { userId: "u2", nickname: "Alice" },
    ]);
    expect(
      screen.queryAllByRole("button", { name: WHISPER.ariaLabel("Alice") })
    ).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("여러 참가자 — 공백없는 닉네임만 버튼 노출", () => {
    setup([
      { userId: "u1", nickname: "Alice" },
      { userId: "u2", nickname: "Bob Lee" },
      { userId: "u3", nickname: "Charlie" },
    ]);
    expect(screen.getByRole("button", { name: WHISPER.ariaLabel("Alice") })).toBeTruthy();
    expect(screen.getByRole("button", { name: WHISPER.ariaLabel("Charlie") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: WHISPER.ariaLabel("Bob Lee") })).toBeNull();
  });
});
