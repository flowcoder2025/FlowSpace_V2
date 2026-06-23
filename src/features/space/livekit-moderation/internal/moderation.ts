// Space Domain - LiveKit Moderation (server-safe pure logic)
//
// 운영자(OWNER/STAFF/superAdmin)의 "타인 음성(마이크) 강제 음소거" 서버 계약(WI-038)의
// 순수 로직. RoomServiceClient orchestration(getParticipant/updateParticipant/
// mutePublishedTrack)은 라우트에 두고, 여기엔 식별자 파싱·마이크 트랙 선택·권한
// 재계산만 둔다(vitest 단위 검증 가능).
//
// ⚠️ livekit 배럴(src/features/space/livekit)은 클라이언트 전용(React provider/hook)이라
// 서버 라우트가 import하면 클라 코드가 끌려온다. 그래서 enforce 모듈처럼 server-safe
// 별도 모듈로 분리한다.
import { TrackSource, type ParticipantPermission } from "livekit-server-sdk";

/** LiveKit participant identity 해석 결과. */
export type ParticipantIdentity =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestSessionId: string };

const USER_PREFIX = "user-";
const GUEST_PREFIX = "guest-";

/**
 * LiveKit participant.identity를 파싱한다.
 * 토큰 라우트가 발급하는 형식만 허용: `user-{userId}` / `guest-{guestSessionId}`.
 * `dev-anon-*`(dev 편의 식별자)·prefix 없는 값·remainder 빈 값은 거부(null).
 */
export function parseParticipantIdentity(
  identity: unknown
): ParticipantIdentity | null {
  if (typeof identity !== "string") return null;
  if (identity.startsWith(USER_PREFIX)) {
    const userId = identity.slice(USER_PREFIX.length);
    return userId.length > 0 ? { kind: "user", userId } : null;
  }
  if (identity.startsWith(GUEST_PREFIX)) {
    const guestSessionId = identity.slice(GUEST_PREFIX.length);
    return guestSessionId.length > 0
      ? { kind: "guest", guestSessionId }
      : null;
  }
  return null;
}

/** 마이크 외에 앱이 publish하는 source들(canPublishSources allowlist 구성용). */
const NON_MIC_PUBLISH_SOURCES: readonly TrackSource[] = [
  TrackSource.CAMERA,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO,
];

/** 참가자 트랙 목록에서 마이크 트랙을 찾는다(sid + 현재 muted). 없으면 null. */
export function findMicrophoneTrack(
  tracks: ReadonlyArray<{ sid: string; source: TrackSource; muted: boolean }>
): { sid: string; muted: boolean } | null {
  const mic = tracks.find((t) => t.source === TrackSource.MICROPHONE);
  return mic ? { sid: mic.sid, muted: mic.muted } : null;
}

/**
 * 음소거 시 canPublishSources 재계산.
 * LiveKit 시맨틱: `[]`=전체 허용, non-empty=명시 allowlist.
 * - 현재 `[]`(전체 허용) → 마이크만 제외한 명시 목록으로 좁힌다.
 * - non-empty → 마이크만 필터링(다른 source 제한은 보존 — codex risk #1).
 */
export function computePublishSourcesForMute(
  current: readonly TrackSource[]
): TrackSource[] {
  const base =
    current.length === 0
      ? [...NON_MIC_PUBLISH_SOURCES, TrackSource.MICROPHONE]
      : current;
  return base.filter((s) => s !== TrackSource.MICROPHONE);
}

/**
 * 음소거 해제 시 canPublishSources 재계산(권한 복원만 — force-unmute 아님).
 * - 현재 `[]`(전체 허용) → `[]` 유지(마이크 이미 허용, idempotent no-op).
 * - non-empty → 마이크 없으면 추가, 있으면 그대로(다른 source 제한 보존).
 */
export function computePublishSourcesForUnmute(
  current: readonly TrackSource[]
): TrackSource[] {
  if (current.length === 0) return [];
  return current.includes(TrackSource.MICROPHONE)
    ? [...current]
    : [...current, TrackSource.MICROPHONE];
}

/**
 * updateParticipant에 넘길 permission을 만든다.
 * ⚠️ LiveKit permission은 atomic("all desired permissions would need to be set")이라
 * 현재 permission의 canSubscribe/canPublish/canPublishData/hidden을 **그대로 보존**하고
 * canPublishSources만 마이크 add/remove로 수정한다(codex risk #1: 다른 제재 해제 방지).
 * 현재 permission이 없으면 토큰 라우트 grant와 동일한 기본값을 사용한다.
 */
export function buildModeratedPermission(
  current: Partial<ParticipantPermission> | undefined,
  muted: boolean
): Partial<ParticipantPermission> {
  const sources = current?.canPublishSources ?? [];
  return {
    canSubscribe: current?.canSubscribe ?? true,
    canPublish: current?.canPublish ?? true,
    canPublishData: current?.canPublishData ?? true,
    hidden: current?.hidden ?? false,
    canPublishSources: muted
      ? computePublishSourcesForMute(sources)
      : computePublishSourcesForUnmute(sources),
  };
}
