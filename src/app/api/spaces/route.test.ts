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

  it("filter=owned + 슈퍼어드민 → 본인 소유로만 제한(전역화되지 않음)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "admin", isSuperAdmin: true }));

    await GET(buildGetRequest("/api/spaces", { filter: "owned" }));

    // 슈퍼어드민이라도 명시적 owned 필터는 전역이 아닌 본인 소유로 좁혀야 한다.
    expect(lastFindManyArg().where).toEqual({
      ownerId: "admin",
      status: "ACTIVE",
    });
  });

  it("filter=joined + 슈퍼어드민 → 본인 멤버십으로만 제한(전역화되지 않음)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "admin", isSuperAdmin: true }));

    await GET(buildGetRequest("/api/spaces", { filter: "joined" }));

    expect(lastFindManyArg().where).toEqual({
      members: { some: { userId: "admin" } },
      status: "ACTIVE",
    });
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

    // 정확한 key 집합 단언 — 추가/누락 어느 쪽이든 회귀를 검출한다.
    // (fixture에 담긴 inviteCode/accessSecret/ownerId/status/templateId/updatedAt/
    //  _count/members 등 raw row 필드가 응답에 새지 않음을 한 번에 보장)
    expect(Object.keys(space).sort()).toEqual(
      [
        "accessType",
        "createdAt",
        "description",
        "id",
        "logoUrl",
        "maxUsers",
        "memberCount",
        "myRole",
        "name",
        "primaryColor",
        "template",
      ].sort()
    );

    // 민감/내부 필드는 명시적으로도 부재 확인 (가독성·의도 명시)
    for (const leaked of [
      "inviteCode",
      "accessSecret",
      "ownerId",
      "status",
      "templateId",
      "updatedAt",
      "_count",
      "members",
    ]) {
      expect(space).not.toHaveProperty(leaked);
    }
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

  it("미인증이면 401이고 prisma를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await POST(
      buildJsonRequest("/api/spaces", "POST", { name: "x", templateKey: "OFFICE" })
    );

    expect(res.status).toBe(401);
    expect(mockPrisma.template.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.space.create).not.toHaveBeenCalled();
  });

  it("name 또는 templateKey 누락 시 400 (code 없음) + template 미조회", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa-1", isSuperAdmin: true }));

    const res = await POST(
      buildJsonRequest("/api/spaces", "POST", { name: "이름만" }) // templateKey 누락
    );

    expect(res.status).toBe(400);
    const body = await readJson<{ error: string; code?: string }>(res);
    expect(body.error).toBe("name, templateKey are required");
    expect(body.code).toBeUndefined(); // INVALID_FILTER와 달리 POST 400은 code 없음
    expect(mockPrisma.template.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.space.create).not.toHaveBeenCalled();
  });

  it("존재하지 않는 templateKey면 404이고 space.create 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa-1", isSuperAdmin: true }));
    mockPrisma.template.findUnique.mockResolvedValue(null);

    const res = await POST(
      buildJsonRequest("/api/spaces", "POST", { name: "새 공간", templateKey: "NOPE" })
    );

    expect(res.status).toBe(404);
    const body = await readJson<{ error: string }>(res);
    expect(body.error).toBe("Template not found");
    expect(mockPrisma.space.create).not.toHaveBeenCalled();
  });

  it("정상 생성 시 201 + create가 ownerId/OWNER 멤버로 호출되고 응답 allowlist(inviteCode 미노출)", async () => {
    mockAuth.mockResolvedValue(
      makeSession({ id: "sa-1", isSuperAdmin: true, name: "관리자" })
    );
    mockPrisma.template.findUnique.mockResolvedValue({ id: "tpl-1", key: "OFFICE" });
    // raw row에 inviteCode가 있어도 응답으로 새지 않아야 한다 (WI-014 allowlist 회귀 가드).
    mockPrisma.space.create.mockResolvedValue({
      id: "sp-new",
      name: "새 공간",
      inviteCode: "INV-1",
      template: { key: "OFFICE", name: "오피스" },
    });

    const res = await POST(
      buildJsonRequest("/api/spaces", "POST", {
        name: "새 공간",
        templateKey: "OFFICE",
      })
    );

    expect(res.status).toBe(201);
    const body = await readJson<Record<string, unknown>>(res);
    // 응답 키 집합 — inviteCode 등 민감 필드 미노출 (GET 목록 allowlist 정책과 정합)
    expect(Object.keys(body).sort()).toEqual(["id", "name", "template"]);
    expect(body).not.toHaveProperty("inviteCode");
    expect(body).toMatchObject({
      id: "sp-new",
      name: "새 공간",
      template: { key: "OFFICE", name: "오피스" },
    });

    // create 인자: 세션 userId가 ownerId + OWNER 멤버로 생성
    const createArg = mockPrisma.space.create.mock.calls[0][0] as {
      data: {
        ownerId: string;
        templateId: string;
        members: { create: { userId: string; role: string } };
      };
    };
    expect(createArg.data.ownerId).toBe("sa-1");
    expect(createArg.data.templateId).toBe("tpl-1");
    expect(createArg.data.members.create.role).toBe("OWNER");
    expect(createArg.data.members.create.userId).toBe("sa-1");
  });

  it("space.create 실패 시 500 폴백 (Failed to create space)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa-1", isSuperAdmin: true }));
    mockPrisma.template.findUnique.mockResolvedValue({ id: "tpl-1", key: "OFFICE" });
    mockPrisma.space.create.mockRejectedValue(new Error("db down"));

    const res = await POST(
      buildJsonRequest("/api/spaces", "POST", {
        name: "새 공간",
        templateKey: "OFFICE",
      })
    );

    expect(res.status).toBe(500);
    const body = await readJson<{ error: string }>(res);
    expect(body.error).toBe("Failed to create space");
  });
});

describe("GET /api/spaces — 500 폴백", () => {
  it("findMany 실패 시 500 (Failed to fetch spaces)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "u1" }));
    mockPrisma.space.findMany.mockRejectedValue(new Error("db down"));

    const res = await GET(buildGetRequest("/api/spaces"));

    expect(res.status).toBe(500);
    const body = await readJson<{ error: string }>(res);
    expect(body.error).toBe("Failed to fetch spaces");
  });
});
