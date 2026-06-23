import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { managedUserIdFromIdentity, useSpaceMembers } from "./use-space-members";

// ============================================================
// WI-035: 인-스페이스 멤버 관리 — 식별자 매핑 + 멤버 스냅샷 훅
// ============================================================

describe("managedUserIdFromIdentity (식별자 혼동 방지)", () => {
  it("user- 접두사만 userId로 해석", () => {
    expect(managedUserIdFromIdentity("user-abc123")).toBe("abc123");
  });
  it("guest- 는 관리 대상 아님(null)", () => {
    expect(managedUserIdFromIdentity("guest-sess1")).toBeNull();
  });
  it("dev-anon- 은 null", () => {
    expect(managedUserIdFromIdentity("dev-anon-1700000000000")).toBeNull();
  });
  it("접두사 없는 bare 값은 null (userId처럼 매칭 금지)", () => {
    expect(managedUserIdFromIdentity("abc123")).toBeNull();
  });
  it("'user-' (빈 나머지)은 null", () => {
    expect(managedUserIdFromIdentity("user-")).toBeNull();
  });
});

const jsonOk = (body: unknown) => ({ ok: true, json: async () => body });

const MEMBERS = [
  { id: "m-owner", role: "OWNER", restriction: "NONE", userId: "u-owner" },
  { id: "m-staff", role: "STAFF", restriction: "NONE", userId: "u-staff" },
  { id: "m-part", role: "PARTICIPANT", restriction: "MUTED", userId: "u-part" },
  // 게스트 — userId null → 매핑 제외
  { id: "m-guest", role: "PARTICIPANT", restriction: "NONE", userId: null },
];

beforeEach(() => {
  global.fetch = vi.fn() as unknown as typeof fetch;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSpaceMembers", () => {
  it("enabled=false → fetch 미호출·미인가·빈 맵", async () => {
    const { result } = renderHook(() =>
      useSpaceMembers("space-1", "u-owner", false)
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.isAuthorized).toBe(false);
    expect(result.current.membersByUserId.size).toBe(0);
    expect(result.current.actorRole).toBeNull();
  });

  it("GET 200 → userId 맵 구성(게스트 제외) + self role 도출", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonOk({ members: MEMBERS })
    );
    const { result } = renderHook(() =>
      useSpaceMembers("space-1", "u-owner", true)
    );

    await waitFor(() => expect(result.current.isAuthorized).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith("/api/spaces/space-1/admin/members");
    // 게스트(userId null) 제외 → 3건
    expect(result.current.membersByUserId.size).toBe(3);
    // 호출자(self=OWNER) 권위 role
    expect(result.current.actorRole).toBe("OWNER");
    // 매핑 값: memberId = SpaceMember.id (userId와 구별)
    const staff = result.current.membersByUserId.get("u-staff");
    expect(staff?.memberId).toBe("m-staff");
    expect(staff?.userId).toBe("u-staff");
    expect(staff?.role).toBe("STAFF");
    expect(result.current.membersByUserId.get("u-part")?.restriction).toBe("MUTED");
  });

  it("GET 403 → 미인가·빈 맵·actorRole null", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    });
    const { result } = renderHook(() =>
      useSpaceMembers("space-1", "u-part", true)
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthorized).toBe(false);
    expect(result.current.membersByUserId.size).toBe(0);
    expect(result.current.actorRole).toBeNull();
  });

  it("refetch() → 재조회 트리거", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonOk({ members: MEMBERS })
    );
    const { result } = renderHook(() =>
      useSpaceMembers("space-1", "u-owner", true)
    );
    await waitFor(() => expect(result.current.isAuthorized).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => result.current.refetch());
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it("enabled true→false 전환 시 이전 스냅샷 폐기(stale 관리 상태 방지)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonOk({ members: MEMBERS })
    );
    const { result, rerender } = renderHook(
      ({ en }) => useSpaceMembers("space-1", "u-owner", en),
      { initialProps: { en: true } }
    );
    await waitFor(() => expect(result.current.isAuthorized).toBe(true));
    expect(result.current.membersByUserId.size).toBe(3);

    rerender({ en: false });
    await waitFor(() => expect(result.current.isAuthorized).toBe(false));
    expect(result.current.membersByUserId.size).toBe(0);
    expect(result.current.actorRole).toBeNull();
  });

  it("네트워크 오류 → 미인가(보수적)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("net"));
    const { result } = renderHook(() =>
      useSpaceMembers("space-1", "u-owner", true)
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthorized).toBe(false);
    expect(result.current.membersByUserId.size).toBe(0);
  });
});
