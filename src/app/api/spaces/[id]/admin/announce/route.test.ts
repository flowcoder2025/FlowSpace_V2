import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn() },
    space: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    chatMessage: { create: vi.fn() },
    spaceEventLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.chatMessage.create.mockReset();
  mockPrisma.spaceEventLog.create.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
});

describe("POST /api/spaces/[id]/admin/announce — archived 가드 (WI-046)", () => {
  it("ARCHIVED는 OWNER여도 403 SPACE_NOT_ACTIVE, 공지 생성 미진입", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/announce`, "POST", {
        content: "공지",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("ARCHIVED는 superAdmin(비멤버)이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/announce`, "POST", {
        content: "공지",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.chatMessage.create).not.toHaveBeenCalled();
  });
});
