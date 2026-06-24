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
    spaceMember: { findUnique: vi.fn(), update: vi.fn() },
    space: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.spaceMember.update.mockReset();
  mockPrisma.space.findUnique.mockReset();
  // WI-046: 기본 ACTIVE(status 게이트 통과). archived 케이스는 개별 override.
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
});

describe("PATCH /api/spaces/[id]/members — 응답 allowlist (WI-014)", () => {
  it("update가 {id,role,restriction} select로 호출되고 restricted* 메타 미노출", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    // 1) 호출자 멤버십(OWNER) 2) 대상 멤버(PARTICIPANT)
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" })
      .mockResolvedValueOnce({ id: "m-target", spaceId: SPACE_ID, role: "PARTICIPANT" });
    // select가 반환하는 형태(관리 메타 없음)를 모킹
    mockPrisma.spaceMember.update.mockResolvedValue({
      id: "m-target",
      role: "PARTICIPANT",
      restriction: "MUTED",
    });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/members`, "PATCH", {
        memberId: "m-target",
        restriction: "MUTED",
        restrictedReason: "스팸",
      }),
      ctx
    );

    expect(res.status).toBe(200);

    // (1) 결정적 변이검증: update select 키 집합
    const updateArg = mockPrisma.spaceMember.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
      select: Record<string, boolean>;
    };
    expect(Object.keys(updateArg.select).sort()).toEqual(["id", "restriction", "role"]);
    for (const leaked of ["restrictedBy", "restrictedReason", "restrictedUntil", "userId", "guestSessionId"]) {
      expect(updateArg.select).not.toHaveProperty(leaked);
    }
    // 쓰기(data)에는 restrictedBy/Reason이 반영됨(읽기에서만 차단)
    expect(updateArg.data.restrictedBy).toBe("owner-1");

    // (2) 응답 본문 민감필드 부재
    const body = await readJson<Record<string, unknown>>(res);
    expect(Object.keys(body).sort()).toEqual(["id", "restriction", "role"]);
    for (const leaked of ["restrictedBy", "restrictedReason", "restrictedUntil"]) {
      expect(body).not.toHaveProperty(leaked);
    }
  });

  it("미인증이면 401이고 update 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/members`, "PATCH", { memberId: "m" }),
      ctx
    );

    expect(res.status).toBe(401);
    expect(mockPrisma.spaceMember.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/spaces/[id]/members — archived 가드 (WI-046)", () => {
  it("ARCHIVED 스페이스는 OWNER여도 403 SPACE_NOT_ACTIVE, 대상 조회/update 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    // 호출자 멤버십(OWNER)만 조회됨 — status 게이트가 대상 조회 전에 막는다.
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/members`, "PATCH", {
        memberId: "m-target",
        restriction: "MUTED",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
    // 호출자 멤버십(1회)만 조회 — 대상 멤버 조회는 status 게이트 이후라 미발생
    expect(mockPrisma.spaceMember.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.spaceMember.update).not.toHaveBeenCalled();
  });

  it("ARCHIVED 스페이스는 superAdmin이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/members`, "PATCH", {
        memberId: "m-target",
        restriction: "BANNED",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.spaceMember.update).not.toHaveBeenCalled();
  });
});
