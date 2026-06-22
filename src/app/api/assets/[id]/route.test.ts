import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSession, readJson } from "@/__tests__/helpers/api-route";

// ============================================
// auth()/prisma mock — vi.hoisted + vi.mock은 파일 로컬 호이스팅이라
// 라우트 import 전에 이 파일에서 직접 선언해야 한다 (하니스로 중앙화 불가).
// ============================================
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    generatedAsset: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

/** params는 Promise — route 시그니처에 맞춰 래핑한다. */
function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/**
 * prisma.generatedAsset.findUnique가 반환하는 select 결과 fixture.
 * 응답 allowlist 회귀를 위해 metadata에 민감 필드(prompt/workflow/comfyuiJobId)를
 * 의도적으로 중복 저장한다 (generate/batch 라우트의 실제 저장 형태 재현).
 */
function makeAssetSelectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    userId: "owner-1",
    type: "CHARACTER",
    name: "전사",
    status: "COMPLETED",
    filePath: "/assets/generated/characters/x.png",
    thumbnailPath: "/assets/generated/thumbnails/x.png",
    fileSize: 9999,
    isShared: false,
    metadata: {
      width: 1024,
      height: 1024,
      frameWidth: 128,
      frameHeight: 128,
      format: "png",
      prompt: "secret prompt",
      workflow: "character-default",
      comfyuiJobId: "comfy-job-xyz",
      accessSecret: "should-never-leak",
      batchId: "batch-9",
    },
    createdAt: new Date("2026-06-22T00:00:00.000Z"),
    updatedAt: new Date("2026-06-22T00:01:00.000Z"),
    user: { id: "owner-1", name: "홍길동" },
    ...overrides,
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.generatedAsset.findUnique.mockReset();
});

describe("GET /api/assets/[id] — 인증/인가 가드", () => {
  it("미인증이면 401이고 prisma를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await GET(new Request("http://localhost"), routeCtx("asset-1"));

    expect(res.status).toBe(401);
    expect(mockPrisma.generatedAsset.findUnique).not.toHaveBeenCalled();
  });

  it("자산이 없으면 404", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.generatedAsset.findUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), routeCtx("nope"));

    expect(res.status).toBe(404);
  });

  it("타인 소유 자산을 일반 사용자가 요청하면 403", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "other-user" }));
    mockPrisma.generatedAsset.findUnique.mockResolvedValue(makeAssetSelectRow());

    const res = await GET(new Request("http://localhost"), routeCtx("asset-1"));

    expect(res.status).toBe(403);
  });

  it("superAdmin은 타인 소유 자산도 200으로 조회한다", async () => {
    mockAuth.mockResolvedValue(
      makeSession({ id: "admin-1", isSuperAdmin: true })
    );
    mockPrisma.generatedAsset.findUnique.mockResolvedValue(makeAssetSelectRow());

    const res = await GET(new Request("http://localhost"), routeCtx("asset-1"));

    expect(res.status).toBe(200);
  });
});

describe("GET /api/assets/[id] — 응답 allowlist", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
  });

  it("본인 소유 자산은 정확히 공개 키 집합만 반환한다", async () => {
    mockPrisma.generatedAsset.findUnique.mockResolvedValue(makeAssetSelectRow());

    const res = await GET(new Request("http://localhost"), routeCtx("asset-1"));
    const body = await readJson<Record<string, unknown>>(res);

    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      [
        "createdAt",
        "fileSize",
        "filePath",
        "id",
        "isShared",
        "metadata",
        "name",
        "status",
        "thumbnailPath",
        "type",
        "updatedAt",
        "user",
      ].sort()
    );
  });

  it("민감/내부 필드(userId/prompt/workflow/comfyuiJobId)를 노출하지 않는다", async () => {
    mockPrisma.generatedAsset.findUnique.mockResolvedValue(makeAssetSelectRow());

    const res = await GET(new Request("http://localhost"), routeCtx("asset-1"));
    const body = await readJson<Record<string, unknown>>(res);

    expect(body.userId).toBeUndefined();
    expect(body.prompt).toBeUndefined();
    expect(body.workflow).toBeUndefined();
    expect(body.comfyuiJobId).toBeUndefined();
  });

  it("metadata 안의 민감 필드도 정규화로 제거된다 (우회 노출 차단)", async () => {
    mockPrisma.generatedAsset.findUnique.mockResolvedValue(makeAssetSelectRow());

    const res = await GET(new Request("http://localhost"), routeCtx("asset-1"));
    const body = await readJson<{ metadata: Record<string, unknown> }>(res);

    expect(body.metadata.frameWidth).toBe(128);
    expect(body.metadata.prompt).toBeUndefined();
    expect(body.metadata.workflow).toBeUndefined();
    expect(body.metadata.comfyuiJobId).toBeUndefined();
    expect(body.metadata.accessSecret).toBeUndefined();
    expect(body.metadata.batchId).toBeUndefined();
  });

  it("findUnique는 include가 아닌 select로 호출되고 userId를 권한판정용으로 fetch한다", async () => {
    mockPrisma.generatedAsset.findUnique.mockResolvedValue(makeAssetSelectRow());

    await GET(new Request("http://localhost"), routeCtx("asset-1"));

    const arg = mockPrisma.generatedAsset.findUnique.mock.calls[0][0] as {
      select?: Record<string, unknown>;
      include?: unknown;
    };
    expect(arg.include).toBeUndefined();
    expect(arg.select).toBeDefined();
    expect(arg.select?.userId).toBe(true);
    // 민감 필드는 애초에 select하지 않는다 (심층 방어)
    expect(arg.select?.prompt).toBeUndefined();
    expect(arg.select?.workflow).toBeUndefined();
    expect(arg.select?.comfyuiJobId).toBeUndefined();
  });
});

describe("GET /api/assets/[id] — 에러 처리", () => {
  it("prisma 예외 시 500 폴백 (원본 에러 미노출 — WI-023)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.generatedAsset.findUnique.mockRejectedValue(
      new Error("Invalid `prisma.generatedAsset.findUnique()` at /srv/app")
    );

    const res = await GET(new Request("http://localhost"), routeCtx("asset-1"));
    const body = await readJson<Record<string, unknown>>(res);

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("prisma.generatedAsset");
    expect(body.details).toBeUndefined();
    expect(body).toEqual({ error: "Failed to fetch asset" });
  });
});
