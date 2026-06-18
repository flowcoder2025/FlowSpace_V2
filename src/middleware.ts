import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// prefix는 정확히 그 경로이거나 그 하위 경로일 때만 public (예: "/login"은
// "/login", "/login/..."만 매칭하고 "/login-anything"은 비공개로 유지).
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/guest"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // 루트는 exact 매칭만 (startsWith("/")가 모든 경로를 통과시키던 no-op 제거)
  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  const isStaticAsset =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon");

  if (isStaticAsset || isPublic) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
