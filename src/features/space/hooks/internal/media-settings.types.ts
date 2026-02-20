/**
 * Media Settings Types
 *
 * 음성 및 비디오 고급 설정을 위한 타입 정의
 */

// ============================================
// Audio Settings
// ============================================

export interface AudioSettings {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  voiceIsolation: boolean;
  inputVolume: number;
  outputVolume: number;
  inputSensitivity: number;
  selectedInputDeviceId: string | null;
  selectedOutputDeviceId: string | null;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  voiceIsolation: false,
  inputVolume: 100,
  outputVolume: 100,
  inputSensitivity: 0,
  selectedInputDeviceId: null,
  selectedOutputDeviceId: null,
};

// ============================================
// Video Settings
// ============================================

export type VideoResolutionPreset = "480p" | "720p" | "1080p";

export interface VideoResolution {
  width: number;
  height: number;
  label: string;
}

export const VIDEO_RESOLUTION_PRESETS: Record<
  VideoResolutionPreset,
  VideoResolution
> = {
  "480p": { width: 640, height: 480, label: "480p (SD)" },
  "720p": { width: 1280, height: 720, label: "720p (HD)" },
  "1080p": { width: 1920, height: 1080, label: "1080p (Full HD)" },
};

export type FrameRateOption = 15 | 24 | 30 | 60;

export const FRAME_RATE_OPTIONS: {
  value: FrameRateOption;
  label: string;
}[] = [
  { value: 15, label: "15 fps (저사양)" },
  { value: 24, label: "24 fps (영화)" },
  { value: 30, label: "30 fps (표준)" },
  { value: 60, label: "60 fps (부드러움)" },
];

export type FacingMode = "user" | "environment";

export interface VideoSettings {
  selectedDeviceId: string | null;
  resolution: VideoResolutionPreset;
  frameRate: FrameRateOption;
  facingMode: FacingMode;
  mirrorMode: boolean;
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  selectedDeviceId: null,
  resolution: "480p",
  frameRate: 24,
  facingMode: "user",
  mirrorMode: true,
};

// ============================================
// Storage Keys
// ============================================

export const STORAGE_KEYS = {
  AUDIO_SETTINGS: "flowspace-audio-settings",
  VIDEO_SETTINGS: "flowspace-video-settings",
} as const;

// ============================================
// LiveKit Capture Options Helpers
// ============================================

export function toAudioCaptureOptions(settings: AudioSettings): {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  voiceIsolation?: boolean;
  deviceId?: string;
} {
  return {
    noiseSuppression: settings.noiseSuppression,
    echoCancellation: settings.echoCancellation,
    autoGainControl: settings.autoGainControl,
    ...(settings.voiceIsolation && { voiceIsolation: true }),
    ...(settings.selectedInputDeviceId && {
      deviceId: settings.selectedInputDeviceId,
    }),
  };
}

export function toVideoCaptureOptions(settings: VideoSettings): {
  resolution: { width: number; height: number; frameRate: number };
  facingMode?: FacingMode;
  deviceId?: string;
} {
  const preset = VIDEO_RESOLUTION_PRESETS[settings.resolution];

  return {
    resolution: {
      width: preset.width,
      height: preset.height,
      frameRate: settings.frameRate,
    },
    facingMode: settings.facingMode,
    ...(settings.selectedDeviceId && {
      deviceId: settings.selectedDeviceId,
    }),
  };
}
