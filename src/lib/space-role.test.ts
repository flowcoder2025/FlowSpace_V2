import { describe, it, expect } from "vitest";
import {
  canActOn,
  isSpaceRole,
  isChatRestriction,
  resolveSpaceRoleDecision,
} from "./space-role";

// ============================================================
// WI-034: 인-스페이스 role 결정 — SpaceMember.role SoT (소켓 정합)
// ============================================================

describe("resolveSpaceRoleDecision", () => {
  describe("멤버 행 있음 → use(그 role) — isOwner/accessType 무관", () => {
    it.each(["OWNER", "STAFF", "PARTICIPANT"] as const)(
      "memberRole=%s → use %s",
      (role) => {
        expect(
          resolveSpaceRoleDecision({ memberRole: role, isOwner: false, accessType: "PUBLIC" })
        ).toEqual({ action: "use", role });
      }
    );

    it("PRIVATE 스페이스라도 기존 멤버면 redirect 아닌 use", () => {
      expect(
        resolveSpaceRoleDecision({ memberRole: "STAFF", isOwner: false, accessType: "PRIVATE" })
      ).toEqual({ action: "use", role: "STAFF" });
    });

    it("강등 엣지: 오너이나 멤버 role이 STAFF면 use STAFF (소켓 정합 — 합성 OWNER 아님)", () => {
      // server/handlers/room.ts 는 SpaceMember.role 만 권위로 본다.
      // space.ownerId 로 OWNER 를 파생하면 소켓(STAFF)과 발산한다.
      expect(
        resolveSpaceRoleDecision({ memberRole: "STAFF", isOwner: true, accessType: "PUBLIC" })
      ).toEqual({ action: "use", role: "STAFF" });
    });
  });

  describe("멤버 행 없음 → 가입/거부 결정", () => {
    it("오너인데 멤버 행 없음 → create OWNER (self-heal, 합성 아님)", () => {
      expect(
        resolveSpaceRoleDecision({ memberRole: null, isOwner: true, accessType: "PRIVATE" })
      ).toEqual({ action: "create", role: "OWNER" });
    });

    it("PUBLIC 비멤버 → create PARTICIPANT (자동 가입)", () => {
      expect(
        resolveSpaceRoleDecision({ memberRole: null, isOwner: false, accessType: "PUBLIC" })
      ).toEqual({ action: "create", role: "PARTICIPANT" });
    });

    it.each(["PRIVATE", "PASSWORD"] as const)(
      "%s 비멤버 → redirect (초대 코드로만 가입)",
      (accessType) => {
        expect(
          resolveSpaceRoleDecision({ memberRole: null, isOwner: false, accessType })
        ).toEqual({ action: "redirect" });
      }
    );
  });

  describe("superAdmin 비특례 (입력 아님 → 인-스페이스 클라 role에 미반영)", () => {
    it("superAdmin 여부와 무관하게 PRIVATE 비멤버는 항상 redirect", () => {
      // 함수 시그니처에 superAdmin 입력이 없다는 것이 곧 비특례.
      // 비멤버 superAdmin도 소켓 join:space 가 NOT_A_MEMBER 로 거부하므로
      // 클라가 OWNER UI 를 보이면 발산한다 → 동일 결정(redirect).
      expect(
        resolveSpaceRoleDecision({ memberRole: null, isOwner: false, accessType: "PRIVATE" })
      ).toEqual({ action: "redirect" });
    });

    it("superAdmin이 실제 멤버이면 자기 멤버 role 그대로", () => {
      expect(
        resolveSpaceRoleDecision({ memberRole: "PARTICIPANT", isOwner: false, accessType: "PUBLIC" })
      ).toEqual({ action: "use", role: "PARTICIPANT" });
    });
  });
});

// ============================================================
// 기존 role 계층 헬퍼 (회귀 가드)
// ============================================================

describe("canActOn", () => {
  it("상위 역할만 하위 역할에 액션 가능 (엄격 상위)", () => {
    expect(canActOn("OWNER", "STAFF")).toBe(true);
    expect(canActOn("OWNER", "PARTICIPANT")).toBe(true);
    expect(canActOn("STAFF", "PARTICIPANT")).toBe(true);
  });

  it("동급/하위 → 불가", () => {
    expect(canActOn("STAFF", "STAFF")).toBe(false);
    expect(canActOn("STAFF", "OWNER")).toBe(false);
    expect(canActOn("PARTICIPANT", "PARTICIPANT")).toBe(false);
  });

  it("superAdmin은 계층 무관 항상 가능", () => {
    expect(canActOn("PARTICIPANT", "OWNER", true)).toBe(true);
    expect(canActOn("STAFF", "STAFF", true)).toBe(true);
  });
});

describe("isSpaceRole / isChatRestriction", () => {
  it("유효 enum만 통과", () => {
    expect(isSpaceRole("OWNER")).toBe(true);
    expect(isSpaceRole("ADMIN")).toBe(false);
    expect(isSpaceRole(null)).toBe(false);
    expect(isChatRestriction("MUTED")).toBe(true);
    expect(isChatRestriction("SHADOW")).toBe(false);
  });
});
