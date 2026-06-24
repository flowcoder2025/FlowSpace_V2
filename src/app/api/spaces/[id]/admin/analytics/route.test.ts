import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildGetRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn() },
    space: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
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
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.$queryRaw.mockReset();
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
  mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
});

describe("GET /api/spaces/[id]/admin/analytics — archived 조회 가드 (WI-046)", () => {
  it("일반 OWNER는 ARCHIVED 조회 차단(403 SPACE_NOT_ACTIVE), 집계쿼리 미실행", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/analytics`), ctx);

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("superAdmin은 ARCHIVED도 감사 조회 허용(200)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const res = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/analytics`), ctx);

    expect(res.status).toBe(200);
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });
});
