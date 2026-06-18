/**
 * 공간 역할 계층 및 enum allowlist 헬퍼
 *
 * 관리 액션(역할변경/제재/추방)의 "호출자 역할 > 대상 역할" 불변식을
 * 한 곳에서 강제한다. 멤버 PATCH 라우트들이 공통 사용.
 */
import type { SpaceRole } from "@prisma/client";

/** 역할 서열 (높을수록 상위 권한). */
const ROLE_RANK: Record<SpaceRole, number> = {
  OWNER: 3,
  STAFF: 2,
  PARTICIPANT: 1,
};

export const SPACE_ROLES: readonly SpaceRole[] = ["OWNER", "STAFF", "PARTICIPANT"];
export const CHAT_RESTRICTIONS = ["NONE", "MUTED", "BANNED"] as const;
export type ChatRestrictionValue = (typeof CHAT_RESTRICTIONS)[number];

/**
 * 행위자가 대상에게 관리 액션을 수행할 수 있는지 판정한다.
 *
 * 원칙: 호출자 역할이 대상 역할보다 **엄격히 상위**일 때만 허용한다.
 * 즉 동급(STAFF→STAFF)이나 상위(STAFF→OWNER) 제재는 불가.
 * superAdmin은 계층과 무관하게 항상 허용.
 */
export function canActOn(
  actorRole: SpaceRole,
  targetRole: SpaceRole,
  isSuperAdmin = false
): boolean {
  if (isSuperAdmin) return true;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

/** 값이 유효한 SpaceRole enum 인지 런타임 검증. */
export function isSpaceRole(value: unknown): value is SpaceRole {
  return typeof value === "string" && (SPACE_ROLES as readonly string[]).includes(value);
}

/** 값이 유효한 ChatRestriction enum 인지 런타임 검증. */
export function isChatRestriction(value: unknown): value is ChatRestrictionValue {
  return (
    typeof value === "string" && (CHAT_RESTRICTIONS as readonly string[]).includes(value)
  );
}
