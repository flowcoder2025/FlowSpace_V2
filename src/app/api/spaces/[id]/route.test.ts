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
    space: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  mockDispatch: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/features/space/enforce", () => ({ dispatchEnforcement: mockDispatch }));

import { PATCH, DELETE } from "./route";

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
  mockPrisma.space.updateMany.mockReset();
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue({ enforced: true, affectedSockets: 0 });
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

describe("DELETE /api/spaces/[id] — 인증·인가 가드 (WI-036)", () => {
  it("미인증이면 401이고 prisma/enforce를 건드리지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession(null));

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    expect(res.status).toBe(401);
    expect(mockPrisma.space.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.space.updateMany).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("존재하지 않는 공간이면 404", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.space.findUnique.mockResolvedValue(null);

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    expect(res.status).toBe(404);
    expect(mockPrisma.space.updateMany).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("오너도 슈퍼어드민도 아니면 403이고 archive/enforce 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "intruder", isSuperAdmin: false }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    expect(res.status).toBe(403);
    expect(mockPrisma.space.updateMany).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("권한 판정용 findUnique는 ownerId만 select(전체행 미조회)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    mockPrisma.space.updateMany.mockResolvedValue({ count: 1 });

    await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    const findArg = mockPrisma.space.findUnique.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(Object.keys(findArg.select).sort()).toEqual(["id", "ownerId"]);
  });
});

describe("DELETE /api/spaces/[id] — 최초 행위자 보존 + archive 추방 (WI-036)", () => {
  it("최초 archive: updateMany가 status!=ARCHIVED 조건 + deletedBy/deletedAt 기록", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false, name: "오너" }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    mockPrisma.space.updateMany.mockResolvedValue({ count: 1 });

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    expect(res.status).toBe(200);
    const arg = mockPrisma.space.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    // 조건부 원자 갱신 — 이미 ARCHIVED면 미적용
    expect(arg.where).toEqual({ id: SPACE_ID, status: { not: "ARCHIVED" } });
    expect(arg.data.status).toBe("ARCHIVED");
    expect(arg.data.deletedBy).toBe("owner-1");
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
  });

  it("재삭제(이미 ARCHIVED, count=0)도 200이고 기존 행위자 보존(update 미호출)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true, name: "슈퍼" }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    mockPrisma.space.updateMany.mockResolvedValue({ count: 0 }); // 이미 archived

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    expect(res.status).toBe(200);
    // PATCH용 update는 절대 호출되지 않음(deletedBy 덮어쓰기 경로 부재)
    expect(mockPrisma.space.update).not.toHaveBeenCalled();
    // 멱등: enforce는 여전히 dispatch(살아있는 소켓 정리)
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it("DB 갱신 후 archive enforce를 dispatch(userId 없음·actorName 전달)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false, name: "오너" }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    mockPrisma.space.updateMany.mockResolvedValue({ count: 1 });
    mockDispatch.mockResolvedValue({ enforced: true, affectedSockets: 2 });

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    expect(mockDispatch).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      action: "archive",
      actorName: "오너",
    });
    const body = await readJson<{ message: string; realtimeEnforced: boolean }>(res);
    expect(body.realtimeEnforced).toBe(true);
  });

  it("enforce 전파 실패(enforced=false)여도 archive 자체는 200 성공", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    mockPrisma.space.updateMany.mockResolvedValue({ count: 1 });
    mockDispatch.mockResolvedValue({ enforced: false, reason: "not_configured" });

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    expect(res.status).toBe(200);
    const body = await readJson<{ realtimeEnforced: boolean }>(res);
    expect(body.realtimeEnforced).toBe(false);
  });

  it("응답에 deletedBy 등 감사 메타가 노출되지 않는다", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", isSuperAdmin: false }));
    mockPrisma.space.findUnique.mockResolvedValue({ id: SPACE_ID, ownerId: "owner-1" });
    mockPrisma.space.updateMany.mockResolvedValue({ count: 1 });

    const res = await DELETE(buildJsonRequest(`/api/spaces/${SPACE_ID}`, "DELETE", {}), ctx);

    const body = await readJson<Record<string, unknown>>(res);
    expect(Object.keys(body).sort()).toEqual(["message", "realtimeEnforced"]);
    for (const leaked of ["deletedBy", "deletedAt", "ownerId", "accessSecret"]) {
      expect(body).not.toHaveProperty(leaked);
    }
  });
});
