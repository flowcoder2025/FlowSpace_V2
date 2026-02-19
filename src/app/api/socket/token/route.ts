import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SignJWT } from "jose";

/** GET /api/socket/token - 소켓 접속용 토큰 발급 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const token = await new SignJWT({
    userId: session.user.id,
    name: session.user.name || "Anonymous",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);

  return NextResponse.json({ token });
}
