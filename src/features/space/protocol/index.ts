// Protocol Module — 통신 도메인 순수 계약 (Public API)
//
// socket 이벤트/페이로드 타입 + transport 상수의 SSOT.
// React/Node/Phaser 무의존 — 타입/상수만 노출(서버 esbuild 번들 안전).
// 서버(server/, 별도 번들)는 이 배럴을 거치지 않고 internal 순수 파일을 직접 import한다.
export type {
  PlayerData,
  MovementData,
  SocketData,
  ClientToServerEvents,
  ServerToClientEvents,
} from "./internal/socket-events";

export {
  RECONNECTION_ATTEMPTS,
  RECONNECTION_DELAY,
  RECONNECTION_DELAY_MAX,
  RECONNECTION_TIMEOUT,
  MOVE_THROTTLE_MS,
} from "./internal/socket-constants";
