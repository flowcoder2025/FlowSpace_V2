import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildGetRequest,
  makeSession,
  readJson,
} from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅(하니스 중앙화 불가, WI-011 합의)
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findFirst: vi.fn() },
    chatMessage: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

/** route의 select 형태를 반영한 chatMessage 행 fixture (createdAt은 Date). */
function makeMessageRow(i: number) {
  return {
    id: `msg-${i}`,
    senderId: `user-${i}`,
    senderType: "MEMBER",
    senderName: `닉네임${i}`,
    content: `내용 ${i}`,
    type: "GROUP",
    targetId: null,
    createdAt: new Date(`2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`),
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findFirst.mockReset();
  mockPrisma.chatMessage.findMany.mockReset();
  // 기본: 인증된 멤버
  mockAuth.mockResolvedValue(makeSession({ id: "user-1" }));
  mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-1" });
});

describe("GET /api/spaces/[id]/messages — cursor 페이지네이션(헬퍼 통일, WI-012-2 S5)", () => {
  it("기본 limit(50) → take:51, 응답 매핑/계약 보존(messages·nextCursor·hasMore)", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([makeMessageRow(1)]);

    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/messages`), ctx);
    expect(res.status).toBe(200);

    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.take).toBe(51); // parsePageLimit 기본 50 + 1
    expect(args.skip).toBeUndefined(); // cursor 없음 → skip 없음

    const body = await readJson<{
      messages: Array<Record<string, unknown>>;
      nextCursor: string | null;
      hasMore: boolean;
    }>(res);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    // 매핑 변환 보존: type 소문자, timestamp ISO, userId=senderId
    expect(body.messages).toEqual([
      {
        id: "msg-1",
        userId: "user-1",
        nickname: "닉네임1",
        content: "내용 1",
        type: "group",
        timestamp: "2026-01-01T00:00:01.000Z",
      },
    ]);
  });

  it("limit 초과분(limit+1) 존재 → hasMore=true, nextCursor=마지막 노출행 id, 여분 절단", async () => {
    // limit=2 요청 → take=3, 3행 반환 → 2행 노출 + hasMore
    const rows = [makeMessageRow(1), makeMessageRow(2), makeMessageRow(3)];
    mockPrisma.chatMessage.findMany.mockResolvedValue(rows);

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/messages`, { limit: "2" }),
      ctx
    );
    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.take).toBe(3);

    const body = await readJson<{
      messages: Array<{ id: string }>;
      nextCursor: string | null;
      hasMore: boolean;
    }>(res);
    expect(body.hasMore).toBe(true);
    expect(body.messages).toHaveLength(2); // 여분 1행 절단
    expect(body.nextCursor).toBe("msg-2"); // 노출된 마지막 행
  });

  it("cursor 지정 → findMany에 cursor:{id}, skip:1 전달", async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([]);

    await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/messages`, { cursor: "msg-9" }),
      ctx
    );
    const args = mockPrisma.chatMessage.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "msg-9" });
    expect(args.skip).toBe(1);
  });

  it("미인증이면 401이고 prisma를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/messages`), ctx);
    expect(res.status).toBe(401);
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it("비멤버면 403이고 메시지를 조회하지 않는다", async () => {
    mockPrisma.spaceMember.findFirst.mockResolvedValue(null);

    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/messages`), ctx);
    expect(res.status).toBe(403);
    expect(mockPrisma.chatMessage.findMany).not.toHaveBeenCalled();
  });
});
