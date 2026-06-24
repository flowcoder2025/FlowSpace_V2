import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildGetRequest,
  makeSession,
  readJson,
} from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn() },
    chatMessage: { findMany: vi.fn() },
    space: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

function makeMessageRow(i: number) {
  return {
    id: `msg-${i}`,
    spaceId: SPACE_ID,
    senderName: `닉네임${i}`,
    content: `내용 ${i}`,
    type: "GROUP",
    createdAt: new Date(`2026-01-01T00:00:0${i}.000Z`),
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.chatMessage.findMany.mockReset();
  mockPrisma.space.findUnique.mockReset();
  // 기본: OWNER 관리자
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
  mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
  // WI-046: 기본 ACTIVE(status 게이트 통과). archived 케이스는 개별 override.
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
});

describe("GET /api/spaces/[id]/admin/messages — cursor(헬퍼 통일, WI-012-2 S5)", () => {
  it("응답 계약 보존: { messages, nextCursor }만 (hasMore 미노출, D5)", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([makeMessageRow(1)]);

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`),
      ctx
    );
    expect(res.status).toBe(200);

    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.take).toBe(51); // parsePageLimit 기본 50 + 1

    const body = await readJson<Record<string, unknown>>(res);
    // admin은 raw row 그대로(매핑 없음) + nextCursor, hasMore 키 없음
    expect(Object.keys(body).sort()).toEqual(["messages", "nextCursor"]);
    expect(body).not.toHaveProperty("hasMore");
    expect((body.messages as unknown[]).length).toBe(1);
    expect(body.nextCursor).toBeNull();
  });

  it("limit+1 초과 → 여분 절단 + nextCursor 설정(hasMore 키는 여전히 없음)", async () => {
    const rows = [makeMessageRow(1), makeMessageRow(2), makeMessageRow(3)];
    mockPrisma.chatMessage.findMany.mockResolvedValue(rows);

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, { limit: "2" }),
      ctx
    );
    const body = await readJson<{
      messages: Array<{ id: string }>;
      nextCursor: string | null;
    }>(res);
    expect(body.messages).toHaveLength(2);
    expect(body.nextCursor).toBe("msg-2");
    expect(body).not.toHaveProperty("hasMore");
  });

  it("cursor 지정 → cursor:{id}, skip:1 전달", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, { cursor: "msg-7" }),
      ctx
    );
    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "msg-7" });
    expect(args.skip).toBe(1);
  });

  it("미인증이면 401", async () => {
    mockAuth.mockResolvedValue(makeSession(null));
    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`),
      ctx
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it("일반 멤버(PARTICIPANT)는 403이고 메시지를 조회하지 않는다", async () => {
    mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "PARTICIPANT" });
    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`),
      ctx
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it("슈퍼어드민은 멤버가 아니어도 조회 허용", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa-1", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`),
      ctx
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalled();
  });
});

describe("GET /api/spaces/[id]/admin/messages — 고급 필터(WI-030)", () => {
  it("필터 미지정 → where는 { spaceId }만 (무회귀)", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
    await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`), ctx);
    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ spaceId: SPACE_ID });
  });

  it("type 유효 → where.type 적용", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, { type: "WHISPER" }),
      ctx
    );
    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.where.type).toBe("WHISPER");
  });

  it("type 소문자 → 대문자 정규화 후 적용", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, { type: "whisper" }),
      ctx
    );
    expect(mockPrisma.chatMessage.findMany.mock.calls[0][0].where.type).toBe("WHISPER");
  });

  it("type 무효 → 400 INVALID_FILTER, prisma 미호출", async () => {
    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, { type: "BOGUS" }),
      ctx
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("INVALID_FILTER");
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it("날짜 범위 → where.createdAt { gte, lt }", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
    const start = "2026-06-23T00:00:00.000Z";
    const end = "2026-06-24T00:00:00.000Z";
    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, {
        startDate: start,
        endDate: end,
      }),
      ctx
    );
    const where = mockPrisma.chatMessage.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe(start);
    expect(where.createdAt.lt.toISOString()).toBe(end);
  });

  it("start >= end → 400, prisma 미호출", async () => {
    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, {
        startDate: "2026-06-24T00:00:00.000Z",
        endDate: "2026-06-23T00:00:00.000Z",
      }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it("필터 + cursor 공존 → where와 cursor 모두 전달(권한 밖 노출 불가)", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);
    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`, {
        type: "MESSAGE",
        cursor: "msg-5",
      }),
      ctx
    );
    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ spaceId: SPACE_ID, type: "MESSAGE" });
    expect(args.cursor).toEqual({ id: "msg-5" });
  });
});

describe("GET /api/spaces/[id]/admin/messages — archived 조회 가드 (WI-046)", () => {
  it("일반 OWNER는 ARCHIVED 스페이스 조회 차단(403 SPACE_NOT_ACTIVE), 메시지 미조회", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`),
      ctx
    );
    expect(res.status).toBe(403);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it("superAdmin은 ARCHIVED 스페이스도 감사 조회 허용(200)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa-1", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/messages`),
      ctx
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalled();
  });
});
