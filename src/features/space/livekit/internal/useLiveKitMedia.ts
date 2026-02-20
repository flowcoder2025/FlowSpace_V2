"use client";

/**
 * useLiveKitMedia
 *
 * @livekit/components-react 공식 훅 기반 미디어 상태 관리 훅
 * LiveKitRoom 컨텍스트 내에서 사용해야 함
 */

import { useMemo, useCallback, useState } from "react";
import {
  useTracks,
  useLocalParticipant,
  useParticipants,
  useMaybeRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { ParticipantTrack, MediaState } from "./types";
import { CAMERA_RESTART_DELAY_MS } from "./livekit-constants";

export type MediaError = {
  type: "permission_denied" | "not_found" | "not_connected" | "unknown";
  message: string;
};

interface UseLiveKitMediaReturn {
  participantTracks: Map<string, ParticipantTrack>;
  mediaState: MediaState;
  mediaError: MediaError | null;
  isAvailable: boolean;
  localParticipantId: string | null;
  localAudioTrack: MediaStreamTrack | null;
  toggleCamera: () => Promise<boolean>;
  toggleMicrophone: () => Promise<boolean>;
  toggleScreenShare: () => Promise<boolean>;
  setLocalMicrophoneMuted: (muted: boolean) => Promise<boolean>;
  switchCameraDevice: (deviceId: string) => Promise<boolean>;
  switchMicrophoneDevice: (deviceId: string) => Promise<boolean>;
  restartCamera: () => Promise<boolean>;
}

export function useLiveKitMediaHook(): UseLiveKitMediaReturn {
  const [mediaError, setMediaError] = useState<MediaError | null>(null);

  const room = useMaybeRoomContext();
  const isInContext = !!room;
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const videoTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const audioTracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: false }],
    { onlySubscribed: false }
  );

  const participantTracks = useMemo(() => {
    const trackMap = new Map<string, ParticipantTrack>();
    if (!isInContext) return trackMap;

    participants.forEach((participant) => {
      const identity = participant.identity;

      const videoTrackRef = videoTracks.find(
        (t) =>
          t.participant.identity === identity &&
          t.source === Track.Source.Camera
      );

      const screenTrackRef = videoTracks.find(
        (t) =>
          t.participant.identity === identity &&
          t.source === Track.Source.ScreenShare
      );

      const audioTrackRef = audioTracks.find(
        (t) => t.participant.identity === identity
      );

      const trackInfo: ParticipantTrack = {
        participantId: identity,
        participantName: participant.name || identity,
        isSpeaking: participant.isSpeaking,
        isVideoMuted: true,
        isAudioMuted: true,
        isScreenMuted: true,
      };

      if (videoTrackRef?.publication?.track) {
        const mediaTrack =
          videoTrackRef.publication.track.mediaStreamTrack;
        if (mediaTrack.readyState !== "ended") {
          trackInfo.videoTrack = mediaTrack;
          trackInfo.isVideoMuted =
            videoTrackRef.publication.isMuted;
        }
      } else if (videoTrackRef?.publication) {
        trackInfo.isVideoMuted =
          videoTrackRef.publication.isMuted;
      }

      if (screenTrackRef?.publication?.track) {
        const mediaTrack =
          screenTrackRef.publication.track.mediaStreamTrack;
        if (mediaTrack.readyState !== "ended") {
          trackInfo.screenTrack = mediaTrack;
          trackInfo.isScreenMuted =
            screenTrackRef.publication.isMuted;
        }
      }

      if (audioTrackRef?.publication?.track) {
        const mediaTrack =
          audioTrackRef.publication.track.mediaStreamTrack;
        if (mediaTrack.readyState !== "ended") {
          trackInfo.audioTrack = mediaTrack;
          trackInfo.isAudioMuted =
            audioTrackRef.publication.isMuted;
        }
      } else if (audioTrackRef?.publication) {
        trackInfo.isAudioMuted =
          audioTrackRef.publication.isMuted;
      }

      trackMap.set(identity, trackInfo);
    });

    return trackMap;
  }, [
    participants,
    videoTracks,
    audioTracks,
    isInContext,
  ]);

  const mediaState: MediaState = useMemo(() => {
    if (!localParticipant) {
      return {
        isCameraEnabled: false,
        isMicrophoneEnabled: false,
        isScreenShareEnabled: false,
      };
    }
    return {
      isCameraEnabled: localParticipant.isCameraEnabled,
      isMicrophoneEnabled: localParticipant.isMicrophoneEnabled,
      isScreenShareEnabled: localParticipant.isScreenShareEnabled,
    };
  }, [localParticipant]);

  const parseMediaError = useCallback(
    (error: unknown): MediaError => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("Permission denied") ||
        errorMessage.includes("NotAllowedError")
      ) {
        return {
          type: "permission_denied",
          message: "카메라/마이크 권한이 거부되었습니다.",
        };
      }
      if (
        errorMessage.includes("NotFoundError") ||
        errorMessage.includes("not found")
      ) {
        return {
          type: "not_found",
          message: "카메라/마이크를 찾을 수 없습니다.",
        };
      }
      return { type: "unknown", message: errorMessage };
    },
    []
  );

  const toggleCamera = useCallback(async (): Promise<boolean> => {
    if (!localParticipant) {
      setMediaError({
        type: "not_connected",
        message: "LiveKit에 연결되지 않았습니다.",
      });
      return false;
    }

    try {
      setMediaError(null);
      if (room) {
        await room.startAudio().catch(() => {});
      }
      const newState = !localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(newState);
      return true;
    } catch (error) {
      console.error("[useLiveKitMedia] Camera toggle error:", error);
      setMediaError(parseMediaError(error));
      return false;
    }
  }, [localParticipant, room, parseMediaError]);

  const toggleMicrophone =
    useCallback(async (): Promise<boolean> => {
      if (!localParticipant) {
        setMediaError({
          type: "not_connected",
          message: "LiveKit에 연결되지 않았습니다.",
        });
        return false;
      }

      try {
        setMediaError(null);
        if (room) {
          await room.startAudio().catch(() => {});
        }
        const newState = !localParticipant.isMicrophoneEnabled;
        await localParticipant.setMicrophoneEnabled(newState);
        return true;
      } catch (error) {
        console.error(
          "[useLiveKitMedia] Microphone toggle error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    }, [localParticipant, room, parseMediaError]);

  const toggleScreenShare =
    useCallback(async (): Promise<boolean> => {
      if (!localParticipant) {
        setMediaError({
          type: "not_connected",
          message: "LiveKit에 연결되지 않았습니다.",
        });
        return false;
      }

      try {
        setMediaError(null);
        const newState = !localParticipant.isScreenShareEnabled;
        await localParticipant.setScreenShareEnabled(newState);
        return true;
      } catch (error) {
        const errorName =
          error instanceof Error ? error.name : "";
        const errorMessage =
          error instanceof Error
            ? error.message
            : String(error);

        const isUserCancellation =
          errorName === "NotAllowedError" ||
          errorMessage.includes("Permission denied") ||
          errorMessage.includes("cancelled") ||
          errorMessage.includes("canceled");

        if (isUserCancellation) return false;

        console.error(
          "[useLiveKitMedia] Screen share toggle error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    }, [localParticipant, parseMediaError]);

  const localParticipantId = localParticipant?.identity ?? null;

  const localAudioTrack = useMemo(() => {
    if (!localParticipant || !isInContext) return null;
    const audioTrackRef = audioTracks.find(
      (t) => t.participant === localParticipant
    );
    return (
      audioTrackRef?.publication?.track?.mediaStreamTrack ?? null
    );
  }, [localParticipant, audioTracks, isInContext]);

  const setLocalMicrophoneMuted = useCallback(
    async (muted: boolean): Promise<boolean> => {
      if (!localParticipant) return false;

      try {
        const publication =
          localParticipant.getTrackPublication(
            Track.Source.Microphone
          );
        if (!publication) return false;

        if (muted) {
          await publication.mute();
        } else {
          await publication.unmute();
        }
        return true;
      } catch (error) {
        console.error(
          "[useLiveKitMedia] setLocalMicrophoneMuted error:",
          error
        );
        return false;
      }
    },
    [localParticipant]
  );

  const switchCameraDevice = useCallback(
    async (deviceId: string): Promise<boolean> => {
      if (!room) {
        setMediaError({
          type: "not_connected",
          message: "LiveKit에 연결되지 않았습니다.",
        });
        return false;
      }

      try {
        setMediaError(null);
        await room.switchActiveDevice("videoinput", deviceId);
        return true;
      } catch (error) {
        console.error(
          "[useLiveKitMedia] Camera switch error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    },
    [room, parseMediaError]
  );

  const switchMicrophoneDevice = useCallback(
    async (deviceId: string): Promise<boolean> => {
      if (!room) {
        setMediaError({
          type: "not_connected",
          message: "LiveKit에 연결되지 않았습니다.",
        });
        return false;
      }

      try {
        setMediaError(null);
        await room.switchActiveDevice("audioinput", deviceId);
        return true;
      } catch (error) {
        console.error(
          "[useLiveKitMedia] Microphone switch error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    },
    [room, parseMediaError]
  );

  const restartCamera =
    useCallback(async (): Promise<boolean> => {
      if (!localParticipant) {
        setMediaError({
          type: "not_connected",
          message: "LiveKit에 연결되지 않았습니다.",
        });
        return false;
      }

      if (!localParticipant.isCameraEnabled) return true;

      try {
        setMediaError(null);
        await localParticipant.setCameraEnabled(false);
        await new Promise((resolve) =>
          setTimeout(resolve, CAMERA_RESTART_DELAY_MS)
        );
        await localParticipant.setCameraEnabled(true);
        return true;
      } catch (error) {
        console.error(
          "[useLiveKitMedia] Camera restart error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    }, [localParticipant, parseMediaError]);

  return {
    participantTracks,
    mediaState,
    mediaError,
    isAvailable: isInContext && !!room,
    localParticipantId,
    localAudioTrack,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    setLocalMicrophoneMuted,
    switchCameraDevice,
    switchMicrophoneDevice,
    restartCamera,
  };
}
