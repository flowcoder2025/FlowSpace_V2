/** EventBridge 이벤트 타입 정의 */

// ============================================
// Event Names
// ============================================
export const GameEvents = {
  // Player events
  PLAYER_MOVED: "player:moved",
  PLAYER_JOINED: "player:joined",
  PLAYER_LEFT: "player:left",
  PLAYER_JUMPED: "player:jumped",

  // Game state events
  SCENE_READY: "scene:ready",
  SCENE_ERROR: "scene:error",

  // Remote player events (multiplayer)
  REMOTE_PLAYER_MOVED: "remote:player:moved",
  REMOTE_PLAYER_JOINED: "remote:player:joined",
  REMOTE_PLAYER_LEFT: "remote:player:left",
  REMOTE_PLAYER_AVATAR_UPDATED: "remote:player:avatar:updated",

  // Local player avatar update (→ socket bridge)
  PLAYER_AVATAR_UPDATED: "player:avatar:updated",

  // UI events
  CHAT_FOCUS: "chat:focus",
  UI_OVERLAY_TOGGLE: "ui:overlay:toggle",

  // Asset events
  ASSET_REGISTERED: "asset:registered",
  ASSET_LOAD_ERROR: "asset:load:error",
  ASSET_GENERATED: "asset:generated",
  ASSET_GENERATION_FAILED: "asset:generation:failed",
  ASSET_PROCESSING_PROGRESS: "asset:processing:progress",
  GENERATE_ASSET_REQUEST: "asset:generate:request",

  // Object interaction events
  OBJECT_INTERACT: "object:interact",
  OBJECT_PLACED: "object:placed",

  // Party zone events
  PARTY_ZONES_LOADED: "partyZone:loaded",
  PARTY_ZONE_CHANGED: "partyZone:changed",

  // Editor events
  EDITOR_ENTER: "editor:enter",
  EDITOR_EXIT: "editor:exit",
  EDITOR_TOOL_CHANGE: "editor:tool:change",
  EDITOR_TILE_SELECT: "editor:tile:select",
  EDITOR_LAYER_SELECT: "editor:layer:select",
  EDITOR_LAYER_VISIBILITY: "editor:layer:visibility",
  EDITOR_TILE_PAINTED: "editor:tile:painted",
  EDITOR_TILE_PAINT_REQUEST: "editor:tile:paintRequest",
  EDITOR_OBJECT_PLACED: "editor:object:placed",
  EDITOR_OBJECT_MOVED: "editor:object:moved",
  EDITOR_OBJECT_DELETED: "editor:object:deleted",
  EDITOR_OBJECT_SELECTED: "editor:object:selected",
  EDITOR_MAP_LOADED: "editor:map:loaded",
} as const;

// ============================================
// Payload Types
// ============================================

export interface PlayerPosition {
  id: string;
  x: number;
  y: number;
  direction: "up" | "down" | "left" | "right";
  isMoving: boolean;
}

export interface RemotePlayerData {
  userId: string;
  x: number;
  y: number;
  direction: string;
  nickname?: string;
  avatar?: string;
}

export interface SceneReadyPayload {
  sceneKey: string;
}

export interface SceneErrorPayload {
  error: string;
}

export interface ChatFocusPayload {
  focused: boolean;
}

export interface UIOverlayPayload {
  visible: boolean;
}

export interface AssetRegisteredPayload {
  assetId: string;
  type: string;
  metadata: Record<string, unknown>;
}

export interface AssetLoadErrorPayload {
  assetKey: string;
  error: string;
}

export interface AssetGeneratedPayload {
  assetId: string;
  type: string;
  metadata: Record<string, unknown>;
}

export interface AssetGenerationFailedPayload {
  error: string;
  params: Record<string, unknown>;
}

export interface AssetProcessingProgressPayload {
  assetId: string;
  progress: number;
}

export interface GenerateAssetRequestPayload {
  type: "character" | "tileset" | "object" | "map";
  prompt: string;
  params: Record<string, unknown>;
}

export interface ObjectInteractPayload {
  objectId: string;
  type: string;
}

export interface ObjectPlacedPayload {
  objectId: string;
  x: number;
  y: number;
  assetKey: string;
}

export interface PartyZoneBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PartyZoneData {
  id: string;
  name: string;
  bounds: PartyZoneBounds;
}

export interface PartyZonesLoadedPayload {
  zones: PartyZoneData[];
}

export interface PartyZoneChangedPayload {
  currentZone: PartyZoneData | null;
}

// ============================================
// Editor Payload Types
// ============================================

export interface EditorEnterPayload {
  enabled: boolean;
}

export interface EditorToolChangePayload {
  tool: string;
}

export interface EditorTileSelectPayload {
  tileIndex: number;
}

export interface EditorLayerSelectPayload {
  layer: string;
}

export interface EditorLayerVisibilityPayload {
  layer: string;
  visible: boolean;
}

export interface EditorTilePaintedPayload {
  layer: string;
  col: number;
  row: number;
  tileIndex: number;
}

export interface EditorTilePaintRequestPayload {
  layer: string;
  col: number;
  row: number;
  tileIndex: number;
}

export interface EditorObjectPlacedPayload {
  id: string;
  tempId?: string;
  objectType: string;
  positionX: number;
  positionY: number;
  label?: string;
  width?: number;
  height?: number;
}

export interface EditorObjectMovedPayload {
  id: string;
  positionX: number;
  positionY: number;
}

export interface EditorObjectDeletedPayload {
  id: string;
}

export interface EditorObjectSelectedPayload {
  id: string | null;
}

export interface EditorMapLoadedPayload {
  layers: Record<string, number[][]> | null;
  objects: Array<{
    id: string;
    objectType: string;
    positionX: number;
    positionY: number;
    assetId?: string | null;
    label?: string | null;
    rotation: number;
    width: number;
    height: number;
    linkedObjectId?: string | null;
    customData?: Record<string, unknown> | null;
  }>;
}
