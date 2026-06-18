import { jwtVerify } from "jose";
import { getAuthSecret } from "../../src/lib/auth-secret";

interface SocketTokenPayload {
  userId: string;
  name: string;
}

/** 소켓 토큰 검증 (AUTH_SECRET으로 서명된 JWT) */
export async function verifySocketToken(
  token: string
): Promise<SocketTokenPayload> {
  // AUTH_SECRET 미설정/단문이면 throw → io.use catch → 연결 거부 (fail-closed)
  const secret = getAuthSecret();
  const { payload } = await jwtVerify(token, secret);

  if (!payload.userId || typeof payload.userId !== "string") {
    throw new Error("Invalid token payload");
  }

  return {
    userId: payload.userId,
    name: (payload.name as string) || "Anonymous",
  };
}
