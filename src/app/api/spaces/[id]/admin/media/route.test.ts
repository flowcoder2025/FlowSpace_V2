import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildGetRequest, buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn() },
    space: { findUnique: vi.fn() },
    spotlightGrant: { findMany: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, POST } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.spotlightGrant.findMany.mockReset();
  mockPrisma.spotlightGrant.create.mockReset();
  mockPrisma.user.findMany.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
});

describe("admin/media — archived 가드 (WI-046)", () => {
  it("GET: 일반 OWNER는 ARCHIVED 조회 차단(403 SPACE_NOT_ACTIVE), grant 미조회", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/media`), ctx);

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.spotlightGrant.findMany).not.toHaveBeenCalled();
  });

  it("GET: superAdmin은 ARCHIVED도 감사 조회 허용(200)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    mockPrisma.spotlightGrant.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/media`), ctx);

    expect(res.status).toBe(200);
    expect(mockPrisma.spotlightGrant.findMany).toHaveBeenCalled();
  });

  it("POST: ARCHIVED는 OWNER여도 403, 권한부여(create) 미진입", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/media`, "POST", {
        targetUserId: "u-target",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.spotlightGrant.create).not.toHaveBeenCalled();
  });

  it("POST: ARCHIVED는 superAdmin이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/media`, "POST", {
        targetUserId: "u-target",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.spotlightGrant.create).not.toHaveBeenCalled();
  });
});
