"use client";

/**
 * useAudioSettings
 *
 * 오디오 설정 관리 훅
 * - localStorage 기반 설정 영속성
 * - 음성 처리 옵션 관리
 * - 커스텀 이벤트 기반 크로스 탭 동기화
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  type AudioSettings,
  DEFAULT_AUDIO_SETTINGS,
  STORAGE_KEYS,
  toAudioCaptureOptions,
} from "./media-settings.types";

const AUDIO_SETTINGS_CHANGED_EVENT =
  "flowspace-audio-settings-changed";

export function useAudioSettings() {
  const [settings, setSettings] = useState<AudioSettings>(
    DEFAULT_AUDIO_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(true);
  const isLocalChangeRef = useRef(false);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(
        STORAGE_KEYS.AUDIO_SETTINGS
      );
      if (stored) {
        const parsed = JSON.parse(
          stored
        ) as Partial<AudioSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn(
        "[useAudioSettings] localStorage 로드 실패:",
        err
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage + dispatch event
  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;

    try {
      localStorage.setItem(
        STORAGE_KEYS.AUDIO_SETTINGS,
        JSON.stringify(settings)
      );

      if (isLocalChangeRef.current) {
        window.dispatchEvent(
          new CustomEvent(AUDIO_SETTINGS_CHANGED_EVENT, {
            detail: settings,
          })
        );
        isLocalChangeRef.current = false;
      }
    } catch (err) {
      console.warn(
        "[useAudioSettings] localStorage 저장 실패:",
        err
      );
    }
  }, [settings, isLoading]);

  // Listen for cross-tab changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSettingsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<AudioSettings>;
      setSettings(customEvent.detail);
    };

    window.addEventListener(
      AUDIO_SETTINGS_CHANGED_EVENT,
      handleSettingsChanged
    );
    return () => {
      window.removeEventListener(
        AUDIO_SETTINGS_CHANGED_EVENT,
        handleSettingsChanged
      );
    };
  }, []);

  const updateSettings = useCallback(
    (updates: Partial<AudioSettings>) => {
      isLocalChangeRef.current = true;
      setSettings((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const toggleNoiseSuppression = useCallback(() => {
    isLocalChangeRef.current = true;
    setSettings((prev) => ({
      ...prev,
      noiseSuppression: !prev.noiseSuppression,
    }));
  }, []);

  const toggleEchoCancellation = useCallback(() => {
    isLocalChangeRef.current = true;
    setSettings((prev) => ({
      ...prev,
      echoCancellation: !prev.echoCancellation,
    }));
  }, []);

  const toggleAutoGainControl = useCallback(() => {
    isLocalChangeRef.current = true;
    setSettings((prev) => ({
      ...prev,
      autoGainControl: !prev.autoGainControl,
    }));
  }, []);

  const toggleVoiceIsolation = useCallback(() => {
    isLocalChangeRef.current = true;
    setSettings((prev) => ({
      ...prev,
      voiceIsolation: !prev.voiceIsolation,
    }));
  }, []);

  const setInputVolume = useCallback((volume: number) => {
    isLocalChangeRef.current = true;
    setSettings((prev) => ({
      ...prev,
      inputVolume: Math.max(0, Math.min(100, volume)),
    }));
  }, []);

  const setOutputVolume = useCallback((volume: number) => {
    isLocalChangeRef.current = true;
    setSettings((prev) => ({
      ...prev,
      outputVolume: Math.max(0, Math.min(100, volume)),
    }));
  }, []);

  const setInputSensitivity = useCallback(
    (sensitivity: number) => {
      isLocalChangeRef.current = true;
      setSettings((prev) => ({
        ...prev,
        inputSensitivity: Math.max(
          0,
          Math.min(100, sensitivity)
        ),
      }));
    },
    []
  );

  const setInputDevice = useCallback(
    (deviceId: string | null) => {
      isLocalChangeRef.current = true;
      setSettings((prev) => ({
        ...prev,
        selectedInputDeviceId: deviceId,
      }));
    },
    []
  );

  const setOutputDevice = useCallback(
    (deviceId: string | null) => {
      isLocalChangeRef.current = true;
      setSettings((prev) => ({
        ...prev,
        selectedOutputDeviceId: deviceId,
      }));
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    isLocalChangeRef.current = true;
    setSettings(DEFAULT_AUDIO_SETTINGS);
  }, []);

  const audioCaptureOptions = useMemo(
    () => toAudioCaptureOptions(settings),
    [settings]
  );

  return {
    settings,
    updateSettings,
    toggleNoiseSuppression,
    toggleEchoCancellation,
    toggleAutoGainControl,
    toggleVoiceIsolation,
    setInputVolume,
    setOutputVolume,
    setInputSensitivity,
    setInputDevice,
    setOutputDevice,
    resetToDefaults,
    audioCaptureOptions,
    isLoading,
  };
}
