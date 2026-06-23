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
