// LiveKit 서버 측 강제 제거(eviction) — kick/ban 시 화상 타일 잔존 제거(WI-045).
//
// 서버 자격 resolve + RoomServiceClient.removeParticipant orchestration(best-effort).
// kick/ban 의 핵심 성공 조건은 DB 상태 변경 + socket enforce 이며, LiveKit 제거는
// "화상 타일 잔존 정리"를 위한 보강 동작이다 — 실패해도 admin 액션 전체를 실패시키지
// 않고 로깅만 한다(미접속·화상 미사용·이미 퇴장·미설정 모두 무해).
import { RoomServiceClient } from "livekit-server-sdk";

const DEV_API_KEY = "devkey";
const DEV_API_SECRET = "devsecret";

export interface LiveKitServerConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
}

/**
 * LiveKit 서버 자격을 호출 시점에 읽는다(모듈 로드 시점 캡처 회피 — 테스트성).
 * 토큰/moderate 라우트와 동일 정책: prod 미설정→null, dev→devkey 폴백.
 */
export function resolveLiveKitConfig(): LiveKitServerConfig | null {
  const url = process.env.LIVEKIT_URL || "http://localhost:7880";
  let apiKey = process.env.LIVEKIT_API_KEY;
  let apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    if (process.env.NODE_ENV === "development") {
      apiKey = DEV_API_KEY;
      apiSecret = DEV_API_SECRET;
    } else {
      return null;
    }
  }
  return { apiKey, apiSecret, url };
}

export type EvictionReason = "removed" | "not_configured" | "remove_failed";

export interface EvictionResult {
  removed: boolean;
  reason: EvictionReason;
}

/**
 * 등록 사용자(userId)를 스페이스 LiveKit room 에서 강제 제거한다(best-effort).
 * - 미설정(prod no key) → 스킵(not_configured, warn).
 * - 미접속/화상 미사용/이미 퇴장 등 throw → 무시(remove_failed, warn — 원인은 메시지로 추적).
 * - 성공 → removed.
 * 화상 타일 잔존 정리용 보강이라 어떤 경우에도 throw 하지 않는다(호출측 액션 보존).
 */
export async function removeSpaceParticipant(
  spaceId: string,
  userId: string
): Promise<EvictionResult> {
  const config = resolveLiveKitConfig();
  if (!config) {
    console.warn("[LiveKit Evict] LIVEKIT 미설정 — 화상 타일 제거 스킵", { spaceId });
    return { removed: false, reason: "not_configured" };
  }

  const roomName = `space-${spaceId}`;
  const identity = `user-${userId}`;
  const svc = new RoomServiceClient(config.url, config.apiKey, config.apiSecret);

  try {
    await svc.removeParticipant(roomName, identity);
    return { removed: true, reason: "removed" };
  } catch (err) {
    console.warn("[LiveKit Evict] removeParticipant 실패(무시)", {
      roomName,
      identity,
      message: err instanceof Error ? err.message : String(err),
    });
    return { removed: false, reason: "remove_failed" };
  }
}
