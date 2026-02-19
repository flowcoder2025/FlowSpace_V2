// Game Engine - Public API
export { eventBridge, GameEvents } from "./events";
export type {
  PlayerPosition,
  RemotePlayerData,
  SceneReadyPayload,
  ChatFocusPayload,
} from "./events";

export {
  createLoadableAssets,
  loadAssetsInScene,
  fetchGeneratedAssets,
} from "./internal/asset-loader";
export type { LoadableAsset } from "./internal/asset-loader";

export { createGame, destroyGame } from "./internal/game-manager";
export type { GameOptions } from "./internal/game-manager";
