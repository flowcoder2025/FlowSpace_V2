"use client";

/**
 * useEditor - 에디터 모드 훅
 *
 * 맵 데이터 로드/저장, EventBridge 연동, 도구/레이어/타일 선택
 */

import { useEffect, useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { eventBridge, GameEvents } from "@/features/space/game/events";
import type { EditorTilePaintedPayload, EditorObjectSelectedPayload } from "@/features/space/game/events";
import { extractDefaultMapData } from "@/features/space/game/internal/tilemap/map-data";
import type { EditorTool, EditorLayerName, EditorMapObject } from "./types";

interface UseEditorOptions {
  spaceId: string;
  canEdit: boolean;
}

export function useEditor({ spaceId, canEdit }: UseEditorOptions) {
  const store = useEditorStore();
  const initializedRef = useRef(false);

  // 권한 설정
  useEffect(() => {
    store.setCanEdit(canEdit);
    return () => {
      if (store.isEditorMode) {
        eventBridge.emit(GameEvents.EDITOR_EXIT, { enabled: false });
      }
      store.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  // 에디터 모드 초기 데이터 로드 (tileData가 없으면 기본 맵 추출)
  useEffect(() => {
    if (!store.isEditorMode || initializedRef.current) return;
    if (!store.tileData) {
      store.setTileData(extractDefaultMapData());
    }
    initializedRef.current = true;
  }, [store.isEditorMode, store.tileData, store]);

  // Phaser에서 타일 페인트 이벤트 수신 → store 업데이트
  useEffect(() => {
    const onTilePainted = (payload: unknown) => {
      const data = payload as EditorTilePaintedPayload;
      store.updateLayerTile(data.layer, data.row, data.col, data.tileIndex);
    };

    const onObjectSelected = (payload: unknown) => {
      const data = payload as EditorObjectSelectedPayload & { positionX?: number; positionY?: number };
      if (data.id) {
        store.setSelectedObjectId(data.id);
      } else if (data.positionX != null && data.positionY != null) {
        // 좌표 기반 검색
        const found = store.mapObjects.find(
          (o) =>
            Math.floor(o.positionX) === data.positionX &&
            Math.floor(o.positionY) === data.positionY
        );
        store.setSelectedObjectId(found?.id ?? null);
      }
    };

    eventBridge.on(GameEvents.EDITOR_TILE_PAINTED, onTilePainted);
    eventBridge.on(GameEvents.EDITOR_OBJECT_SELECTED, onObjectSelected);

    return () => {
      eventBridge.off(GameEvents.EDITOR_TILE_PAINTED, onTilePainted);
      eventBridge.off(GameEvents.EDITOR_OBJECT_SELECTED, onObjectSelected);
    };
  }, [store]);

  // 에디터 진입/퇴출
  const enterEditor = useCallback(() => {
    store.enterEditor();
    eventBridge.emit(GameEvents.EDITOR_ENTER, { enabled: true });
  }, [store]);

  const exitEditor = useCallback(() => {
    store.exitEditor();
    eventBridge.emit(GameEvents.EDITOR_EXIT, { enabled: false });
    initializedRef.current = false;
  }, [store]);

  // 도구 선택
  const setTool = useCallback(
    (tool: EditorTool) => {
      store.setActiveTool(tool);
      eventBridge.emit(GameEvents.EDITOR_TOOL_CHANGE, { tool });
    },
    [store]
  );

  // 레이어 선택
  const setLayer = useCallback(
    (layer: EditorLayerName) => {
      store.setActiveLayer(layer);
      eventBridge.emit(GameEvents.EDITOR_LAYER_SELECT, { layer });
    },
    [store]
  );

  // 타일 선택
  const setTile = useCallback(
    (tileIndex: number) => {
      store.setSelectedTileIndex(tileIndex);
      eventBridge.emit(GameEvents.EDITOR_TILE_SELECT, { tileIndex });
    },
    [store]
  );

  // 레이어 가시성 토글
  const toggleLayerVisibility = useCallback(
    (layer: EditorLayerName) => {
      const newVisible = !store.layerVisibility[layer];
      store.toggleLayerVisibility(layer);
      eventBridge.emit(GameEvents.EDITOR_LAYER_VISIBILITY, {
        layer,
        visible: newVisible,
      });
    },
    [store]
  );

  // 오브젝트 타입 선택
  const setObjectType = useCallback(
    (type: string | null) => {
      store.setSelectedObjectType(type);
      if (type) {
        store.setActiveTool("object-place");
        eventBridge.emit(GameEvents.EDITOR_TOOL_CHANGE, { tool: "object-place" });
      }
    },
    [store]
  );

  // 에셋 선택 (Assets 탭에서 생성된 에셋 선택)
  const setAssetSelection = useCallback(
    (assetId: string | null, objectType: string) => {
      store.setSelectedAssetId(assetId);
      if (assetId) {
        store.setSelectedObjectType(objectType);
        store.setActiveTool("object-place");
        eventBridge.emit(GameEvents.EDITOR_TOOL_CHANGE, { tool: "object-place" });
      } else {
        store.setSelectedObjectType(null);
      }
    },
    [store]
  );

  // 타일 저장
  const saveTiles = useCallback(async () => {
    if (!store.tileData || !store.isDirty) return;
    store.setSaving(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/map/tiles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapData: { version: 1, layers: store.tileData },
        }),
      });
      if (res.ok) {
        store.setDirty(false);
      }
    } finally {
      store.setSaving(false);
    }
  }, [spaceId, store]);

  // 오브젝트 배치 (API + store)
  const placeObject = useCallback(
    async (obj: {
      objectType: string;
      positionX: number;
      positionY: number;
      assetId?: string;
      label?: string;
      width?: number;
      height?: number;
    }) => {
      // Assets 탭에서 선택된 에셋이 있으면 자동으로 assetId 포함
      const assetId = obj.assetId ?? store.selectedAssetId ?? undefined;
      const tempId = `temp-${Date.now()}`;
      const tempObj: EditorMapObject = {
        id: tempId,
        tempId,
        objectType: obj.objectType,
        positionX: obj.positionX,
        positionY: obj.positionY,
        assetId: assetId ?? null,
        label: obj.label,
        rotation: 0,
        width: obj.width ?? 1,
        height: obj.height ?? 1,
      };
      store.addMapObject(tempObj);

      try {
        const res = await fetch(`/api/spaces/${spaceId}/map/objects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...obj, assetId }),
        });
        if (res.ok) {
          const saved = (await res.json()) as EditorMapObject;
          store.updateMapObject(tempId, { id: saved.id, tempId: undefined });
        } else {
          store.removeMapObject(tempId);
        }
      } catch {
        store.removeMapObject(tempId);
      }
    },
    [spaceId, store]
  );

  // 오브젝트 이동
  const moveObject = useCallback(
    async (id: string, positionX: number, positionY: number) => {
      store.updateMapObject(id, { positionX, positionY });
      eventBridge.emit(GameEvents.EDITOR_OBJECT_MOVED, { id, positionX, positionY });

      await fetch(`/api/spaces/${spaceId}/map/objects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionX, positionY }),
      });
    },
    [spaceId, store]
  );

  // 오브젝트 삭제
  const deleteObject = useCallback(
    async (id: string) => {
      store.removeMapObject(id);
      eventBridge.emit(GameEvents.EDITOR_OBJECT_DELETED, { id });

      await fetch(`/api/spaces/${spaceId}/map/objects/${id}`, {
        method: "DELETE",
      });
    },
    [spaceId, store]
  );

  // 포탈 링크
  const linkPortal = useCallback(
    async (sourceId: string, targetId: string) => {
      const res = await fetch(
        `/api/spaces/${spaceId}/map/objects/${sourceId}/link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetObjectId: targetId }),
        }
      );
      if (res.ok) {
        store.updateMapObject(sourceId, { linkedObjectId: targetId });
      }
    },
    [spaceId, store]
  );

  return {
    // State (read from store)
    isEditorMode: store.isEditorMode,
    canEdit: store.canEdit,
    activeTool: store.activeTool,
    activeLayer: store.activeLayer,
    selectedTileIndex: store.selectedTileIndex,
    selectedObjectType: store.selectedObjectType,
    selectedAssetId: store.selectedAssetId,
    tileData: store.tileData,
    isDirty: store.isDirty,
    isSaving: store.isSaving,
    mapObjects: store.mapObjects,
    selectedObjectId: store.selectedObjectId,
    paletteTab: store.paletteTab,
    layerVisibility: store.layerVisibility,

    // Actions
    enterEditor,
    exitEditor,
    setTool,
    setLayer,
    setTile,
    toggleLayerVisibility,
    setObjectType,
    setAssetSelection,
    setPaletteTab: store.setPaletteTab,
    saveTiles,
    placeObject,
    moveObject,
    deleteObject,
    linkPortal,
    setSelectedObjectId: store.setSelectedObjectId,
    setMapObjects: store.setMapObjects,
    setTileData: store.setTileData,
  };
}
