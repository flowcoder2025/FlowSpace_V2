import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildGetRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn() },
    spaceEventLog: { findMany: vi.fn() },
    space: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

function makeLogRow(i: number) {
  return {
    id: `log-${i}`,
    spaceId: SPACE_ID,
    eventType: "ENTER",
    payload: null,
    createdAt: new Date(`2026-01-01T00:00:0${i}.000Z`),
    user: null,
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.spaceEventLog.findMany.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
  mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
  // WI-046: 기본 ACTIVE(status 게이트 통과). archived 케이스는 개별 override.
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
});

describe("GET /api/spaces/[id]/admin/logs — 권한·페이지네이션", () => {
  it("미인증 → 401, prisma 미호출", async () => {
    mockAuth.mockResolvedValue(makeSession(null));
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    expect(res.status).toBe(401);
    expect(mockPrisma.spaceEventLog.findMany).not.toHaveBeenCalled();
  });

  it("PARTICIPANT → 403", async () => {
    mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "PARTICIPANT" });
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    expect(res.status).toBe(403);
    expect(mockPrisma.spaceEventLog.findMany).not.toHaveBeenCalled();
  });

  it("응답 계약: { logs, nextCursor }만 (buildCursorPage 통일, WI-030)", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([makeLogRow(1)]);
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    expect(res.status).toBe(200);
    const body = await readJson<Record<string, unknown>>(res);
    expect(Object.keys(body).sort()).toEqual(["logs", "nextCursor"]);
    expect(body).not.toHaveProperty("hasMore");
    const args = mockPrisma.spaceEventLog.findMany.mock.calls[0][0];
    expect(args.take).toBe(51); // parsePageLimit 기본 50 + 1
  });

  it("limit+1 초과 → 절단 + nextCursor", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([
      makeLogRow(1),
      makeLogRow(2),
      makeLogRow(3),
    ]);
    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`, { limit: "2" }),
      ctx
    );
    const body = await readJson<{ logs: Array<{ id: string }>; nextCursor: string | null }>(res);
    expect(body.logs).toHaveLength(2);
    expect(body.nextCursor).toBe("log-2");
  });
});

describe("GET /api/spaces/[id]/admin/logs — 고급 필터(WI-030)", () => {
  it("필터 미지정 → where는 { spaceId }만 (무회귀)", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([]);
    await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    expect(mockPrisma.spaceEventLog.findMany.mock.calls[0][0].where).toEqual({
      spaceId: SPACE_ID,
    });
  });

  it("eventType 유효 → where.eventType 적용", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([]);
    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`, { eventType: "ADMIN_ACTION" }),
      ctx
    );
    expect(mockPrisma.spaceEventLog.findMany.mock.calls[0][0].where.eventType).toBe(
      "ADMIN_ACTION"
    );
  });

  it("eventType 무효 → 400 INVALID_FILTER, prisma 미호출 (기존 미검증 보강)", async () => {
    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`, { eventType: "BOGUS" }),
      ctx
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("INVALID_FILTER");
    expect(mockPrisma.spaceEventLog.findMany).not.toHaveBeenCalled();
  });

  it("날짜 범위 → where.createdAt { gte, lt }", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([]);
    const start = "2026-06-23T00:00:00.000Z";
    const end = "2026-06-24T00:00:00.000Z";
    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`, {
        startDate: start,
        endDate: end,
      }),
      ctx
    );
    const where = mockPrisma.spaceEventLog.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe(start);
    expect(where.createdAt.lt.toISOString()).toBe(end);
  });

  it("잘못된 날짜 → 400, prisma 미호출", async () => {
    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`, { startDate: "garbage" }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.spaceEventLog.findMany).not.toHaveBeenCalled();
  });

  it("eventType + 날짜 동시 → where 결합", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([]);
    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`, {
        eventType: "CHAT",
        startDate: "2026-06-23T00:00:00.000Z",
      }),
      ctx
    );
    const where = mockPrisma.spaceEventLog.findMany.mock.calls[0][0].where;
    expect(where.eventType).toBe("CHAT");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });
});

describe("GET /api/spaces/[id]/admin/logs — payload 정규화 + lean DTO (WI-032)", () => {
  it("응답 payload는 키 allowlist만 — 금지 키(email/inviteCode/accessSecret/prompt) 제거", async () => {
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
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    expect(res.status).toBe(200);
    const body = await readJson<{
      logs: Array<Record<string, unknown> & { payload: Record<string, unknown> | null }>;
    }>(res);
    const log = body.logs[0];
    // payload는 allowlist 키만.
    expect(Object.keys(log.payload ?? {}).sort()).toEqual(["action", "targetName"]);
    expect(log.payload).not.toHaveProperty("email");
    expect(log.payload).not.toHaveProperty("inviteCode");
    expect(log.payload).not.toHaveProperty("accessSecret");
    expect(log.payload).not.toHaveProperty("prompt");
  });

  it("응답 행은 lean — 내부 스칼라(spaceId/userId/guestSessionId/participantId) 미노출", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        spaceId: SPACE_ID,
        userId: "user-secret-1",
        guestSessionId: "guest-secret-1",
        participantId: "part-secret-1",
        eventType: "ENTER",
        payload: { action: "announce", messageId: "m1" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: { name: "Admin", email: "admin@example.com" },
      },
    ]);
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    const body = await readJson<{ logs: Array<Record<string, unknown>> }>(res);
    const log = body.logs[0];
    expect(Object.keys(log).sort()).toEqual([
      "createdAt",
      "eventType",
      "id",
      "payload",
      "user",
    ]);
    expect(log).not.toHaveProperty("spaceId");
    expect(log).not.toHaveProperty("userId");
    expect(log).not.toHaveProperty("guestSessionId");
    expect(log).not.toHaveProperty("participantId");
  });

  it("허용 키가 0개면 payload는 null(금지 키만 담긴 행)", async () => {
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        spaceId: SPACE_ID,
        userId: "u1",
        eventType: "ADMIN_ACTION",
        payload: { email: "leak@example.com", inviteCode: "abc" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: null,
      },
    ]);
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    const body = await readJson<{ logs: Array<{ payload: unknown }> }>(res);
    expect(body.logs[0].payload).toBeNull();
  });
});

describe("GET /api/spaces/[id]/admin/logs — archived 조회 가드 (WI-046)", () => {
  it("일반 OWNER는 ARCHIVED 스페이스 조회 차단(403 SPACE_NOT_ACTIVE), 로그 미조회", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    expect(res.status).toBe(403);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.spaceEventLog.findMany).not.toHaveBeenCalled();
  });

  it("superAdmin은 ARCHIVED 스페이스도 감사 조회 허용(200)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa-1", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    mockPrisma.spaceEventLog.findMany.mockResolvedValue([]);
    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/logs`), ctx);
    expect(res.status).toBe(200);
    expect(mockPrisma.spaceEventLog.findMany).toHaveBeenCalled();
  });
});
