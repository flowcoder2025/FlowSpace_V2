import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildJsonRequest, makeSession, readJson } from "@/__tests__/helpers/api-route";

// vi.mock 프리앰블 — 파일 로컬 호이스팅
const {
  mockAuth,
  mockPrisma,
  mockGetParticipant,
  mockUpdateParticipant,
  mockMutePublishedTrack,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findUnique: vi.fn() },
    spaceEventLog: { create: vi.fn() },
    space: { findUnique: vi.fn() },
  },
  mockGetParticipant: vi.fn(),
  mockUpdateParticipant: vi.fn(),
  mockMutePublishedTrack: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
// RoomServiceClient만 교체하고 TrackSource enum 등은 실제 SDK 유지
vi.mock("livekit-server-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("livekit-server-sdk")>();
  class MockRoomServiceClient {
    getParticipant = mockGetParticipant;
    updateParticipant = mockUpdateParticipant;
    mutePublishedTrack = mockMutePublishedTrack;
  }
  return { ...actual, RoomServiceClient: MockRoomServiceClient };
});

import { TrackSource } from "livekit-server-sdk";
import { POST } from "./route";

const SPACE_ID = "space-1";
const ctx = { params: Promise.resolve({ id: SPACE_ID }) };
const PATH = `/api/spaces/${SPACE_ID}/livekit/moderate`;

function req(body: unknown) {
  return buildJsonRequest(PATH, "POST", body);
}

/** room에 연결된 participant fixture. */
function makeParticipant(
  overrides: {
    name?: string;
    permission?: Record<string, unknown>;
    tracks?: { sid: string; source: TrackSource; muted: boolean }[];
  } = {}
) {
  return {
    identity: "user-target",
    name: overrides.name ?? "대상자",
    permission: overrides.permission ?? {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      hidden: false,
      canPublishSources: [],
    },
    tracks:
      overrides.tracks ??
      [{ sid: "TR_mic", source: TrackSource.MICROPHONE, muted: false }],
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findUnique.mockReset();
  mockPrisma.spaceEventLog.create.mockReset();
  mockPrisma.spaceEventLog.create.mockResolvedValue({});
  mockPrisma.space.findUnique.mockReset();
  // WI-046: 기본 ACTIVE(status 게이트 통과). archived 케이스는 개별 override.
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
  mockGetParticipant.mockReset();
  mockUpdateParticipant.mockReset();
  mockUpdateParticipant.mockResolvedValue({});
  mockMutePublishedTrack.mockReset();
  mockMutePublishedTrack.mockResolvedValue({});
  vi.stubEnv("LIVEKIT_API_KEY", "testkey");
  vi.stubEnv("LIVEKIT_API_SECRET", "testsecret");
  vi.stubEnv("LIVEKIT_URL", "http://livekit.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/spaces/[id]/livekit/moderate — 인증/입력 검증", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(req({ identity: "user-x", muted: true }), ctx);
    expect(res.status).toBe(401);
  });

  it("muted 비-boolean → 400", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    const res = await POST(req({ identity: "user-x", muted: "yes" }), ctx);
    expect(res.status).toBe(400);
  });

  it("identity 형식 위반(dev-anon) → 400 INVALID_IDENTITY", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    const res = await POST(req({ identity: "dev-anon-123", muted: true }), ctx);
    expect(res.status).toBe(400);
    expect((await readJson<{ code: string }>(res)).code).toBe("INVALID_IDENTITY");
  });

  it("self 대상 거부 → 400 SELF_TARGET (LiveKit 미진입)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    const res = await POST(req({ identity: "user-owner-1", muted: true }), ctx);
    expect(res.status).toBe(400);
    expect((await readJson<{ code: string }>(res)).code).toBe("SELF_TARGET");
    expect(mockGetParticipant).not.toHaveBeenCalled();
  });
});

describe("POST moderate — 권한 게이트", () => {
  it("actor가 멤버도 슈퍼어드민도 아니면 403", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "intruder", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce(null); // self
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(403);
    expect(mockGetParticipant).not.toHaveBeenCalled();
  });

  it("actor가 PARTICIPANT면 403", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "p1", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce({ role: "PARTICIPANT" });
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(403);
  });

  it("user 대상이 멤버가 아니면 404 TARGET_NOT_MEMBER", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" }) // self
      .mockResolvedValueOnce(null); // target
    const res = await POST(req({ identity: "user-ghost", muted: true }), ctx);
    expect(res.status).toBe(404);
    expect((await readJson<{ code: string }>(res)).code).toBe("TARGET_NOT_MEMBER");
  });

  it("OWNER 대상은 superAdmin 아니면 403 (보호)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "staff-1", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "STAFF" }) // self
      .mockResolvedValueOnce({ role: "OWNER", displayName: null, user: { name: "방장" } }); // target
    const res = await POST(req({ identity: "user-owner", muted: true }), ctx);
    expect(res.status).toBe(403);
  });

  it("STAFF가 동급 STAFF 제재 불가 → 403 (canActOn)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "staff-1", isSuperAdmin: false }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "STAFF" }) // self
      .mockResolvedValueOnce({ role: "STAFF", displayName: null, user: { name: "스태프2" } }); // target
    const res = await POST(req({ identity: "user-staff2", muted: true }), ctx);
    expect(res.status).toBe(403);
  });

  it("superAdmin은 OWNER도 제재 가능", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "admin", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce(null) // self (superAdmin, 비멤버)
      .mockResolvedValueOnce({ role: "OWNER", displayName: null, user: { name: "방장" } }); // target
    mockGetParticipant.mockResolvedValue(makeParticipant());
    const res = await POST(req({ identity: "user-owner", muted: true }), ctx);
    expect(res.status).toBe(200);
  });
});

describe("POST moderate — LiveKit 설정/연결 실패", () => {
  it("LiveKit 미설정(prod no key) → 503 LIVEKIT_NOT_CONFIGURED", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" })
      .mockResolvedValueOnce({ role: "PARTICIPANT", displayName: "P", user: { name: "P" } });
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(503);
    expect((await readJson<{ code: string }>(res)).code).toBe("LIVEKIT_NOT_CONFIGURED");
  });

  it("participant가 room에 없음(getParticipant throw) → 404 PARTICIPANT_NOT_FOUND", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" })
      .mockResolvedValueOnce({ role: "PARTICIPANT", displayName: "P", user: { name: "P" } });
    mockGetParticipant.mockRejectedValue(new Error("not found"));
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(404);
    expect((await readJson<{ code: string }>(res)).code).toBe("PARTICIPANT_NOT_FOUND");
    expect(mockUpdateParticipant).not.toHaveBeenCalled();
  });

  it("LiveKit 작업 실패(updateParticipant throw) → 502 LIVEKIT_OPERATION_FAILED", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" })
      .mockResolvedValueOnce({ role: "PARTICIPANT", displayName: "P", user: { name: "P" } });
    mockGetParticipant.mockResolvedValue(makeParticipant());
    mockUpdateParticipant.mockRejectedValue(new Error("livekit down"));
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(502);
    expect((await readJson<{ code: string }>(res)).code).toBe("LIVEKIT_OPERATION_FAILED");
    // 감사 로그는 작업 실패 시 기록하지 않음
    expect(mockPrisma.spaceEventLog.create).not.toHaveBeenCalled();
  });
});

describe("POST moderate — mute 성공 경로", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1", name: "방장" }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" })
      .mockResolvedValueOnce({ role: "PARTICIPANT", displayName: "참가자", user: { name: "참가자" } });
  });

  it("권한 회수 먼저 → 마이크 트랙 mute, trackSid 반환, 200", async () => {
    mockGetParticipant.mockResolvedValue(
      makeParticipant({
        permission: {
          canSubscribe: true,
          canPublish: true,
          canPublishData: true,
          hidden: false,
          canPublishSources: [],
        },
        tracks: [{ sid: "TR_mic", source: TrackSource.MICROPHONE, muted: false }],
      })
    );
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(200);
    const body = await readJson<{ identity: string; muted: boolean; trackSid: string | null }>(res);
    expect(body).toEqual({ identity: "user-target", muted: true, trackSid: "TR_mic" });

    // updateParticipant: canPublishSources에서 MICROPHONE 제거, 나머지 보존(codex risk #1)
    const permArg = mockUpdateParticipant.mock.calls[0][2].permission;
    expect(permArg.canSubscribe).toBe(true);
    expect(permArg.canPublish).toBe(true);
    expect(permArg.canPublishData).toBe(true);
    expect(permArg.canPublishSources).not.toContain(TrackSource.MICROPHONE);
    expect(permArg.canPublishSources).toContain(TrackSource.CAMERA);

    // 호출 순서: updateParticipant(권한) → mutePublishedTrack(트랙)
    const updateOrder = mockUpdateParticipant.mock.invocationCallOrder[0];
    const muteOrder = mockMutePublishedTrack.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(muteOrder);
    expect(mockMutePublishedTrack).toHaveBeenCalledWith(
      "space-space-1",
      "user-target",
      "TR_mic",
      true
    );
  });

  it("마이크 트랙 없음 → 권한만 회수, trackSid:null, mutePublishedTrack 미호출", async () => {
    mockGetParticipant.mockResolvedValue(
      makeParticipant({ tracks: [{ sid: "TR_cam", source: TrackSource.CAMERA, muted: false }] })
    );
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(200);
    expect((await readJson<{ trackSid: string | null }>(res)).trackSid).toBeNull();
    expect(mockUpdateParticipant).toHaveBeenCalledTimes(1);
    expect(mockMutePublishedTrack).not.toHaveBeenCalled();
  });

  it("이미 muted인 마이크 → mutePublishedTrack 미호출(idempotent), trackSid 반환", async () => {
    mockGetParticipant.mockResolvedValue(
      makeParticipant({ tracks: [{ sid: "TR_mic", source: TrackSource.MICROPHONE, muted: true }] })
    );
    const res = await POST(req({ identity: "user-target", muted: true }), ctx);
    expect(res.status).toBe(200);
    expect((await readJson<{ trackSid: string | null }>(res)).trackSid).toBe("TR_mic");
    expect(mockMutePublishedTrack).not.toHaveBeenCalled();
  });

  it("감사 로그: ADMIN_ACTION voiceMute + targetIdentity + actor userId", async () => {
    mockGetParticipant.mockResolvedValue(makeParticipant());
    await POST(req({ identity: "user-target", muted: true }), ctx);
    const logArg = mockPrisma.spaceEventLog.create.mock.calls[0][0].data;
    expect(logArg.eventType).toBe("ADMIN_ACTION");
    expect(logArg.userId).toBe("owner-1");
    expect(logArg.spaceId).toBe(SPACE_ID);
    expect(logArg.payload.action).toBe("voiceMute");
    expect(logArg.payload.targetIdentity).toBe("user-target");
  });
});

describe("POST moderate — unmute 경로 (권한 복원만, force-unmute 안 함)", () => {
  it("unmute: updateParticipant에 마이크 추가, mutePublishedTrack 미호출, 200", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.spaceMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" })
      .mockResolvedValueOnce({ role: "PARTICIPANT", displayName: "P", user: { name: "P" } });
    mockGetParticipant.mockResolvedValue(
      makeParticipant({
        permission: {
          canSubscribe: true,
          canPublish: true,
          canPublishData: true,
          hidden: false,
          canPublishSources: [TrackSource.CAMERA],
        },
        tracks: [{ sid: "TR_mic", source: TrackSource.MICROPHONE, muted: true }],
      })
    );
    const res = await POST(req({ identity: "user-target", muted: false }), ctx);
    expect(res.status).toBe(200);
    const body = await readJson<{ muted: boolean; trackSid: string | null }>(res);
    expect(body.muted).toBe(false);
    expect(body.trackSid).toBeNull();

    const permArg = mockUpdateParticipant.mock.calls[0][2].permission;
    expect(permArg.canPublishSources).toContain(TrackSource.MICROPHONE);
    expect(permArg.canPublishSources).toContain(TrackSource.CAMERA);
    // force-unmute 안 함
    expect(mockMutePublishedTrack).not.toHaveBeenCalled();

    const logArg = mockPrisma.spaceEventLog.create.mock.calls[0][0].data;
    expect(logArg.payload.action).toBe("voiceUnmute");
  });
});

describe("POST moderate — guest 대상", () => {
  it("guest는 SpaceMember 조회 없이 제재 가능, targetName은 participant.name", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    // self 조회 1회만 (guest target은 멤버 조회 안 함)
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockGetParticipant.mockResolvedValue(
      makeParticipant({ name: "게스트짱" })
    );
    const res = await POST(req({ identity: "guest-sess-9", muted: true }), ctx);
    expect(res.status).toBe(200);
    // 멤버 조회는 self 1회뿐
    expect(mockPrisma.spaceMember.findUnique).toHaveBeenCalledTimes(1);
    const logArg = mockPrisma.spaceEventLog.create.mock.calls[0][0].data;
    expect(logArg.payload.targetName).toBe("게스트짱");
    expect(logArg.payload.targetIdentity).toBe("guest-sess-9");
  });
});

describe("POST /api/spaces/[id]/livekit/moderate — archived 가드 (WI-046)", () => {
  it("ARCHIVED 스페이스는 OWNER여도 403 SPACE_NOT_ACTIVE, LiveKit 미진입", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "owner-1" }));
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(req({ identity: "user-target", muted: true }), ctx);

    expect(res.status).toBe(403);
    expect((await readJson<{ code: string }>(res)).code).toBe("SPACE_NOT_ACTIVE");
    expect(mockGetParticipant).not.toHaveBeenCalled();
    expect(mockUpdateParticipant).not.toHaveBeenCalled();
    // self 조회(1회)만 — target 멤버 조회는 status 게이트 이후라 미발생
    expect(mockPrisma.spaceMember.findUnique).toHaveBeenCalledTimes(1);
  });

  it("ARCHIVED 스페이스는 superAdmin이어도 차단(403)", async () => {
    mockAuth.mockResolvedValue(makeSession({ id: "sa", isSuperAdmin: true }));
    mockPrisma.spaceMember.findUnique.mockResolvedValueOnce(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(req({ identity: "user-target", muted: true }), ctx);

    expect(res.status).toBe(403);
    expect(mockUpdateParticipant).not.toHaveBeenCalled();
  });
});
