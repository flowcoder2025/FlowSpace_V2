/**
 * LiveKit Constants
 * 매직넘버 → 상수 추출
 */

/** LiveKit 서버 URL (클라이언트) */
export const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

/** 개발 환경 여부 */
export const IS_DEV = process.env.NODE_ENV === "development";

/** SKIP_LIVEKIT_IN_DEV 환경변수 */
export const SKIP_LIVEKIT_ENV =
  process.env.NEXT_PUBLIC_SKIP_LIVEKIT_IN_DEV === "true";

/** 개발 모드 + localhost: 서버 상태 자동 감지 */
export const AUTO_SKIP_IN_DEV =
  IS_DEV && LIVEKIT_URL === "ws://localhost:7880";

/** 토큰 TTL (4시간) */
export const TOKEN_TTL_SECONDS = 60 * 60 * 4;

/** Late joiner 트랙 준비 대기 최대 재시도 횟수 */
export const MAX_TRACK_READY_RETRIES = 30;

/** 트랙 준비 폴링 간격 (ms) */
export const TRACK_READY_POLL_INTERVAL_MS = 100;

/** Late joiner 다단계 재시도 지연 (ms) */
export const LATE_JOINER_RETRY_DELAYS = [
  100, 300, 600, 1000, 2000, 3000, 5000,
];

/** 근접 시스템 기본 반경 (타일 수) */
export const DEFAULT_PROXIMITY_RADIUS = 3.5;

/** 근접 업데이트 쓰로틀 간격 (ms) */
export const PROXIMITY_THROTTLE_MS = 100;

/** 근접 시스템 최소 볼륨 */
export const PROXIMITY_MIN_VOLUME = 0.3;

/** LiveKit 서버 가용성 체크 타임아웃 (ms) */
export const SERVER_CHECK_TIMEOUT_MS = 1000;

/** 마이크 재시작 딜레이 (ms) */
export const MIC_RESTART_DELAY_MS = 100;

/** 카메라 재시작 딜레이 (ms) */
export const CAMERA_RESTART_DELAY_MS = 100;

/** 트랙 재구독 딜레이 (ms) */
export const TRACK_RESUBSCRIBE_DELAY_MS = 50;
