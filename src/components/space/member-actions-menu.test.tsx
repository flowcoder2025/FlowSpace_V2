import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemberActionsMenu } from "./member-actions-menu";
import type { ManagedMember } from "./use-space-members";

// ============================================================
// WI-035: 인-스페이스 멤버 관리 메뉴 — 게이팅·PATCH 식별자·확인 플로우
// ============================================================

const STAFF_MEMBER: ManagedMember = {
  memberId: "m-staff",
  userId: "u-staff",
  role: "STAFF",
  restriction: "NONE",
};

const MUTED_PART: ManagedMember = {
  memberId: "m-part",
  userId: "u-part",
  role: "PARTICIPANT",
  restriction: "MUTED",
};

function renderMenu(overrides: Partial<React.ComponentProps<typeof MemberActionsMenu>> = {}) {
  const onActionDone = vi.fn();
  const props: React.ComponentProps<typeof MemberActionsMenu> = {
    spaceId: "space-1",
    target: { userId: "u-staff", nickname: "Staff Kim" },
    member: STAFF_MEMBER,
    actorRole: "OWNER",
    currentUserId: "u-owner",
    onActionDone,
    ...overrides,
  };
  render(<MemberActionsMenu {...props} />);
  return { onActionDone };
}

beforeEach(() => {
  global.fetch = vi.fn() as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MemberActionsMenu — 게이팅", () => {
  it("member 없음(게스트/미매칭) → 렌더 안 함", () => {
    renderMenu({ member: null });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("actorRole null(미인가) → 렌더 안 함", () => {
    renderMenu({ actorRole: null });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("본인 → 렌더 안 함", () => {
    renderMenu({
      member: { ...STAFF_MEMBER, userId: "u-owner" },
      currentUserId: "u-owner",
    });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("canActOn 불가(STAFF가 STAFF 대상) → 렌더 안 함", () => {
    renderMenu({ actorRole: "STAFF", member: STAFF_MEMBER });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("OWNER 대상(동급/상위) → 렌더 안 함", () => {
    renderMenu({
      actorRole: "OWNER",
      member: { memberId: "m-o2", userId: "u-o2", role: "OWNER", restriction: "NONE" },
      target: { userId: "u-o2", nickname: "Other Owner" },
    });
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("MemberActionsMenu — 액션", () => {
  it("OWNER→STAFF(NONE): 음소거·내보내기·차단 노출(해제 미노출)", () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    expect(screen.getByText("채팅 음소거")).toBeTruthy();
    expect(screen.queryByText("채팅 음소거 해제")).toBeNull();
    expect(screen.getByText("내보내기")).toBeTruthy();
    expect(screen.getByText("차단")).toBeTruthy();
  });

  it("MUTED 대상 → '채팅 음소거 해제' 노출", () => {
    renderMenu({ member: MUTED_PART, target: { userId: "u-part", nickname: "Part" } });
    fireEvent.click(screen.getByLabelText("Part 관리"));
    expect(screen.getByText("채팅 음소거 해제")).toBeTruthy();
    expect(screen.queryByText("채팅 음소거")).toBeNull();
  });

  it("음소거 → PATCH는 memberId만 사용(userId 금지) + onActionDone 호출", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ member: {} }),
    });
    const { onActionDone } = renderMenu();
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("채팅 음소거"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/spaces/space-1/admin/members");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ memberId: "m-staff", action: "mute" });
    // 식별자 혼동 방지: userId가 PATCH 본문에 절대 없어야 함
    expect(JSON.stringify(body)).not.toContain("u-staff");

    await waitFor(() => expect(onActionDone).toHaveBeenCalledTimes(1));
  });

  it("내보내기 → 인라인 확인 후 PATCH(kick)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Member kicked" }),
    });
    const { onActionDone } = renderMenu();
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("내보내기"));

    // 확인 단계 — 바로 PATCH 안 됨
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/내보낼까요/)).toBeTruthy();

    fireEvent.click(screen.getByText("확인"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).toEqual({ memberId: "m-staff", action: "kick" });
    await waitFor(() => expect(onActionDone).toHaveBeenCalled());
  });

  it("차단 확인 취소 → PATCH 미호출", () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("차단"));
    expect(screen.getByText(/차단할까요/)).toBeTruthy();
    fireEvent.click(screen.getByText("취소"));
    expect(global.fetch).not.toHaveBeenCalled();
    // 액션 목록 복귀
    expect(screen.getByText("내보내기")).toBeTruthy();
  });

  it("PATCH 실패 → 인라인 에러 + onActionDone 미호출", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot modify a member of equal or higher role" }),
    });
    const { onActionDone } = renderMenu();
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("채팅 음소거"));

    await screen.findByText("Cannot modify a member of equal or higher role");
    expect(onActionDone).not.toHaveBeenCalled();
  });
});

// ============================================================
// WI-039: 음성 강제 음소거(LiveKit) — identity 게이트·라우트·라벨 구분·refetch 미호출·에러 매핑
// ============================================================
describe("MemberActionsMenu — 음성 제어(WI-039)", () => {
  it("participantIdentity 없음 → 음성 액션 미노출(채팅 액션은 유지)", () => {
    renderMenu(); // participantIdentity 미전달
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    expect(screen.getByText("채팅 음소거")).toBeTruthy();
    expect(screen.queryByText("음성 강제 음소거")).toBeNull();
    expect(screen.queryByText("음성 발언 허용")).toBeNull();
  });

  it("participantIdentity 있음 → '음성 강제 음소거'+'음성 발언 허용' 노출(채팅 음소거와 별개 라벨)", () => {
    renderMenu({ participantIdentity: "user-u-staff" });
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    // 채팅 음소거와 음성 강제 음소거가 라벨로 명확히 구분됨(운영자 오제재 방지)
    expect(screen.getByText("채팅 음소거")).toBeTruthy();
    expect(screen.getByText("음성 강제 음소거")).toBeTruthy();
    expect(screen.getByText("음성 발언 허용")).toBeTruthy();
  });

  it("'음성 강제 음소거' → POST moderate {identity,muted:true} + onActionDone 미호출(refetch 안 함)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ identity: "user-u-staff", muted: true, trackSid: "TR_x" }),
    });
    const { onActionDone } = renderMenu({ participantIdentity: "user-u-staff" });
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("음성 강제 음소거"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/spaces/space-1/livekit/moderate");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ identity: "user-u-staff", muted: true });
    // 음성 식별자는 LiveKit identity — SpaceMember.id(memberId)를 보내지 않는다.
    expect(JSON.stringify(body)).not.toContain("m-staff");
    // 멤버 상태 미변경 → refetch 호출 안 함(LiveKit 이벤트로 갱신).
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(onActionDone).not.toHaveBeenCalled();
  });

  it("'음성 발언 허용' → POST moderate {identity,muted:false}", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ identity: "user-u-staff", muted: false, trackSid: null }),
    });
    renderMenu({ participantIdentity: "user-u-staff" });
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("음성 발언 허용"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).toEqual({ identity: "user-u-staff", muted: false });
  });

  it("음성 액션 성공 → 메뉴 닫힘", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ identity: "user-u-staff", muted: true, trackSid: "TR_x" }),
    });
    renderMenu({ participantIdentity: "user-u-staff" });
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("음성 강제 음소거"));
    await waitFor(() => expect(screen.queryByText("음성 강제 음소거")).toBeNull());
  });

  it("음성 실패(code) → 영문 미노출, 한글 매핑 에러 표시", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Participant is not connected", code: "PARTICIPANT_NOT_FOUND" }),
    });
    renderMenu({ participantIdentity: "user-u-staff" });
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("음성 강제 음소거"));

    await screen.findByText("참가자가 음성 방에 연결되어 있지 않습니다.");
    // 서버 영문 error 문자열은 화면에 노출되지 않는다.
    expect(screen.queryByText("Participant is not connected")).toBeNull();
  });

  it("음성 실패(미지의 code) → actionFailed 폴백", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "boom", code: "SOMETHING_NEW" }),
    });
    renderMenu({ participantIdentity: "user-u-staff" });
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("음성 강제 음소거"));

    await screen.findByText("작업에 실패했습니다.");
  });

  it("음성 네트워크 예외 → networkError 표시", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("net"));
    renderMenu({ participantIdentity: "user-u-staff" });
    fireEvent.click(screen.getByLabelText("Staff Kim 관리"));
    fireEvent.click(screen.getByText("음성 강제 음소거"));

    await screen.findByText("네트워크 오류가 발생했습니다.");
  });

  it("게이트 미통과(canActOn 불가)면 identity 있어도 메뉴 자체 미렌더 → 음성 액션 없음", () => {
    // 메뉴 가시성 게이트(member/actorRole/canActOn)와 음성 액션 게이트는 분리 —
    // 멤버 게이트를 통과 못하면 음성 액션도 노출되지 않는다.
    renderMenu({ actorRole: "STAFF", member: STAFF_MEMBER, participantIdentity: "user-u-staff" });
    expect(screen.queryByRole("button")).toBeNull();
  });
});
