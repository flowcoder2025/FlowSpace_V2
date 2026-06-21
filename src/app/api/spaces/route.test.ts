import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildGetRequest,
  buildJsonRequest,
  makeSession,
  makeSpaceRow,
  readJson,
} from "@/__tests__/helpers/api-route";

// ============================================
// auth()/prisma mock — vi.hoisted + vi.mock은 파일 로컬 호이스팅이라
// 라우트 import 전에 이 파일에서 직접 선언해야 한다 (하니스로 중앙화 불가).
// ============================================
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    space: { findMany: vi.fn(), create: vi.fn() },
    template: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, POST } from "./route";

interface SpacesResponse {
  spaces: Array<Record<string, unknown>>;
  nextCursor: string | null;
  hasMore: boolean;
}

/** 직전 findMany 호출의 인자(where/take/cursor/skip 등)를 꺼낸다. */
function lastFindManyArg(): Record<string, unknown> {
  const calls = mockPrisma.space.findMany.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.space.findMany.mockReset();
  mockPrisma.space.create.mockReset();
  mockPrisma.template.findUnique.mockReset();
  // 기본: 빈 결과
  mockPrisma.space.findMany.mockResolvedValue([]);
});

describe("GET /api/spaces — 인증 가드", () => {
  it("미인증이면 401이고 prisma를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await GET(buildGetRequest("/api/spaces"));

    expect(res.status).toBe(401);
    expect(mockPrisma.space.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/spaces — filter → scope 분기", () => {
  it("filter=owned → where.ownerId === 본인 (status ACTIVE)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1" }));

    const res = await GET(buildGetRequest("/api/spaces", { filter: "owned" }));

    expect(res.status).toBe(200);
    expect(lastFindManyArg().where).toEqual({
      ownerId: "u1",
      status: "ACTIVE",
    });
  });

  it("filter=joined → where.members.some.userId === 본인 (status ACTIVE)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1" }));

    await GET(buildGetRequest("/api/spaces", { filter: "joined" }));

    expect(lastFindManyArg().where).toEqual({
      members: { some: { userId: "u1" } },
      status: "ACTIVE",
    });
  });

  it("filter 미지정 + 일반 사용자 → 멤버십 scope", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: false }));

    await GET(buildGetRequest("/api/spaces"));

    expect(lastFindManyArg().where).toEqual({
      members: { some: { userId: "u1" } },
      status: "ACTIVE",
    });
  });

  it("filter 미지정 + 슈퍼어드민 → 전역(ACTIVE 전체, ownerId/members 없음)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "admin", isSuperAdmin: true }));

    await GET(buildGetRequest("/api/spaces"));

    expect(lastFindManyArg().where).toEqual({ status: "ACTIVE" });
  });

  it("filter=all + 일반 사용자 → 멤버십 scope (전역 아님 — 권한 격리)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: false }));

    await GET(buildGetRequest("/api/spaces", { filter: "all" }));

    // 일반 사용자는 filter=all 이어도 본인 멤버십으로 제한되어야 한다.
    expect(lastFindManyArg().where).toEqual({
      members: { some: { userId: "u1" } },
      status: "ACTIVE",
    });
  });

  it("filter=all + 슈퍼어드민 → 전역(ACTIVE 전체)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "admin", isSuperAdmin: true }));

    await GET(buildGetRequest("/api/spaces", { filter: "all" }));

    expect(lastFindManyArg().where).toEqual({ status: "ACTIVE" });
  });

  it("미허용 filter → 400 INVALID_FILTER 이고 prisma를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: true }));

    const res = await GET(buildGetRequest("/api/spaces", { filter: "bogus" }));

    expect(res.status).toBe(400);
    const body = await readJson<{ code?: string }>(res);
    expect(body.code).toBe("INVALID_FILTER");
    expect(mockPrisma.space.findMany).not.toHaveBeenCalled();
  });

  it("모든 정상 scope에 status: ACTIVE가 항상 부착된다", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: true }));

    for (const filter of ["owned", "joined", "all"]) {
      mockPrisma.space.findMany.mockClear();
      await GET(buildGetRequest("/api/spaces", { filter }));
      expect(lastFindManyArg().where).toMatchObject({ status: "ACTIVE" });
    }
  });
});

describe("GET /api/spaces — 페이지네이션 인자", () => {
  it("limit/cursor → take=limit+1, cursor:{id}, skip:1 전달 + 응답 trimming", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: true }));
    // limit=2 인데 3건(=limit+1) 반환 → hasMore true, 마지막 1건 잘림
    mockPrisma.space.findMany.mockResolvedValue([
      makeSpaceRow({ id: "a" }),
      makeSpaceRow({ id: "b" }),
      makeSpaceRow({ id: "c" }),
    ]);

    const res = await GET(
      buildGetRequest("/api/spaces", { limit: "2", cursor: "abc" })
    );

    const arg = lastFindManyArg();
    expect(arg.take).toBe(3);
    expect(arg.cursor).toEqual({ id: "abc" });
    expect(arg.skip).toBe(1);

    const body = await readJson<SpacesResponse>(res);
    expect(body.spaces).toHaveLength(2);
    expect(body.spaces.map((s) => s.id)).toEqual(["a", "b"]);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("b");
  });

  it("cursor 미지정 → 기본 limit(50) take=51, cursor/skip 미전달", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: true }));

    await GET(buildGetRequest("/api/spaces"));

    const arg = lastFindManyArg();
    expect(arg.take).toBe(51);
    expect(arg.cursor).toBeUndefined();
    expect(arg.skip).toBeUndefined();
  });

  it("cursor가 있어도 where에 scope/status가 보존된다 (cursor가 scope를 대체하지 않음)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: false }));

    await GET(
      buildGetRequest("/api/spaces", { filter: "owned", cursor: "forged" })
    );

    const arg = lastFindManyArg();
    expect(arg.where).toEqual({ ownerId: "u1", status: "ACTIVE" });
    expect(arg.cursor).toEqual({ id: "forged" });
  });
});

describe("GET /api/spaces — 응답 매핑 allowlist", () => {
  it("민감/내부 필드(inviteCode·accessSecret·ownerId·status)를 노출하지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: true }));
    mockPrisma.space.findMany.mockResolvedValue([
      makeSpaceRow({ id: "a", role: "OWNER", memberCount: 7 }),
    ]);

    const res = await GET(buildGetRequest("/api/spaces"));
    const body = await readJson<SpacesResponse>(res);
    const space = body.spaces[0];

    // 노출되어야 하는 매핑 필드
    expect(space).toMatchObject({
      id: "a",
      memberCount: 7,
      myRole: "OWNER",
      template: { key: "OFFICE", name: "오피스" },
    });
    // 노출되면 안 되는 필드 (회귀 가드)
    expect(space).not.toHaveProperty("inviteCode");
    expect(space).not.toHaveProperty("accessSecret");
    expect(space).not.toHaveProperty("ownerId");
    expect(space).not.toHaveProperty("status");
    expect(space).not.toHaveProperty("_count");
    expect(space).not.toHaveProperty("members");
  });

  it("비멤버 행은 myRole이 null로 매핑된다", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "admin", isSuperAdmin: true }));
    mockPrisma.space.findMany.mockResolvedValue([
      makeSpaceRow({ id: "a", role: null }),
    ]);

    const res = await GET(buildGetRequest("/api/spaces"));
    const body = await readJson<SpacesResponse>(res);

    expect(body.spaces[0].myRole).toBeNull();
  });
});

describe("POST /api/spaces — superAdmin 생성 가드", () => {
  it("비-슈퍼어드민은 body/prisma 접근 전에 403 SUPER_ADMIN_REQUIRED", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1", isSuperAdmin: false }));

    const res = await POST(
      buildJsonRequest("/api/spaces", "POST", {
        name: "새 공간",
        templateKey: "OFFICE",
      })
    );

    expect(res.status).toBe(403);
    const body = await readJson<{ code?: string }>(res);
    expect(body.code).toBe("SUPER_ADMIN_REQUIRED");
    expect(mockPrisma.template.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.space.create).not.toHaveBeenCalled();
  });
});
