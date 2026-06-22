import type { Member, MemberRoleFilter } from "./member-table";

/**
 * 멤버 목록을 검색어(이름/이메일)와 역할 필터로 거른다 (순수 함수 — 클라 측 필터).
 *
 * - 검색어는 trim 후 소문자 비교. 빈 검색어 → 이름/이메일 조건 미적용.
 * - 이름은 member-table의 표시명 우선순위와 동일하게
 *   `user.name → guestSession.nickname → displayName` 순으로 비교 대상에 포함.
 * - 역할 필터 "ALL" → 역할 조건 미적용.
 */
export function filterMembers(
  members: Member[],
  query: string,
  role: MemberRoleFilter
): Member[] {
  const q = query.trim().toLowerCase();
  return members.filter((m) => {
    if (role !== "ALL" && m.role !== role) return false;
    if (!q) return true;
    // member-table 표시명 우선순위(|| 체인)와 동일하게 비교 (표시되는 값을 검색)
    const name = (
      m.user?.name ||
      m.guestSession?.nickname ||
      m.displayName ||
      ""
    ).toLowerCase();
    const email = (m.user?.email ?? "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });
}
