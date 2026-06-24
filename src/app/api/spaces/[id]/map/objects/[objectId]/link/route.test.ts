import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findFirst: vi.fn() },
    space: { findUnique: vi.fn() },
    mapObject: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

const SPACE_ID = "space-1";
const OBJ_ID = "obj-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID, objectId: OBJ_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findFirst.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.mapObject.findFirst.mockReset();
  mockPrisma.mapObject.update.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
});

describe("POST /api/spaces/[id]/map/objects/[objectId]/link — archived 가드 (WI-046)", () => {
  it("ARCHIVED는 OWNER여도 403 SPACE_NOT_ACTIVE, 포탈 조회/연결 미진입", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/objects/${OBJ_ID}/link`, "POST", {
        targetObjectId: "obj-2",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.mapObject.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.mapObject.update).not.toHaveBeenCalled();
  });
});
