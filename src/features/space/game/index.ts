// Game Engine - Public API
export { eventBridge, GameEvents } from "./events";
// EventBridge 공개 계약의 단일 진입점 — game/events 서브배럴의 payload 타입 전체를 명시 재노출.
// (WI-012-2 S3) 타 모듈은 반드시 이 배럴(@/features/space/game) 경유 — events 서브배럴 직접
// import는 ESLint no-restricted-imports로 차단. game 내부(game/internal/**)만 상대경로 ../events 허용.
export type {
  PlayerPosition,
  RemotePlayerData,
  SceneReadyPayload,
  SceneErrorPayload,
  ChatFocusPayload,
  UIOverlayPayload,
  AssetRegisteredPayload,
  AssetLoadErrorPayload,
  AssetGeneratedPayload,
  AssetGenerationFailedPayload,
  AssetProcessingProgressPayload,
  GenerateAssetRequestPayload,
  ObjectInteractPayload,
  ObjectPlacedPayload,
  PartyZoneBounds,
  PartyZoneData,
  PartyZonesLoadedPayload,
  PartyZoneChangedPayload,
  EditorEnterPayload,
  EditorToolChangePayload,
  EditorTileSelectPayload,
  EditorLayerSelectPayload,
  EditorLayerVisibilityPayload,
  EditorTilePaintedPayload,
  EditorTilePaintRequestPayload,
  EditorObjectPlacedPayload,
  EditorObjectMovedPayload,
  EditorObjectDeletedPayload,
  EditorObjectSelectedPayload,
  EditorMapLoadedPayload,
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
