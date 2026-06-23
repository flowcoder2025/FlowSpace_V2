// Space Domain - LiveKit Moderation Module (Public API)
//
// 운영자 음성(마이크) 강제 음소거 서버 계약(WI-038)의 server-safe 순수 로직 +
// kick/ban 시 화상 타일 강제 제거(eviction, WI-045).
// 음성 moderate 의 SDK orchestration은 라우트(src/app/api/spaces/[id]/livekit/moderate)에서
// 수행하고, 이 배럴은 식별자 파싱·트랙 선택·권한 재계산(순수) + 서버 자격 resolve·강제 제거를 노출한다.
export {
  parseParticipantIdentity,
  findMicrophoneTrack,
  computePublishSourcesForMute,
  computePublishSourcesForUnmute,
  buildModeratedPermission,
} from "./internal/moderation";
export type { ParticipantIdentity } from "./internal/moderation";

// 서버 측 LiveKit 자격 resolve + 강제 제거(eviction). WI-045 kick/ban 화상 타일 정리.
export {
  resolveLiveKitConfig,
  removeSpaceParticipant,
} from "./internal/eviction";
export type {
  LiveKitServerConfig,
  EvictionReason,
  EvictionResult,
} from "./internal/eviction";
