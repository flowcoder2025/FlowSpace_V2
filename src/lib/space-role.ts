/**
 * 공간 역할 계층 및 enum allowlist 헬퍼
 *
 * 관리 액션(역할변경/제재/추방)의 "호출자 역할 > 대상 역할" 불변식을
 * 한 곳에서 강제한다. 멤버 PATCH 라우트들이 공통 사용.
 */
import type { SpaceAccessType, SpaceRole } from "@prisma/client";

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

/** 인-스페이스 진입 시 멤버십/role 처리 결정. */
export type SpaceRoleDecision =
  | { action: "use"; role: SpaceRole } // 기존 멤버 행 role 사용
  | { action: "create"; role: SpaceRole } // 멤버 행 생성 후 그 role 사용
  | { action: "redirect" }; // 가입 불가 → 접근 거부

/**
 * 인-스페이스 페이지 진입 시 사용자의 공간 role 결정을 한 곳에서 산정한다.
 *
 * 인-스페이스 권한 SoT는 `SpaceMember.role`이다 — 소켓 `join:space`
 * (server/handlers/room.ts)와 `requireSpaceAdmin`이 같은 값을 권위로 쓴다.
 * 클라이언트가 소켓과 다른 근거로 role을 추정하면 권한 UI/명령 파서는 열리나
 * 소켓 서버가 거부하는 발산이 생기므로, 항상 멤버 행 role을 따른다.
 *
 * 결정:
 * - 멤버 행 있음 + BANNED → `redirect` (소켓 join:space와 동일하게 입장 거부, role 무관)
 * - 멤버 행 있음 + 비BANNED → `use`(그 role)
 * - 멤버 행 없음 + 오너 → `create` OWNER (합성 OWNER 대신 행을 self-heal 해 소켓과 정합)
 * - 멤버 행 없음 + PUBLIC 비멤버 → `create` PARTICIPANT (자동 가입)
 * - 멤버 행 없음 + PRIVATE/PASSWORD 비멤버 → `redirect` (초대 코드로만 가입)
 *
 * BANNED는 role보다 먼저 차단한다 — 소켓이 BANNED 멤버를 입장 거부하므로
 * (room.ts: `restriction === "BANNED"` → `space:error`) 클라가 그들에게 role을 주면
 * 에디터/관리 UI가 열리는 발산이 생긴다(맵 편집 HTTP 라우트는 BANNED 미검사).
 *
 * superAdmin은 입력이 아니다 — `join:space`에 superAdmin 특례가 없어
 * (비멤버 superAdmin은 `NOT_A_MEMBER`로 거부됨) 인-스페이스 클라 role에 반영하면
 * 동일한 발산을 만든다. superAdmin이 실제 멤버이면 자기 멤버 role을 그대로 따른다.
 */
export function resolveSpaceRoleDecision(input: {
  memberRole: SpaceRole | null;
  restriction: ChatRestrictionValue | null;
  isOwner: boolean;
  accessType: SpaceAccessType;
}): SpaceRoleDecision {
  const { memberRole, restriction, isOwner, accessType } = input;
  if (memberRole) {
    if (restriction === "BANNED") return { action: "redirect" };
    return { action: "use", role: memberRole };
  }
  if (isOwner) return { action: "create", role: "OWNER" };
  if (accessType === "PUBLIC") return { action: "create", role: "PARTICIPANT" };
  return { action: "redirect" };
}
