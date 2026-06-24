import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// WI-045: LiveKit 토큰 라우트가 차단(BANNED) 멤버에게 화상 토큰을 발급하지 않는지 회귀 가드.
// (ban 의 removeSpaceParticipant 후 새 토큰으로 화상 재입장하는 우회 차단 — 소켓 BANNED 게이트와 정합)
// ============================================================

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findFirst: vi.fn() },
    space: { findFirst: vi.fn(), findUnique: vi.fn() },
    guestSession: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
// LiveKit SDK — BANNED 경로는 토큰 생성 전 403 이므로 호출되지 않으나 import 안전을 위해 스텁.
vi.mock("livekit-server-sdk", () => ({
  AccessToken: class {
    addGrant() {}
    async toJwt() {
      return "jwt-token";
    }
  },
  RoomServiceClient: class {
    async listParticipants() {
      return [];
    }
    async removeParticipant() {}
  },
}));

function tokenRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/livekit/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  roomName: "space-s1",
  participantName: "밴유저",
  participantId: "user-u-ban",
};

beforeEach(() => {
  mockAuth.mockReset();
  mockPrisma.spaceMember.findFirst.mockReset();
  mockPrisma.space.findFirst.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.guestSession.findUnique.mockReset();
  // 기본: 스페이스는 ACTIVE — WI-048 status 게이트를 통과시켜 기존 검증이 그대로 동작.
  mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** 모듈 로드 시점에 LiveKit config 를 캡처하므로 env 설정 후 동적 import. */
async function loadPOST() {
  vi.stubEnv("LIVEKIT_API_KEY", "test-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "test-secret");
  vi.resetModules();
  return (await import("./route")).POST;
}

describe("POST /api/livekit/token — BANNED 차단(WI-045)", () => {
  it("차단된 멤버(BANNED, 비-소유자) → 403 code:BANNED", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-ban", name: "밴유저" } });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-ban", restriction: "BANNED" });
    mockPrisma.space.findFirst.mockResolvedValue(null);

    const res = await POST(tokenRequest(VALID_BODY) as never);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("BANNED");
  });

  it("미차단 멤버(NONE) → BANNED 거부하지 않음(403 BANNED 아님)", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-ok", name: "정상" } });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-ok", restriction: "NONE" });
    mockPrisma.space.findFirst.mockResolvedValue(null);

    const res = await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-ok", participantName: "정상" }) as never
    );
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    expect(body.code).not.toBe("BANNED");
  });

  it("BANNED 멤버는 owner(space 매치)여도 차단 — 소켓 게이트와 일관(owner 예외 없음)", async () => {
    // 데이터 드리프트로 BANNED 가 된 owner 라도 소켓(room.ts)과 동일하게 화상도 차단해야 일관.
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-own", name: "오너" } });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-own", restriction: "BANNED" });
    mockPrisma.space.findFirst.mockResolvedValue({ id: "s1" }); // owner 매치(space truthy)

    const res = await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-own", participantName: "오너" }) as never
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("BANNED");
  });

  it("토큰 라우트 select 에 restriction 포함(게이트 판단용)", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-ban", name: "밴유저" } });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-ban", restriction: "BANNED" });
    mockPrisma.space.findFirst.mockResolvedValue(null);

    await POST(tokenRequest(VALID_BODY) as never);
    const arg = mockPrisma.spaceMember.findFirst.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(arg.select.restriction).toBe(true);
  });
});

// ============================================================
// WI-048: archived(비-ACTIVE) 스페이스에 화상 토큰을 발급하지 않는지 회귀 가드.
// (소켓 join 게이트[room.ts]·space/[id] 페이지 status:ACTIVE 로드와 정합 — 심층방어)
// roomName 검증 직후 단일 이른 게이트라 멤버/owner/게스트/dev-anon 모든 경로를 균일 차단.
// ============================================================
/** 게스트 sessionToken 경로용 body(인증 없이 게스트 토큰 요청). */
function devEnvLoadPOST(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("LIVEKIT_API_KEY", "test-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "test-secret");
  vi.resetModules();
  return import("./route").then((m) => m.POST);
}

describe("POST /api/livekit/token — archived 스페이스 차단(WI-048)", () => {
  it("archived 스페이스 → 403 SPACE_NOT_ACTIVE (멤버 NONE 이어도 차단)", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-ok", name: "정상" } });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-ok", restriction: "NONE" });
    mockPrisma.space.findFirst.mockResolvedValue(null);

    const res = await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-ok", participantName: "정상" }) as never
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
  });

  it("archived 게이트는 세션/멤버 조회 전에 단락(spaceMember.findFirst·auth 미호출)", async () => {
    const POST = await loadPOST();
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(tokenRequest(VALID_BODY) as never);
    expect(res.status).toBe(403);
    expect(mockPrisma.spaceMember.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.space.findFirst).not.toHaveBeenCalled();
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("archived 스페이스의 owner 여도 차단 (복원 UX 없음 — owner 예외 없음)", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-own", name: "오너" } });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-own", restriction: "NONE" });
    mockPrisma.space.findFirst.mockResolvedValue({ id: "s1" }); // owner 매치

    const res = await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-own", participantName: "오너" }) as never
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
  });

  it("archived 스페이스 게스트(sessionToken) 경로도 차단 (인증 없이 게스트 토큰 요청)", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue(null);
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    const res = await POST(
      tokenRequest({ ...VALID_BODY, sessionToken: "guest-token-1" }) as never
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
    // 게스트 세션 검증까지 가지 않고 단락.
    expect(mockPrisma.guestSession.findUnique).not.toHaveBeenCalled();
  });

  it("INACTIVE 스페이스도 차단 (비-ACTIVE 클래스 — ARCHIVED+INACTIVE)", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-ok", name: "정상" } });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "INACTIVE" });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-ok", restriction: "NONE" });
    mockPrisma.space.findFirst.mockResolvedValue(null);

    const res = await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-ok", participantName: "정상" }) as never
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
  });

  it("ACTIVE 스페이스는 status 게이트가 막지 않고 정상 토큰을 발급(200+token)", async () => {
    // codex r1 P3: code!==SPACE_NOT_ACTIVE 만 보면 ACTIVE 가 401/403/500 로 깨져도 통과(false-pass)
    // → 정상 발급(200·token·participantId)까지 단언해 회귀를 실제로 잡는다.
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-ok", name: "정상" } });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-ok", restriction: "NONE" });
    mockPrisma.space.findFirst.mockResolvedValue(null);

    const res = await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-ok", participantName: "정상" }) as never
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token?: string; participantId?: string; code?: string };
    expect(body.code).not.toBe("SPACE_NOT_ACTIVE");
    expect(body.token).toBe("jwt-token");
    expect(body.participantId).toBe("user-u-ok");
  });

  it("미존재 스페이스는 status 게이트가 404 로 바꾸지 않음 — 기존 흐름 보존(strictly additive)", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-x", name: "비멤버" } });
    mockPrisma.space.findUnique.mockResolvedValue(null); // 스페이스 미존재
    mockPrisma.spaceMember.findFirst.mockResolvedValue(null);
    mockPrisma.space.findFirst.mockResolvedValue(null);

    // 비-멤버·비-owner·sessionToken 없음 → 기존 403("not a member") 유지(404 아님, SPACE_NOT_ACTIVE 아님).
    const res = await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-x", participantName: "비멤버" }) as never
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).not.toBe("SPACE_NOT_ACTIVE");
  });

  it("status 게이트 쿼리는 findUnique({ select: { status } })", async () => {
    const POST = await loadPOST();
    mockAuth.mockResolvedValue({ user: { id: "u-ok", name: "정상" } });
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ACTIVE" });
    mockPrisma.spaceMember.findFirst.mockResolvedValue({ id: "m-ok", restriction: "NONE" });
    mockPrisma.space.findFirst.mockResolvedValue(null);

    await POST(
      tokenRequest({ ...VALID_BODY, participantId: "user-u-ok", participantName: "정상" }) as never
    );
    const arg = mockPrisma.space.findUnique.mock.calls[0][0] as {
      where: { id: string };
      select: Record<string, boolean>;
    };
    expect(arg.where.id).toBe("s1");
    expect(arg.select.status).toBe(true);
  });

  it("dev-anon 폴백(NODE_ENV=development)도 archived 면 차단", async () => {
    const POST = await devEnvLoadPOST("development");
    mockAuth.mockResolvedValue(null); // 인증 없음
    mockPrisma.space.findUnique.mockResolvedValue({ status: "ARCHIVED" });

    // sessionToken 없음 → 원래라면 dev-anon 폴백으로 토큰 발급되나, archived 게이트가 선차단.
    const res = await POST(tokenRequest(VALID_BODY) as never);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SPACE_NOT_ACTIVE");
  });
});
