"use client";

/**
 * useVideoSettings
 *
 * 비디오 설정 관리 훅
 * - localStorage 기반 설정 영속성
 * - 해상도/프레임레이트/미러 모드 관리
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type VideoSettings,
  type VideoResolutionPreset,
  type FrameRateOption,
  type FacingMode,
  DEFAULT_VIDEO_SETTINGS,
  STORAGE_KEYS,
  toVideoCaptureOptions,
} from "./media-settings.types";

export function useVideoSettings() {
  const [settings, setSettings] = useState<VideoSettings>(
    DEFAULT_VIDEO_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(
        STORAGE_KEYS.VIDEO_SETTINGS
      );
      if (stored) {
        const parsed = JSON.parse(
          stored
        ) as Partial<VideoSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn(
        "[useVideoSettings] localStorage 로드 실패:",
        err
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;

    try {
      localStorage.setItem(
        STORAGE_KEYS.VIDEO_SETTINGS,
        JSON.stringify(settings)
      );
    } catch (err) {
      console.warn(
        "[useVideoSettings] localStorage 저장 실패:",
        err
      );
    }
  }, [settings, isLoading]);

  const updateSettings = useCallback(
    (updates: Partial<VideoSettings>) => {
      setSettings((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const setResolution = useCallback(
    (resolution: VideoResolutionPreset) => {
      setSettings((prev) => ({ ...prev, resolution }));
    },
    []
  );

  const setFrameRate = useCallback(
    (frameRate: FrameRateOption) => {
      setSettings((prev) => ({ ...prev, frameRate }));
    },
    []
  );

  const setFacingMode = useCallback(
    (facingMode: FacingMode) => {
      setSettings((prev) => ({ ...prev, facingMode }));
    },
    []
  );

  const toggleMirrorMode = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      mirrorMode: !prev.mirrorMode,
    }));
  }, []);

  const setMirrorMode = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, mirrorMode: enabled }));
  }, []);

  const setVideoDevice = useCallback(
    (deviceId: string | null) => {
      setSettings((prev) => ({
        ...prev,
        selectedDeviceId: deviceId,
      }));
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_VIDEO_SETTINGS);
  }, []);

  const videoCaptureOptions = useMemo(
    () => toVideoCaptureOptions(settings),
    [settings]
  );

  return {
    settings,
    updateSettings,
    setResolution,
    setFrameRate,
    setFacingMode,
    toggleMirrorMode,
    setMirrorMode,
    setVideoDevice,
    resetToDefaults,
    videoCaptureOptions,
    isLoading,
  };
}
