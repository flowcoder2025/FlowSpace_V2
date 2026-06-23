import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildGetRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn(), count: vi.fn() },
    chatMessage: { count: vi.fn() },
    spaceEventLog: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.spaceMember.count.mockReset();
  mockPrisma.chatMessage.count.mockReset();
  mockPrisma.spaceEventLog.findMany.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
  mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
  mockPrisma.spaceMember.count.mockResolvedValue(3);
  mockPrisma.chatMessage.count.mockResolvedValue(10);
  mockPrisma.spaceEventLog.findMany.mockResolvedValue([]);
});

describe("GET /api/spaces/[id]/admin/stats — 권한", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(makeSession(null));
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/stats`), ctx);
    expect(res.status).toBe(401);
    expect(mockPrisma.spaceEventLog.findMany).not.toHaveBeenCalled();
  });

  it("PARTICIPANT → 403", async () => {
    mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "PARTICIPANT" });
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/stats`), ctx);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/spaces/[id]/admin/stats — recentActivity payload 정규화 (WI-032)", () => {
  it("recentActivity payload는 allowlist만, 행은 lean DTO — 금지 키/내부 스칼라 미노출", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        spaceId: SPACE_ID,
        userId: "user-secret-1",
        guestSessionId: "guest-secret-1",
        participantId: "part-secret-1",
        eventType: "ADMIN_ACTION",
        payload: {
          action: "kick",
          targetName: "Bob",
          email: "bob@example.com",
          inviteCode: "SECRET-CODE",
          accessSecret: "sk_live_xxx",
          prompt: "internal prompt",
        },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { name: "Admin", email: "admin@example.com" },
      },
    ]);
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/stats`), ctx);
    expect(res.status).toBe(200);
    const body = await readJson<{
      recentActivity: Array<Record<string, unknown> & { payload: Record<string, unknown> | null }>;
    }>(res);
    const event = body.recentActivity[0];
    // payload는 allowlist 키만(금지 키 제거).
    expect(Object.keys(event.payload ?? {}).sort()).toEqual(["action", "targetName"]);
    expect(event.payload).not.toHaveProperty("email");
    expect(event.payload).not.toHaveProperty("inviteCode");
    expect(event.payload).not.toHaveProperty("accessSecret");
    expect(event.payload).not.toHaveProperty("prompt");
    // 행은 lean — 내부 스칼라 미노출.
    expect(Object.keys(event).sort()).toEqual([
      "createdAt",
      "eventType",
      "id",
      "payload",
      "user",
    ]);
    expect(event).not.toHaveProperty("spaceId");
    expect(event).not.toHaveProperty("userId");
  });

  it("기본 통계 카운트는 보존(무회귀)", async () => {
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/stats`), ctx);
    const body = await readJson<{
      memberCount: number;
      messageCount: number;
      todayMessageCount: number;
      recentActivity: unknown[];
    }>(res);
    expect(body.memberCount).toBe(3);
    expect(body.messageCount).toBe(10);
    expect(body.recentActivity).toEqual([]);
  });
});
