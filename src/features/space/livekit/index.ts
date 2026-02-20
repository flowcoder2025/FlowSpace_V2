/**
 * LiveKit module - Public API
 *
 * @livekit/components-react 공식 훅 기반 아키텍처:
 * - LiveKitRoomProvider: 토큰 페칭 + LiveKitRoom 컨텍스트 제공
 * - useLiveKitMedia: 컨텍스트 기반 미디어 상태/제어 (항상 안전하게 호출 가능)
 */

// Provider
export { LiveKitRoomProvider } from "./internal/LiveKitRoomProvider";

// Context-based hook (권장)
export { useLiveKitMedia } from "./internal/LiveKitMediaContext";
export type {
  MediaError,
  LiveKitMediaContextValue,
  ScreenShareOptions,
  AudioCaptureOptionsInput,
} from "./internal/LiveKitMediaContext";

// Fallback provider
export { LiveKitMediaFallbackProvider } from "./internal/LiveKitMediaContext";

// Standalone hook (LiveKitRoom 외부에서 사용 가능)
export { useLiveKitMediaHook } from "./internal/useLiveKitMedia";

// Types
export type {
  LiveKitConfig,
  MediaState,
  ParticipantTrack,
} from "./internal/types";

// Proximity subscription
export { useProximitySubscription } from "./internal/useProximitySubscription";
export type {
  Position,
  ProximityConfig,
  UseProximitySubscriptionOptions,
} from "./internal/useProximitySubscription";
