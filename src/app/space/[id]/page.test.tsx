import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================
// WI-034: 인-스페이스 page — role 주입 + BANNED 차단 + 원자적 upsert
// space-client는 Phaser/LiveKit를 끌어와 무거우므로 mock으로 대체한다.
// ============================================================

const { mockAuth, mockPrisma, mockRedirect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    space: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    spaceMember: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() },
  },
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("./space-client", () => ({ default: () => null }));

import SpacePage from "./page";

const SPACE_ID = "space-1";
const SELF = "u1";
const call = () => SpacePage({ params: Promise.resolve({ id: SPACE_ID }) });
// 렌더된 SpaceClient element 의 props.user.role 추출
const roleOf = (el: unknown) =>
  (el as { props: { user: { role: string } } }).props.user.role;

beforeEach(() => {
  vi.clearAllMocks();
  mockRedirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  mockAuth.mockResolvedValue({ user: { id: SELF, name: "Alice", isSuperAdmin: false } });
  mockPrisma.space.findUnique.mockResolvedValue({
    id: SPACE_ID,
    name: "Space",
    description: null,
    maxUsers: 50,
    ownerId: "owner-x", // 기본: self 는 오너 아님
    accessType: "PUBLIC",
    template: null,
    _count: { members: 3 },
  });
  mockPrisma.user.findUnique.mockResolvedValue({
    id: SELF,
    name: "Alice",
    image: null,
    avatarConfig: null,
  });
  mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
  mockPrisma.spaceMember.upsert.mockResolvedValue({ role: "PARTICIPANT", restriction: "NONE" });
});

describe("SpacePage role 주입", () => {
  it("기존 멤버 → 그 role 주입, upsert/create 미호출", async () => {
    mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "STAFF", restriction: "NONE" });

    const el = await call();

    expect(roleOf(el)).toBe("STAFF");
    expect(mockPrisma.spaceMember.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.spaceMember.create).not.toHaveBeenCalled();
  });

  it("MUTED 멤버도 입장 허용(use) — role 주입", async () => {
    mockPrisma.spaceMember.findUnique.mockResolvedValue({
      role: "PARTICIPANT",
      restriction: "MUTED",
    });

    const el = await call();

    expect(roleOf(el)).toBe("PARTICIPANT");
    expect(mockPrisma.spaceMember.upsert).not.toHaveBeenCalled();
  });

  it("PUBLIC 비멤버 → upsert로 PARTICIPANT 자동 가입(원자성), bare create 미사용", async () => {
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.spaceMember.upsert.mockResolvedValue({ role: "PARTICIPANT", restriction: "NONE" });

    const el = await call();

    expect(roleOf(el)).toBe("PARTICIPANT");
    // race 고정: 비원자적 create 가 아닌 upsert 사용
    expect(mockPrisma.spaceMember.create).not.toHaveBeenCalled();
    expect(mockPrisma.spaceMember.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.spaceMember.upsert.mock.calls[0][0] as {
      where: unknown;
      update: Record<string, unknown>;
      create: { role: string };
      select: Record<string, boolean>;
    };
    expect(arg.where).toEqual({ spaceId_userId: { spaceId: SPACE_ID, userId: SELF } });
    expect(arg.update).toEqual({}); // 멱등 — 이미 있으면 기존 role 유지
    expect(arg.create.role).toBe("PARTICIPANT");
    // post-upsert BANNED 재확인을 위해 restriction 까지 select 해야 함(누락 시 race 누출 재발)
    expect(arg.select).toEqual({ role: true, restriction: true });
  });

  it("오너인데 멤버 행 없음 → upsert로 OWNER self-heal", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({
      id: SPACE_ID,
      name: "Space",
      description: null,
      maxUsers: 50,
      ownerId: SELF, // self = 오너
      accessType: "PRIVATE",
      template: null,
      _count: { members: 1 },
    });
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.spaceMember.upsert.mockResolvedValue({ role: "OWNER", restriction: "NONE" });

    const el = await call();

    expect(roleOf(el)).toBe("OWNER");
    expect(mockPrisma.spaceMember.create).not.toHaveBeenCalled();
    const arg = mockPrisma.spaceMember.upsert.mock.calls[0][0] as { create: { role: string } };
    expect(arg.create.role).toBe("OWNER");
  });
});

describe("SpacePage 접근 거부 (redirect)", () => {
  it("BANNED 멤버는 OWNER role이어도 redirect /my-spaces — 가입/주입 안 함", async () => {
    mockPrisma.spaceMember.findUnique.mockResolvedValue({ role: "OWNER", restriction: "BANNED" });

    await expect(call()).rejects.toThrow("REDIRECT:/my-spaces");
    expect(mockPrisma.spaceMember.upsert).not.toHaveBeenCalled();
  });

  it("create 경로에서 upsert가 BANNED 기존 행 반환(race) → role 주입 전 redirect", async () => {
    // findUnique 직후~upsert 사이 행이 BANNED가 되는 TOCTOU. upsert는 충돌 분기에서
    // 기존(BANNED) 행을 반환할 수 있으므로 upsert 후에도 BANNED를 재확인해야 한다.
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null); // 진입 시 행 없음 → create 결정
    mockPrisma.spaceMember.upsert.mockResolvedValue({ role: "OWNER", restriction: "BANNED" });

    await expect(call()).rejects.toThrow("REDIRECT:/my-spaces");
  });

  it("PRIVATE 비멤버 → redirect /my-spaces", async () => {
    mockPrisma.space.findUnique.mockResolvedValue({
      id: SPACE_ID,
      name: "Space",
      description: null,
      maxUsers: 50,
      ownerId: "owner-x",
      accessType: "PRIVATE",
      template: null,
      _count: { members: 1 },
    });
    mockPrisma.spaceMember.findUnique.mockResolvedValue(null);

    await expect(call()).rejects.toThrow("REDIRECT:/my-spaces");
    expect(mockPrisma.spaceMember.upsert).not.toHaveBeenCalled();
  });
});
