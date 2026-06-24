import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.mock 프리앰블 — 파일 로컬 호이스팅(enforce* 가 prisma.space.findUnique 사용)
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { space: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  SPACE_MUTABLE_STATUSES,
  SPACE_NOT_ACTIVE_CODE,
  isSpaceMutable,
  canAccessInactiveSpaceAdmin,
  spaceNotActiveResponse,
  enforceSpaceMutable,
  enforceAdminReadable,
} from "./space-status-policy";

beforeEach(() => {
  mockPrisma.space.findUnique.mockReset();
});

describe("space-status-policy — 순수 정책 (WI-046)", () => {
  it("SPACE_MUTABLE_STATUSES 는 ACTIVE 단일", () => {
    expect(SPACE_MUTABLE_STATUSES).toEqual(["ACTIVE"]);
  });

  it("isSpaceMutable: ACTIVE만 true, INACTIVE/ARCHIVED는 false", () => {
    expect(isSpaceMutable("ACTIVE")).toBe(true);
    expect(isSpaceMutable("INACTIVE")).toBe(false);
    expect(isSpaceMutable("ARCHIVED")).toBe(false);
  });

  it("canAccessInactiveSpaceAdmin: ACTIVE는 누구든, 비-ACTIVE는 superAdmin만", () => {
    // ACTIVE: superAdmin 여부 무관 허용
    expect(canAccessInactiveSpaceAdmin("ACTIVE", false)).toBe(true);
    expect(canAccessInactiveSpaceAdmin("ACTIVE", true)).toBe(true);
    // ARCHIVED: superAdmin만
    expect(canAccessInactiveSpaceAdmin("ARCHIVED", false)).toBe(false);
    expect(canAccessInactiveSpaceAdmin("ARCHIVED", true)).toBe(true);
    // INACTIVE: superAdmin만
    expect(canAccessInactiveSpaceAdmin("INACTIVE", false)).toBe(false);
    expect(canAccessInactiveSpaceAdmin("INACTIVE", true)).toBe(true);
  });

  it("spaceNotActiveResponse: 403 + { error, code:SPACE_NOT_ACTIVE }", async () => {
    expect(SPACE_NOT_ACTIVE_CODE).toBe("SPACE_NOT_ACTIVE");
    const res = spaceNotActiveResponse();
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
    expect(typeof body.error).toBe("string");
  });
});

describe("enforceSpaceMutable (mutation 게이트, WI-046)", () => {
  it("ACTIVE → null(통과)", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
    expect(await enforceSpaceMutable("s1")).toBeNull();
    expect(mockPrisma.space.findUnique).toHaveBeenCalledWith({
      where: { id: "s1" },
      select: { status: true },
    });
  });

  it("ARCHIVED → 403 SPACE_NOT_ACTIVE", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    const res = await enforceSpaceMutable("s1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(((await res!.json()) as { code: string }).code).toBe("SPACE_NOT_ACTIVE");
  });

  it("INACTIVE → 403 (non-ACTIVE 차단)", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "INACTIVE" });
    const res = await enforceSpaceMutable("s1");
    expect(res!.status).toBe(403);
  });

  it("스페이스 미존재 → 404", async () => {
    mockPrisma.space.findUnique.mockResolvedValue(null);
    const res = await enforceSpaceMutable("s1");
    expect(res!.status).toBe(404);
  });
});

describe("enforceAdminReadable (조회 게이트, WI-046)", () => {
  it("ACTIVE → null (superAdmin 여부 무관)", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
    expect(await enforceAdminReadable("s1", false)).toBeNull();
    expect(await enforceAdminReadable("s1", true)).toBeNull();
  });

  it("ARCHIVED + 일반 → 403, ARCHIVED + superAdmin → null", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    const blocked = await enforceAdminReadable("s1", false);
    expect(blocked!.status).toBe(403);

    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    expect(await enforceAdminReadable("s1", true)).toBeNull();
  });

  it("스페이스 미존재 → 404 (superAdmin이어도)", async () => {
    mockPrisma.space.findUnique.mockResolvedValue(null);
    const res = await enforceAdminReadable("s1", true);
    expect(res!.status).toBe(404);
  });
});
