import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findFirst: vi.fn() },
    space: { findUnique: vi.fn() },
    mapObject: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH, DELETE } from "./route";

const SPACE_ID = "space-1";
const OBJ_ID = "obj-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID, objectId: OBJ_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findFirst.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.mapObject.findFirst.mockReset();
  mockPrisma.mapObject.update.mockReset();
  mockPrisma.mapObject.delete.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
});

describe("map/objects/[objectId] — archived 가드 (WI-046)", () => {
  it("PATCH: ARCHIVED는 OWNER여도 403 SPACE_NOT_ACTIVE, 오브젝트 조회/update 미진입", async () => {
    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/objects/${OBJ_ID}`, "PATCH", {
        positionX: 5,
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.mapObject.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.mapObject.update).not.toHaveBeenCalled();
  });

  it("DELETE: ARCHIVED는 OWNER여도 403, delete 미진입", async () => {
    const res = await DELETE(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/objects/${OBJ_ID}`, "DELETE", {}),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.mapObject.delete).not.toHaveBeenCalled();
  });

  it("DELETE: ARCHIVED는 superAdmin(비멤버)이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findFirst.mockResolvedValue(null);

    const res = await DELETE(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/map/objects/${OBJ_ID}`, "DELETE", {}),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.mapObject.delete).not.toHaveBeenCalled();
  });
});
