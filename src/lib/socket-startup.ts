/**
 * 소켓 서버 부팅 전 환경변수 검증 (WI-018, fail-fast).
 *
 * 별도 socket.io 서버(`server/index.ts`)가 `httpServer.listen()` 전에 호출한다.
 * 목적: 인증이 불가능한 오설정 컨테이너가 포트를 열고 healthcheck(200)를 통과해
 * "healthy"로 떠 트래픽을 받는 것을 차단한다. 검증이 포트 열기 전에 끝나야
 * 잘못된 컨테이너가 트래픽을 받을 기회가 없다.
 *
 * 의존성 없는 순수 모듈 — Next 라우트와 별도 socket.io 서버(esbuild 번들) 양쪽에서
 * import 가능. AUTH_SECRET 검증 정책은 {@link getAuthSecret}를 재사용한다(중복 구현 금지).
 */

import { getAuthSecret } from "./auth-secret";

export interface SocketStartupReport {
  /** 비치명적 경고 메시지(부팅은 계속된다). 호출부가 로깅한다. */
  warnings: string[];
}

/**
 * 소켓 서버 부팅 전 필수/선택 env를 검증한다.
 *
 * - **AUTH_SECRET**(필수): 소켓 JWT 인증의 핵심 키. 미설정/단문이면 모든 연결이
 *   거부된다. `production`에서는 throw하여 listen 전에 프로세스를 종료시킨다
 *   (fail-fast). 비-production(dev/test)에서는 throw 대신 경고만 남겨 기존
 *   동작을 보존한다 — 연결 시점의 lazy 검증(`verifySocketToken` → `getAuthSecret`)은
 *   그대로 유지되므로 잘못된 키로 연결이 성립하지는 않는다.
 * - **SOCKET_INTERNAL_SECRET**(선택): 즉시추방 enforce(WI-005) 전용. 미설정은
 *   의도된 graceful degrade(DB 단위 제재는 정상 동작)이므로 throw하지 않고
 *   production에서 경고만 남긴다.
 *
 * 시크릿 값 자체는 메시지에 절대 포함하지 않는다(원인·조치만 노출).
 *
 * @throws AUTH_SECRET이 미설정/단문이고 `NODE_ENV === "production"`일 때.
 *   메시지는 {@link getAuthSecret}의 것을 그대로 전파한다(시크릿 값 미포함).
 */
export function validateSocketStartupConfig(): SocketStartupReport {
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  // AUTH_SECRET — 핵심 인증 키. 없으면 모든 소켓 연결이 거부된다.
  try {
    getAuthSecret(); // 미설정/단문이면 throw (시크릿 값은 메시지에 미포함)
  } catch (error) {
    if (isProduction) {
      throw error; // fail-fast: 포트 열기 전 crash → 오설정 컨테이너가 healthcheck 통과 못 함
    }
    const reason = error instanceof Error ? error.message : "AUTH_SECRET is invalid";
    warnings.push(
      `${reason} (개발 환경이라 부팅은 계속하지만 소켓 연결은 거부된다)`
    );
  }

  // SOCKET_INTERNAL_SECRET — enforce(즉시추방) 전용 선택값. 미설정 = graceful degrade.
  if (isProduction && !process.env.SOCKET_INTERNAL_SECRET) {
    warnings.push(
      "SOCKET_INTERNAL_SECRET is not set — 실시간 즉시추방 enforce 비활성(DB 단위 제재는 정상 동작)."
    );
  }

  return { warnings };
}
