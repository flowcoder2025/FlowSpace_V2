/**
 * AUTH_SECRET 검증 헬퍼 (fail-closed)
 *
 * 소켓 JWT 서명(src/app/api/socket/token)과 검증(server/middleware/auth)에서 공통 사용.
 * AUTH_SECRET이 미설정이거나 너무 짧으면 즉시 throw 하여, 알려진/약한 키로
 * 토큰을 서명·검증하는 fail-open을 차단한다.
 *
 * 의존성 없는 순수 모듈 — Next 라우트와 별도 socket.io 서버 양쪽에서 import 가능.
 */

/** HS256 서명 키 최소 길이 (바이트 = ASCII 문자 수). */
export const MIN_AUTH_SECRET_LENGTH = 32;

/**
 * 검증된 AUTH_SECRET을 서명/검증용 키 바이트로 반환한다.
 * @throws AUTH_SECRET 미설정 또는 {@link MIN_AUTH_SECRET_LENGTH} 미만일 때
 */
export function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET is missing or too short (min ${MIN_AUTH_SECRET_LENGTH} chars). ` +
        "Refusing to sign or verify tokens with an insecure key."
    );
  }

  return new TextEncoder().encode(secret);
}
