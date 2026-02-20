/**
 * Space Hooks - Public API
 */

export { useAudioSettings } from "./internal/useAudioSettings";
export { useVideoSettings } from "./internal/useVideoSettings";
export {
  useScreenRecorder,
  type RecordingState,
  type NotificationType,
} from "./internal/useScreenRecorder";

// Types
export type {
  AudioSettings,
  VideoSettings,
  VideoResolutionPreset,
  FrameRateOption,
  FacingMode,
} from "./internal/media-settings.types";
export {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  VIDEO_RESOLUTION_PRESETS,
  FRAME_RATE_OPTIONS,
} from "./internal/media-settings.types";
