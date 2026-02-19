"use client";

import { create } from "zustand";
import type {
  EditorTool,
  EditorLayerName,
  EditorMapObject,
} from "@/features/space/editor/internal/types";

interface EditorStore {
  // State
  isEditorMode: boolean;
  canEdit: boolean;
  activeTool: EditorTool;
  activeLayer: EditorLayerName;
  selectedTileIndex: number;
  selectedObjectType: string | null;
  tileData: Record<string, number[][]> | null;
  isDirty: boolean;
  isSaving: boolean;
  mapObjects: EditorMapObject[];
  selectedObjectId: string | null;
  paletteTab: "tiles" | "objects";
  layerVisibility: Record<EditorLayerName, boolean>;

  // Actions
  enterEditor: () => void;
  exitEditor: () => void;
  setCanEdit: (canEdit: boolean) => void;
  setActiveTool: (tool: EditorTool) => void;
  setActiveLayer: (layer: EditorLayerName) => void;
  setSelectedTileIndex: (index: number) => void;
  setSelectedObjectType: (type: string | null) => void;
  setTileData: (data: Record<string, number[][]>) => void;
  updateLayerTile: (layer: string, row: number, col: number, tileIndex: number) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setMapObjects: (objects: EditorMapObject[]) => void;
  addMapObject: (obj: EditorMapObject) => void;
  updateMapObject: (id: string, updates: Partial<EditorMapObject>) => void;
  removeMapObject: (id: string) => void;
  setSelectedObjectId: (id: string | null) => void;
  setPaletteTab: (tab: "tiles" | "objects") => void;
  toggleLayerVisibility: (layer: EditorLayerName) => void;
  reset: () => void;
}

const DEFAULT_VISIBILITY: Record<EditorLayerName, boolean> = {
  ground: true,
  walls: true,
  furniture: true,
  furniture_top: true,
  decorations: true,
  collision: false,
};

export const useEditorStore = create<EditorStore>((set) => ({
  // Initial state
  isEditorMode: false,
  canEdit: false,
  activeTool: "paint",
  activeLayer: "ground",
  selectedTileIndex: 0,
  selectedObjectType: null,
  tileData: null,
  isDirty: false,
  isSaving: false,
  mapObjects: [],
  selectedObjectId: null,
  paletteTab: "tiles",
  layerVisibility: { ...DEFAULT_VISIBILITY },

  // Actions
  enterEditor: () => set({ isEditorMode: true }),
  exitEditor: () =>
    set({
      isEditorMode: false,
      activeTool: "paint",
      selectedObjectId: null,
      selectedObjectType: null,
    }),
  setCanEdit: (canEdit) => set({ canEdit }),
  setActiveTool: (activeTool) =>
    set({
      activeTool,
      selectedObjectId: activeTool !== "select" ? null : undefined,
    }),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setSelectedTileIndex: (selectedTileIndex) => set({ selectedTileIndex }),
  setSelectedObjectType: (selectedObjectType) => set({ selectedObjectType }),
  setTileData: (tileData) => set({ tileData }),
  updateLayerTile: (layer, row, col, tileIndex) =>
    set((state) => {
      if (!state.tileData?.[layer]) return state;
      const newLayerData = state.tileData[layer].map((r) => [...r]);
      newLayerData[row][col] = tileIndex;
      return {
        tileData: { ...state.tileData, [layer]: newLayerData },
        isDirty: true,
      };
    }),
  setDirty: (isDirty) => set({ isDirty }),
  setSaving: (isSaving) => set({ isSaving }),
  setMapObjects: (mapObjects) => set({ mapObjects }),
  addMapObject: (obj) =>
    set((state) => ({ mapObjects: [...state.mapObjects, obj] })),
  updateMapObject: (id, updates) =>
    set((state) => ({
      mapObjects: state.mapObjects.map((o) =>
        o.id === id || o.tempId === id ? { ...o, ...updates } : o
      ),
    })),
  removeMapObject: (id) =>
    set((state) => ({
      mapObjects: state.mapObjects.filter((o) => o.id !== id && o.tempId !== id),
      selectedObjectId:
        state.selectedObjectId === id ? null : state.selectedObjectId,
    })),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  setPaletteTab: (paletteTab) => set({ paletteTab }),
  toggleLayerVisibility: (layer) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer],
      },
    })),
  reset: () =>
    set({
      isEditorMode: false,
      canEdit: false,
      activeTool: "paint",
      activeLayer: "ground",
      selectedTileIndex: 0,
      selectedObjectType: null,
      tileData: null,
      isDirty: false,
      isSaving: false,
      mapObjects: [],
      selectedObjectId: null,
      paletteTab: "tiles",
      layerVisibility: { ...DEFAULT_VISIBILITY },
    }),
}));
