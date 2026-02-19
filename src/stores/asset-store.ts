"use client";

import { create } from "zustand";

export type AssetTypeFilter = "all" | "character" | "tileset" | "object" | "map";
export type AssetStatusFilter = "all" | "pending" | "processing" | "completed" | "failed";

interface AssetItem {
  id: string;
  type: string;
  name: string;
  prompt: string;
  status: string;
  filePath?: string | null;
  thumbnailPath?: string | null;
  createdAt: string;
}

interface AssetStore {
  assets: AssetItem[];
  isLoading: boolean;
  typeFilter: AssetTypeFilter;
  statusFilter: AssetStatusFilter;
  setAssets: (assets: AssetItem[]) => void;
  addAsset: (asset: AssetItem) => void;
  updateAsset: (id: string, updates: Partial<AssetItem>) => void;
  removeAsset: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setTypeFilter: (filter: AssetTypeFilter) => void;
  setStatusFilter: (filter: AssetStatusFilter) => void;
}

export const useAssetStore = create<AssetStore>((set) => ({
  assets: [],
  isLoading: false,
  typeFilter: "all",
  statusFilter: "all",

  setAssets: (assets) => set({ assets }),

  addAsset: (asset) =>
    set((state) => ({ assets: [asset, ...state.assets] })),

  updateAsset: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  removeAsset: (id) =>
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
}));
