import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildJsonRequest,
  makeSession,
  readJson,
} from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma, mockDispatch } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    spaceEventLog: { create: vi.fn() },
  },
  mockDispatch: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/features/space/enforce", () => ({ dispatchEnforcement: mockDispatch }));

import { PATCH } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.spaceMember.update.mockReset();
  mockPrisma.spaceMember.delete.mockReset();
  mockPrisma.spaceEventLog.create.mockReset();
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue({ enforced: false });
  mockPrisma.spaceEventLog.create.mockResolvedValue({});
});

describe("PATCH /api/spaces/[id]/admin/members — 응답 allowlist (WI-014)", () => {
  it("mute: update가 {id,role,restriction} select로 호출되고 응답 member에 restrictedBy 미노출", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false, name: "관리자" }));
    // 1) 호출자(self, OWNER) 2) 대상(target, PARTICIPANT, userId 있음)
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" })
      .mockResolvedValueOnce({
        id: "m-target",
        spaceId: SPACE_ID,
        role: "PARTICIPANT",
        userId: "u-target",
        displayName: "타겟",
        user: { name: "타겟" },
      });
    mockPrisma.spaceMember.update.mockResolvedValue({
      id: "m-target",
      role: "PARTICIPANT",
      restriction: "MUTED",
    });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m-target",
        action: "mute",
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
    expect(updateArg.select).not.toHaveProperty("restrictedBy");
    // 쓰기(data)에는 restrictedBy 반영
    expect(updateArg.data.restrictedBy).toBe("owner-1");

    // (2) 응답 계약 보존 + member 내부 민감필드 부재
    const body = await readJson<{ member: Record<string, unknown>; realtimeEnforced: boolean }>(res);
    expect(Object.keys(body).sort()).toEqual(["member", "realtimeEnforced"]);
    expect(Object.keys(body.member).sort()).toEqual(["id", "restriction", "role"]);
    expect(body.member).not.toHaveProperty("restrictedBy");
  });

  it("미인증이면 401이고 update 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m",
        action: "mute",
      }),
      ctx
    );

    expect(res.status).toBe(401);
    expect(mockPrisma.spaceMember.update).not.toHaveBeenCalled();
  });
});
