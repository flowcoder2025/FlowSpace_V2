import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn() },
    space: { findUnique: vi.fn() },
    chatMessage: { findUnique: vi.fn(), update: vi.fn() },
    spaceEventLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { DELETE } from "./route";

const SPACE_ID = "space-1";
const MSG_ID = "msg-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID, messageId: MSG_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.chatMessage.findUnique.mockReset();
  mockPrisma.chatMessage.update.mockReset();
  mockPrisma.spaceEventLog.create.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
});

describe("DELETE /api/spaces/[id]/admin/messages/[messageId] — archived 가드 (WI-046)", () => {
  it("ARCHIVED는 OWNER여도 403 SPACE_NOT_ACTIVE, 메시지 조회/soft-delete 미진입", async () => {
    const res = await DELETE(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/messages/${MSG_ID}`, "DELETE", {}),
      ctx
    );

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.chatMessage.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.chatMessage.update).not.toHaveBeenCalled();
  });

  it("ARCHIVED는 superAdmin(비멤버)이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);

    const res = await DELETE(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/messages/${MSG_ID}`, "DELETE", {}),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.chatMessage.update).not.toHaveBeenCalled();
  });
});
