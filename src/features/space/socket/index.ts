// Communication Domain - Socket Module (Public API)
export { useSocket } from "./internal/use-socket";
export { getSocketClient, disconnectSocket } from "./internal/socket-client";
// 소켓 이벤트/페이로드 타입은 protocol 모듈이 SSOT — 하위호환 facade로 재노출(기존 소비자 무변경).
export type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
  MovementData,
  SocketData,
} from "@/features/space/protocol";
export type {
  RecordingStatusData,
  SpotlightData,
  ProximityChangedData,
} from "./internal/use-socket";
