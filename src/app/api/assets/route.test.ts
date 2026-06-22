import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { buildGetRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

/** 중복 쿼리 파라미터(`?k=a&k=b`)를 표현하기 위한 raw-URL 요청 빌더. */
function buildRawRequest(query: string): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/assets?${query}`));
}

// ============================================
// auth()/prisma mock — vi.hoisted + vi.mock은 파일 로컬 호이스팅이라
// 라우트 import 전에 이 파일에서 직접 선언해야 한다 (하니스로 중앙화 불가).
// ============================================
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    generatedAsset: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

/** WI-021 목록 응답 공개 키 집합 (lean DTO). */
const LIST_ITEM_KEYS = [
  "id",
  "type",
  "name",
  "status",
  "filePath",
  "thumbnailPath",
  "createdAt",
  "updatedAt",
] as const;

/**
 * prisma.generatedAsset.findMany가 반환하는 행 fixture.
 * 응답/ select allowlist 회귀를 위해, 노출되면 안 되는 민감/내부 필드
 * (prompt/workflow/comfyuiJobId/userId/metadata/user/fileSize/isShared)를
 * 의도적으로 포함한다 — findMany는 mock이라 select와 무관하게 이 행을 그대로
 * 돌려주므로, 응답에서 빠지면 transform(toPublicAssetListItem)의 심층 방어가 실증된다.
 */
function makeAssetListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    userId: "owner-1",
    type: "CHARACTER",
    name: "전사",
    status: "COMPLETED",
    filePath: "/assets/generated/characters/x.png",
    thumbnailPath: "/assets/generated/thumbnails/x.png",
    createdAt: new Date("2026-06-22T00:00:00.000Z"),
    updatedAt: new Date("2026-06-22T00:01:00.000Z"),
    // ↓ 응답/select에서 제외돼야 하는 민감/내부 필드 (회귀 가드)
    prompt: "secret prompt",
    workflow: "character-default",
    comfyuiJobId: "comfy-job-xyz",
    fileSize: 9999,
    isShared: false,
    metadata: {
      width: 1024,
      frameWidth: 128,
      prompt: "secret prompt in metadata",
      accessSecret: "should-never-leak",
    },
    user: { id: "owner-1", name: "홍길동" },
    ...overrides,
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.generatedAsset.findMany.mockReset();
  mockPrisma.generatedAsset.count.mockReset();
});

describe("GET /api/assets — 인증 가드", () => {
  it("미인증이면 401이고 prisma를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await GET(buildGetRequest("/api/assets"));

    expect(res.status).toBe(401);
    expect(mockPrisma.generatedAsset.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.generatedAsset.count).not.toHaveBeenCalled();
  });
});

describe("GET /api/assets — owner 분기 (shared 미지정)", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.generatedAsset.findMany.mockResolvedValue([makeAssetListRow()]);
    mockPrisma.generatedAsset.count.mockResolvedValue(1);
  });

  it("본인 자산만 조회한다 (where.userId = session.id, isShared 미포함)", async () => {
    await GET(buildGetRequest("/api/assets"));

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.userId).toBe("owner-1");
    expect(arg.where.isShared).toBeUndefined();
  });

  it("각 항목은 정확히 lean 공개 키 집합만 반환한다", async () => {
    const res = await GET(buildGetRequest("/api/assets"));
    const body = await readJson<{ assets: Record<string, unknown>[] }>(res);

    expect(res.status).toBe(200);
    expect(body.assets).toHaveLength(1);
    expect(Object.keys(body.assets[0]).sort()).toEqual(
      [...LIST_ITEM_KEYS].sort()
    );
  });

  it("민감/내부 필드를 노출하지 않는다 (transform 심층 방어)", async () => {
    const res = await GET(buildGetRequest("/api/assets"));
    const body = await readJson<{ assets: Record<string, unknown>[] }>(res);
    const item = body.assets[0];

    expect(item.prompt).toBeUndefined();
    expect(item.workflow).toBeUndefined();
    expect(item.comfyuiJobId).toBeUndefined();
    expect(item.userId).toBeUndefined();
    expect(item.metadata).toBeUndefined();
    expect(item.user).toBeUndefined();
    expect(item.fileSize).toBeUndefined();
    expect(item.isShared).toBeUndefined();
  });

  it("findMany는 민감/내부 필드를 애초에 select하지 않는다 (쿼리 단 방어)", async () => {
    await GET(buildGetRequest("/api/assets"));

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      select?: Record<string, unknown>;
    };
    expect(arg.select).toBeDefined();
    expect(Object.keys(arg.select!).sort()).toEqual([...LIST_ITEM_KEYS].sort());
    expect(arg.select?.prompt).toBeUndefined();
    expect(arg.select?.workflow).toBeUndefined();
    expect(arg.select?.comfyuiJobId).toBeUndefined();
    expect(arg.select?.metadata).toBeUndefined();
    expect(arg.select?.user).toBeUndefined();
    expect(arg.select?.userId).toBeUndefined();
  });
});

describe("GET /api/assets — shared=true 분기 (타인 공유 자산)", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession({ id: "viewer-1" }));
    // 타인(other-user) 소유 + isShared:true 자산이 반환되는 상황
    mockPrisma.generatedAsset.findMany.mockResolvedValue([
      makeAssetListRow({
        userId: "other-user",
        isShared: true,
        user: { id: "other-user", name: "타인생성자" },
      }),
    ]);
    mockPrisma.generatedAsset.count.mockResolvedValue(1);
  });

  it("isShared=true로 조회하고 where.userId로 본인 제한을 걸지 않는다", async () => {
    await GET(buildGetRequest("/api/assets", { shared: "true" }));

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.isShared).toBe(true);
    expect(arg.where.userId).toBeUndefined();
  });

  it("타인 공유 자산도 lean 키만 반환하고 소유자/민감 정보를 노출하지 않는다", async () => {
    const res = await GET(buildGetRequest("/api/assets", { shared: "true" }));
    const body = await readJson<{ assets: Record<string, unknown>[] }>(res);
    const item = body.assets[0];

    expect(Object.keys(item).sort()).toEqual([...LIST_ITEM_KEYS].sort());
    // 타인 생성자 정보 미노출 (codex consult: shared 분기 user/metadata 비노출)
    expect(item.user).toBeUndefined();
    expect(item.userId).toBeUndefined();
    expect(item.metadata).toBeUndefined();
    expect(item.prompt).toBeUndefined();
  });
});

describe("GET /api/assets — 필터/페이지네이션 전달", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.generatedAsset.findMany.mockResolvedValue([]);
    mockPrisma.generatedAsset.count.mockResolvedValue(0);
  });

  it("type/status 필터를 대문자로 where에 반영한다", async () => {
    await GET(
      buildGetRequest("/api/assets", { type: "character", status: "completed" })
    );

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.type).toBe("CHARACTER");
    expect(arg.where.status).toBe("COMPLETED");
  });

  it("page/limit로 skip/take를 계산한다", async () => {
    await GET(buildGetRequest("/api/assets", { page: "2", limit: "10" }));

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      skip: number;
      take: number;
    };
    expect(arg.skip).toBe(10);
    expect(arg.take).toBe(10);
  });

  it("count는 findMany와 동일한 where로 호출된다", async () => {
    await GET(buildGetRequest("/api/assets", { shared: "true" }));

    const findArg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    const countArg = mockPrisma.generatedAsset.count.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(countArg.where).toEqual(findArg.where);
  });

  it("pagination 메타데이터를 응답에 포함한다", async () => {
    mockPrisma.generatedAsset.count.mockResolvedValue(25);

    const res = await GET(buildGetRequest("/api/assets", { limit: "10" }));
    const body = await readJson<{
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(res);

    expect(body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });
});

describe("GET /api/assets — 입력 검증 (WI-022)", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.generatedAsset.findMany.mockResolvedValue([]);
    mockPrisma.generatedAsset.count.mockResolvedValue(0);
  });

  it("잘못된 type → 400 INVALID_FILTER, prisma 미접근", async () => {
    const res = await GET(buildGetRequest("/api/assets", { type: "weapon" }));
    const body = await readJson<{ error: string; code: string }>(res);

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_FILTER");
    expect(mockPrisma.generatedAsset.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.generatedAsset.count).not.toHaveBeenCalled();
  });

  it("잘못된 status → 400 INVALID_FILTER, prisma 미접근", async () => {
    const res = await GET(buildGetRequest("/api/assets", { status: "compelted" }));
    const body = await readJson<{ code: string }>(res);

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_FILTER");
    expect(mockPrisma.generatedAsset.findMany).not.toHaveBeenCalled();
  });

  it("소문자 status=completed는 정상 통과한다 (asset-loader 소비처 무회귀)", async () => {
    const res = await GET(buildGetRequest("/api/assets", { status: "completed" }));

    expect(res.status).toBe(200);
    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.status).toBe("COMPLETED");
  });

  it("모든 AssetType enum 값을 허용한다", async () => {
    for (const t of ["character", "tileset", "object", "map"]) {
      mockPrisma.generatedAsset.findMany.mockClear();
      const res = await GET(buildGetRequest("/api/assets", { type: t }));
      expect(res.status).toBe(200);
      const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(arg.where.type).toBe(t.toUpperCase());
    }
  });

  it("앞뒤 공백을 trim 후 검증한다", async () => {
    const res = await GET(
      buildGetRequest("/api/assets", { type: "  character  " })
    );

    expect(res.status).toBe(200);
    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.type).toBe("CHARACTER");
  });

  it("공백-only 값은 미지정과 동일 취급(필터 미적용, 400 아님)", async () => {
    // codex r1: trim 후 비면 빈값처럼 필터 미적용 — 400으로 거절하지 않는다.
    const res = await GET(buildGetRequest("/api/assets", { type: "   " }));

    expect(res.status).toBe(200);
    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.type).toBeUndefined();
  });

  it("중복 파라미터의 invalid 값도 검증한다 (getAll 전수 — 검증 우회 차단)", async () => {
    // codex r2: get()은 첫 값만 봐 invalid 2번째 값이 숨음 → getAll로 전수 검증.
    const resType = await GET(buildRawRequest("type=character&type=weapon"));
    expect(resType.status).toBe(400);

    const resStatus = await GET(
      buildRawRequest("status=COMPLETED&status=compelted")
    );
    expect(resStatus.status).toBe(400);

    expect(mockPrisma.generatedAsset.findMany).not.toHaveBeenCalled();
  });

  it("중복 파라미터가 모두 유효하면 첫 값으로 필터한다", async () => {
    const res = await GET(buildRawRequest("type=character&type=tileset"));

    expect(res.status).toBe(200);
    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where.type).toBe("CHARACTER");
  });

  it("limit 미지정 → take 20 (기존 default 보존)", async () => {
    await GET(buildGetRequest("/api/assets"));

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(arg.take).toBe(20);
  });

  it("과대 limit → 100으로 cap", async () => {
    await GET(buildGetRequest("/api/assets", { limit: "100000" }));

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(arg.take).toBe(100);
  });

  it("비정수 limit → 20으로 정규화", async () => {
    await GET(buildGetRequest("/api/assets", { limit: "abc" }));

    const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(arg.take).toBe(20);
  });

  it("page=0/음수/비정수 → 1로 클램프, skip은 음수가 되지 않는다", async () => {
    for (const p of ["0", "-5", "abc"]) {
      mockPrisma.generatedAsset.findMany.mockClear();
      await GET(buildGetRequest("/api/assets", { page: p, limit: "10" }));

      const arg = mockPrisma.generatedAsset.findMany.mock.calls[0][0] as {
        skip: number;
      };
      expect(arg.skip).toBe(0);
    }
  });

  it("응답 pagination.page는 정규화된 page를 반영한다", async () => {
    const res = await GET(buildGetRequest("/api/assets", { page: "-3" }));
    const body = await readJson<{ pagination: { page: number } }>(res);

    expect(body.pagination.page).toBe(1);
  });
});

describe("GET /api/assets — 에러 처리", () => {
  it("prisma 예외 시 500 폴백", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.generatedAsset.findMany.mockRejectedValue(new Error("db down"));
    mockPrisma.generatedAsset.count.mockResolvedValue(0);

    const res = await GET(buildGetRequest("/api/assets"));

    expect(res.status).toBe(500);
  });
});
