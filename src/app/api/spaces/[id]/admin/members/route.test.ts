import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildGetRequest,
  buildJsonRequest,
  makeSession,
  readJson,
} from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const { mockAuth, mockPrisma, mockDispatch, mockRemoveLiveKit } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    spaceEventLog: { create: vi.fn() },
    space: { findUnique: vi.fn() },
  },
  mockDispatch: vi.fn(),
  mockRemoveLiveKit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/features/space/enforce", () => ({ dispatchEnforcement: mockDispatch }));
vi.mock("@/features/space/livekit-moderation", () => ({
  removeSpaceParticipant: mockRemoveLiveKit,
}));

import { GET, PATCH } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.spaceMember.findMany.mockReset();
  mockPrisma.spaceMember.update.mockReset();
  mockPrisma.spaceMember.delete.mockReset();
  mockPrisma.spaceEventLog.create.mockReset();
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue({ enforced: false });
  mockRemoveLiveKit.mockReset();
  mockRemoveLiveKit.mockResolvedValue({ removed: true, reason: "removed" });
  mockPrisma.spaceEventLog.create.mockResolvedValue({});
  mockPrisma.space.findUnique.mockReset();
  // WI-046: 기본 ACTIVE(status 게이트 통과). archived 케이스는 개별 override.
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
});

/** PATCH 호출 시 호출자(OWNER) + 대상(PARTICIPANT) findUnique 시퀀스 셋업. */
function setupActorAndTarget(targetOverrides: Record<string, unknown> = {}) {
  mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false, name: "관리자" }));
  mockPrisma.spaceMember.findUnique
    .mockResolvedValueOnce({ role: "OWNER" })
    .mockResolvedValueOnce({
      id: "m-target",
      spaceId: SPACE_ID,
      role: "PARTICIPANT",
      userId: "u-target",
      displayName: "타겟",
      user: { name: "타겟" },
      ...targetOverrides,
    });
}

describe("GET /api/spaces/[id]/admin/members — 응답 allowlist (WI-014, onRefresh 경로 가드)", () => {
  it("findMany가 restricted*/guestSessionId/spaceId 제외 select로 호출된다", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
    mockPrisma.spaceMember.findMany.mockResolvedValue([]);

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/members`),
      ctx
    );
    expect(res.status).toBe(200);

    // 결정적 변이검증: include 복귀 또는 민감필드 재추가 시 FAIL
    const arg = mockPrisma.spaceMember.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(Object.keys(arg.select).sort()).toEqual(
      ["createdAt", "displayName", "guestSession", "id", "restriction", "role", "user", "userId"].sort()
    );
    for (const leaked of [
      "restrictedBy",
      "restrictedReason",
      "restrictedUntil",
      "guestSessionId",
      "spaceId",
      "updatedAt",
    ]) {
      expect(arg.select).not.toHaveProperty(leaked);
    }
    // 소비처 필수 필드는 보존 (member-table: user{...}/guestSession{...}, media-management: userId)
    expect(arg.select.user).toEqual({ select: { id: true, name: true, email: true, image: true } });
    expect(arg.select.userId).toBe(true);
  });

  it("멤버도 슈퍼어드민도 아니면 403이고 findMany 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "intruder", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);

    const res = await GET(
      buildGetRequest(`/api/spaces/${SPACE_ID}/admin/members`),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.spaceMember.findMany).not.toHaveBeenCalled();
  });
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

// WI-045: 강퇴/차단/해제 모델 — kick 멤버 미삭제(재입장 허용) + LiveKit 제거, ban LiveKit 제거,
// unban DB-only(enforce 미발송).
describe("PATCH — WI-045 강퇴/차단/해제 (kick·ban·unban)", () => {
  it("kick: 멤버를 삭제하지 않고 enforce kick + LiveKit removeSpaceParticipant 호출", async () => {
    setupActorAndTarget();

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m-target",
        action: "kick",
      }),
      ctx
    );

    expect(res.status).toBe(200);
    // 핵심: 멤버 행을 삭제하지 않는다(재입장 허용 — room.ts !member 게이트 회피).
    expect(mockPrisma.spaceMember.delete).not.toHaveBeenCalled();
    // 소켓 실시간 disconnect(enforce kick) + LiveKit 화상 제거.
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: SPACE_ID, userId: "u-target", action: "kick" })
    );
    expect(mockRemoveLiveKit).toHaveBeenCalledWith(SPACE_ID, "u-target");
    const body = await readJson<{ message: string }>(res);
    expect(body.message).toBe("Member kicked");
  });

  it("ban: restriction=BANNED 갱신 + enforce ban + LiveKit removeSpaceParticipant 호출", async () => {
    setupActorAndTarget();
    mockPrisma.spaceMember.update.mockResolvedValue({
      id: "m-target",
      role: "PARTICIPANT",
      restriction: "BANNED",
    });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m-target",
        action: "ban",
      }),
      ctx
    );

    expect(res.status).toBe(200);
    const updateArg = mockPrisma.spaceMember.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.restriction).toBe("BANNED");
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-target", action: "ban" })
    );
    expect(mockRemoveLiveKit).toHaveBeenCalledWith(SPACE_ID, "u-target");
  });

  it("unban: restriction=NONE 갱신 + enforce 미발송(DB-only) + LiveKit 미호출", async () => {
    setupActorAndTarget({ restriction: "BANNED" });
    mockPrisma.spaceMember.update.mockResolvedValue({
      id: "m-target",
      role: "PARTICIPANT",
      restriction: "NONE",
    });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m-target",
        action: "unban",
      }),
      ctx
    );

    expect(res.status).toBe(200);
    const updateArg = mockPrisma.spaceMember.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.restriction).toBe("NONE");
    // 차단 유저는 오프라인 → realtime enforce 불요.
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockRemoveLiveKit).not.toHaveBeenCalled();
    const body = await readJson<{ realtimeEnforced: boolean }>(res);
    expect(body.realtimeEnforced).toBe(false);
  });

  it("mute: LiveKit removeSpaceParticipant 미호출(채팅 제재는 화상 무관)", async () => {
    setupActorAndTarget();
    mockPrisma.spaceMember.update.mockResolvedValue({
      id: "m-target",
      role: "PARTICIPANT",
      restriction: "MUTED",
    });

    await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m-target",
        action: "mute",
      }),
      ctx
    );

    expect(mockRemoveLiveKit).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mute" })
    );
  });
});

describe("admin/members — archived 가드 (WI-046)", () => {
  it("PATCH: 일반 OWNER는 ARCHIVED 스페이스 제재 차단(403 SPACE_NOT_ACTIVE), 대상조회/update/enforce 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m-target",
        action: "ban",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
    // 호출자 멤버십(1회)만 — 대상 멤버 조회는 status 게이트 이후라 미발생
    expect(mockPrisma.spaceMember.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.spaceMember.update).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockRemoveLiveKit).not.toHaveBeenCalled();
  });

  it("PATCH: superAdmin이어도 ARCHIVED 제재 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await PATCH(
      buildJsonRequest(`/api/spaces/${SPACE_ID}/admin/members`, "PATCH", {
        memberId: "m-target",
        action: "kick",
      }),
      ctx
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.spaceMember.update).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("GET: 일반 OWNER는 ARCHIVED 조회 차단(403), superAdmin은 허용(200)", async () => {
    // 일반 OWNER → 차단
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER" });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    const blocked = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/members`), ctx);
    expect(blocked.status).toBe(403);
    expect(mockPrisma.spaceMember.findMany).not.toHaveBeenCalled();

    // superAdmin → 허용
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.spaceMember.findMany.mockResolvedValue([]);
    const allowed = await GET(buildGetRequest(`/api/spaces/${SPACE_ID}/admin/members`), ctx);
    expect(allowed.status).toBe(200);
    expect(mockPrisma.spaceMember.findMany).toHaveBeenCalled();
  });
});
