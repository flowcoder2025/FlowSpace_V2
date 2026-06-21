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

// ── Cross-module integration surface (editor ↔ game) ──
// editor 모듈이 타일맵 프리미티브를 참조하기 위한 공개 표면.
// 안정 공개 API가 아니며, 후속 WI에서 공유 계약 경계로 재정리 예정.
export { TILE_INDEX } from "./internal/tilemap/tileset-generator";
export { extractDefaultMapData } from "./internal/tilemap/map-data";
export type { TilemapResult } from "./internal/tilemap/tilemap-system";
