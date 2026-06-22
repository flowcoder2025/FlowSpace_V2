import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildJsonRequest,
  makeSession,
  readJson,
} from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    space: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

/** select 정책이 노출을 허용하는 정확한 키 집합 (WI-014 allowlist). */
const PATCH_ALLOWLIST = [
  "accessType",
  "createdAt",
  "description",
  "id",
  "loadingMessage",
  "logoUrl",
  "maxUsers",
  "name",
  "primaryColor",
  "status",
];

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.space.update.mockReset();
});

describe("PATCH /api/spaces/[id] — 인증·인가 가드", () => {
  it("미인증이면 401이고 prisma를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}`, "PATCH", { name: "x" }),
      ctx
    );

    expect(res.status).toBe(401);
    expect(mockPrisma.space.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.space.update).not.toHaveBeenCalled();
  });

  it("오너도 슈퍼어드민도 아니면 403이고 update 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "intruder", isSuperAdmin: false }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}`, "PATCH", { name: "x" }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.space.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/spaces/[id] — 응답 allowlist (WI-014)", () => {
  it("update가 민감필드 제외 select로 호출되고 응답에 accessSecret/inviteCode/ownerId 미노출", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    // select가 반환하는 형태(민감필드 없음)를 모킹
    mockPrisma.space.update.mockResolvedValue({
      id: SPACE_ID,
      name: "수정됨",
      description: "d",
      accessType: "PUBLIC",
      maxUsers: 50,
      status: "ACTIVE",
      logoUrl: null,
      primaryColor: "#000",
      loadingMessage: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}`, "PATCH", {
        name: "수정됨",
        accessSecret: "new-secret",
      }),
      ctx
    );

    expect(res.status).toBe(200);

    // (1) 결정적 변이검증: update가 allowlist select로 호출됐는가
    const updateArg = mockPrisma.space.update.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(Object.keys(updateArg.select).sort()).toEqual([...PATCH_ALLOWLIST].sort());
    for (const leaked of ["accessSecret", "inviteCode", "ownerId", "templateId", "mapData"]) {
      expect(updateArg.select).not.toHaveProperty(leaked);
    }

    // (2) 응답 본문에도 민감필드 부재
    const body = await readJson<Record<string, unknown>>(res);
    for (const leaked of ["accessSecret", "inviteCode", "ownerId"]) {
      expect(body).not.toHaveProperty(leaked);
    }
  });

  it("accessSecret은 data로 반영되더라도 응답 select에는 포함되지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    mockPrisma.space.update.mockResolvedValue({ id: SPACE_ID });

    await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}`, "PATCH", { accessSecret: "pw" }),
      ctx
    );

    const updateArg = mockPrisma.space.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
      select: Record<string, boolean>;
    };
    // 쓰기(data)에는 반영
    expect(updateArg.data.accessSecret).toBe("pw");
    // 읽기(select)에는 미포함
    expect(updateArg.select).not.toHaveProperty("accessSecret");
  });
});
