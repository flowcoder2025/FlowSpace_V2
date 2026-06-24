import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findFirst: vi.fn() },
    space: { findUnique: vi.fn() },
    mapObject: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findFirst.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.mapObject.create.mockReset();
  // 기본: OWNER + ACTIVE
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
});

describe("POST /api/spaces/[id]/map/objects — archived 가드 (WI-046)", () => {
  it("ARCHIVED 스페이스는 OWNER여도 403 SPACE_NOT_ACTIVE, create 미진입", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/objects`, "POST", {
        objectType: "PORTAL",
        positionX: 1,
        positionY: 2,
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.mapObject.create).not.toHaveBeenCalled();
  });

  it("ARCHIVED 스페이스는 superAdmin(비멤버)이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findFirst.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/objects`, "POST", {
        objectType: "PORTAL",
        positionX: 1,
        positionY: 2,
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.mapObject.create).not.toHaveBeenCalled();
  });
});
