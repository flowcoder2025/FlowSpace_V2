// Enforcement Dispatch — Next API route → socket 서버 전파 (WI-005, Next 측)
//
// DB 갱신 성공 후 호출. 소켓 서버 내부 엔드포인트에 HMAC 서명된 요청을 보낸다.
// serverless(Vercel)에서 fire-and-forget은 신뢰할 수 없으므로 응답 전에 await하되,
// 짧은 timeout으로 dashboard 액션 자체를 막지 않는다. 실패해도 throw하지 않고
// EnforceResult.enforced=false 로 표현 — DB는 이미 반영됐고 재접속은 join 게이트가 차단.

import {
  ENFORCE_PATH,
  ENFORCE_SIGNATURE_HEADER,
  ENFORCE_TIMESTAMP_HEADER,
  computeEnforceSignature,
  type EnforceRequest,
} from "./contract";

const ENFORCE_TIMEOUT_MS = 2000;

export interface EnforceResult {
  /** 소켓 서버가 실시간 반영했는지 */
  enforced: boolean;
  /** 영향받은 소켓 수(다중 탭 포함). 오프라인이면 0 */
  affectedSockets?: number;
  /** 미반영 사유(로깅/디버깅용) */
  reason?: string;
}

/**
 * 소켓 서버에 실시간 제재를 전파한다.
 * SOCKET_INTERNAL_URL/SECRET 미설정 시: 프로덕션은 loud error 로그 후 미반영,
 * 그 외(로컬/단일 프로세스 dev)는 조용히 미반영(소켓 서버가 없을 수 있음).
 */
export async function dispatchEnforcement(req: EnforceRequest): Promise<EnforceResult> {
  const baseUrl = process.env.SOCKET_INTERNAL_URL;
  const secret = process.env.SOCKET_INTERNAL_SECRET;

  if (!baseUrl || !secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[enforce] SOCKET_INTERNAL_URL/SECRET 미설정 — 실시간 제재 전파 불가(프로덕션). DB만 반영됨."
      );
    }
    return { enforced: false, reason: "not_configured" };
  }

  const rawBody = JSON.stringify(req);
  const timestamp = String(Date.now());
  const signature = computeEnforceSignature(secret, timestamp, rawBody);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENFORCE_TIMEOUT_MS);
  try {
    const url = new URL(ENFORCE_PATH, baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ENFORCE_SIGNATURE_HEADER]: signature,
        [ENFORCE_TIMESTAMP_HEADER]: timestamp,
      },
      body: rawBody,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[enforce] socket 서버 응답 ${res.status}`);
      return { enforced: false, reason: `status_${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { affectedSockets?: number };
    return { enforced: true, affectedSockets: data.affectedSockets };
  } catch (err) {
    console.error("[enforce] socket 서버 호출 실패:", err instanceof Error ? err.message : err);
    return { enforced: false, reason: "request_failed" };
  } finally {
    clearTimeout(timer);
  }
}
