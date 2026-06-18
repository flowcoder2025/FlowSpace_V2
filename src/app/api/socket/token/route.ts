import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SignJWT } from "jose";
import { getAuthSecret } from "@/lib/auth-secret";

/** GET /api/socket/token - 소켓 접속용 토큰 발급 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let secret: Uint8Array;
  try {
    // AUTH_SECRET 미설정/단문이면 약한 키 발급 대신 fail-closed (500)
    secret = getAuthSecret();
  } catch (error) {
    console.error("[socket/token]", error);
    return NextResponse.json(
      { error: "Socket auth is not configured" },
      { status: 500 }
    );
  }

  const token = await new SignJWT({
    userId: session.user.id,
    name: session.user.name || "Anonymous",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);

  return NextResponse.json({ token });
}
