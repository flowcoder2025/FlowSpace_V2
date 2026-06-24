import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================
// WI-042: 대시보드 archived 스페이스 가드
// soft-delete(status=ARCHIVED)된 스페이스의 관리자 대시보드는 일반 OWNER/STAFF에게 닫고,
// superAdmin은 감사/복원 목적 조회만 허용한다. INACTIVE는 차단 대상이 아니다(ARCHIVED만).
// DashboardSidebar는 클라이언트 트리(zustand/라우팅)를 끌어오므로 mock으로 대체.
// ============================================================

const { mockRequireSpaceAdmin, mockPrisma, mockRedirect } = vi.hoisted(() => ({
  mockRequireSpaceAdmin: vi.fn(),
  mockPrisma: {
    space: { findUnique: vi.fn() },
  },
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/admin-guard", () => ({ requireSpaceAdmin: mockRequireSpaceAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/components/dashboard/dashboard-sidebar", () => ({
  DashboardSidebar: () => null,
}));

import DashboardLayout from "./layout";

const SPACE_ID = "space-1";
const call = () =>
  DashboardLayout({
    children: null,
    params: Promise.resolve({ id: SPACE_ID }),
  });

const adminCtx = (over: Partial<{ role: "OWNER" | "STAFF"; isSuperAdmin: boolean }> = {}) => ({
  userId: "u1",
  spaceId: SPACE_ID,
  role: over.role ?? "OWNER",
  isSuperAdmin: over.isSuperAdmin ?? false,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRedirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  mockRequireSpaceAdmin.mockResolvedValue(adminCtx());
  mockPrisma.space.findUnique.mockResolvedValue({ name: "Space", status: "ACTIVE" });
});

describe("DashboardLayout archived 가드", () => {
  it("ACTIVE 스페이스 → 일반 OWNER 통과(렌더, redirect 없음)", async () => {
    const el = await call();
    expect(el).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("ARCHIVED 스페이스 + 일반 OWNER → /my-spaces redirect", async () => {
    mockRequireSpaceAdmin.mockResolvedValue(adminCtx({ role: "OWNER" }));
    mockPrisma.space.findUnique.mockResolvedValue({ name: "Space", status: "ARCHIVED" });

    await expect(call()).rejects.toThrow("REDIRECT:/my-spaces");
  });

  it("ARCHIVED 스페이스 + 일반 STAFF → /my-spaces redirect", async () => {
    mockRequireSpaceAdmin.mockResolvedValue(adminCtx({ role: "STAFF" }));
    mockPrisma.space.findUnique.mockResolvedValue({ name: "Space", status: "ARCHIVED" });

    await expect(call()).rejects.toThrow("REDIRECT:/my-spaces");
  });

  it("ARCHIVED 스페이스 + superAdmin → 통과(감사/복원 조회 허용, redirect 없음)", async () => {
    mockRequireSpaceAdmin.mockResolvedValue(adminCtx({ isSuperAdmin: true }));
    mockPrisma.space.findUnique.mockResolvedValue({ name: "Space", status: "ARCHIVED" });

    const el = await call();
    expect(el).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("INACTIVE 스페이스 + 일반 OWNER → 통과(이번 WI는 ARCHIVED만 차단)", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ name: "Space", status: "INACTIVE" });

    const el = await call();
    expect(el).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("findUnique select에 status 포함(누락 시 archived 판정 불가 — 회귀 방지)", async () => {
    await call();

    expect(mockPrisma.space.findUnique).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.space.findUnique.mock.calls[0][0] as {
      where: unknown;
      select: Record<string, boolean>;
    };
    expect(arg.where).toEqual({ id: SPACE_ID });
    expect(arg.select).toEqual({ name: true, status: true });
  });
});
