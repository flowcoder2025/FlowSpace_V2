/**
 * 미들웨어 경로 접근 분류 (순수 함수 — NextAuth/Node 무의존, 테스트 가능).
 *
 * deny-by-default: 아래 public 판정에 걸리지 않는 모든 경로는 미인증 시 /login 리다이렉트.
 * (WI-001 보안 경계 — 인증 우회 방지)
 */

/**
 * public/ 디렉터리의 공개 정적 자산 allowlist.
 *
 * ⚠️ "확장자 전체 통과"(예: /\.\w+$/)는 채택하지 않는다 — `/api/spaces/foo.png`,
 * `/space/foo.png` 같은 보호 라우트가 확장자를 달고 미들웨어를 우회하는 표면을 만든다
 * (WI-020 codex 적대 협의 지적). 실제 public 파일만 명시 허용해 deny-by-default를 유지한다.
 * public/ 에 자산 추가 시 여기에 함께 추가.
 */
export const PUBLIC_FILES: ReadonlySet<string> = new Set(["/Logo.png"]);

/**
 * prefix는 정확히 그 경로이거나 그 하위 경로일 때만 public
 * (예: "/login"은 "/login", "/login/..."만 매칭하고 "/login-anything"은 비공개 유지).
 */
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/guest"];

/**
 * 미인증 상태로 접근 허용되는 경로인지 판정한다.
 * @returns true면 통과(인증 불필요), false면 미들웨어가 미인증 시 /login 으로 리다이렉트.
 */
export function isPublicRequest(pathname: string): boolean {
  // Next 내부 자산 (matcher가 _next/static·_next/image는 이미 제외하나 방어적으로 유지)
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return true;
  }
  // public/ 공개 정적 자산 (명시 allowlist)
  if (PUBLIC_FILES.has(pathname)) {
    return true;
  }
  // 루트는 exact 매칭만 (startsWith("/")가 모든 경로를 통과시키던 no-op 금지)
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
