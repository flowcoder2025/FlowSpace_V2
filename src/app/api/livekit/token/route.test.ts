import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// WI-045: LiveKit 토큰 라우트가 차단(BANNED) 멤버에게 화상 토큰을 발급하지 않는지 회귀 가드.
// (ban 의 removeSpaceParticipant 후 새 토큰으로 화상 재입장하는 우회 차단 — 소켓 BANNED 게이트와 정합)
// ============================================================

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    spaceMember: { findFirst: vi.fn() },
    space: { findFirst: vi.fn() },
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
