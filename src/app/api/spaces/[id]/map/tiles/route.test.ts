import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findFirst: vi.fn() },
    space: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PUT } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findFirst.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.space.update.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
});

describe("PUT /api/spaces/[id]/map/tiles — archived 가드 (WI-046)", () => {
  it("ARCHIVED는 OWNER여도 403 SPACE_NOT_ACTIVE, mapData 저장 미진입", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await PUT(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/tiles`, "PUT", {
        mapData: { layers: [] },
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.space.update).not.toHaveBeenCalled();
  });

  it("ARCHIVED는 superAdmin(비멤버)이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findFirst.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await PUT(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/tiles`, "PUT", {
        mapData: { layers: [] },
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.space.update).not.toHaveBeenCalled();
  });
});
