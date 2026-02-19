import { jwtVerify } from "jose";

interface SocketTokenPayload {
  userId: string;
  name: string;
}

/** 소켓 토큰 검증 (AUTH_SECRET으로 서명된 JWT) */
export async function verifySocketToken(
  token: string
): Promise<SocketTokenPayload> {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const { payload } = await jwtVerify(token, secret);

  if (!payload.userId || typeof payload.userId !== "string") {
    throw new Error("Invalid token payload");
  }

  return {
    userId: payload.userId,
    name: (payload.name as string) || "Anonymous",
  };
}
