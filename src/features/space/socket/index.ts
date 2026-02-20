// Communication Domain - Socket Module (Public API)
export { useSocket } from "./internal/use-socket";
export { getSocketClient, disconnectSocket } from "./internal/socket-client";
export type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerData,
  MovementData,
  SocketData,
} from "./internal/types";
export type {
  RecordingStatusData,
  SpotlightData,
  ProximityChangedData,
} from "./internal/use-socket";
