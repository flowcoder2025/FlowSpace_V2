"use client";

import { create } from "zustand";

interface GameStore {
  isLoading: boolean;
  isSceneReady: boolean;
  loadingProgress: number;
  error: string | null;

  setLoading: (loading: boolean) => void;
  setSceneReady: (ready: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  isLoading: true,
  isSceneReady: false,
  loadingProgress: 0,
  error: null,

  setLoading: (isLoading) => set({ isLoading }),
  setSceneReady: (isSceneReady) => set({ isSceneReady, isLoading: false }),
  setLoadingProgress: (loadingProgress) => set({ loadingProgress }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () =>
    set({
      isLoading: true,
      isSceneReady: false,
      loadingProgress: 0,
      error: null,
    }),
}));
