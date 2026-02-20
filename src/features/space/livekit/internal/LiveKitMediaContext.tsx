"use client";

/**
 * LiveKitMediaContext
 *
 * LiveKit 미디어 상태를 컨텍스트로 제공
 * @livekit/components-react의 useTracks 훅을 사용하여 트랙 상태 자동 동기화
 *
 * 3-tier 트랙 수집 전략:
 * 1) useTracks (React 통합)
 * 2) subscribedTracksRef (이벤트 기반 백업)
 * 3) room.remoteParticipants (Fallback)
 */

import {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  useLocalParticipant,
  useParticipants,
  useMaybeRoomContext,
  useConnectionState,
  useTracks,
} from "@livekit/components-react";
import {
  Track,
  ConnectionState,
  RemoteTrackPublication,
  RoomEvent,
  RemoteParticipant,
  Participant,
  TrackPublication,
  RemoteTrack,
} from "livekit-client";
import type { ParticipantTrack, MediaState } from "./types";
import {
  MAX_TRACK_READY_RETRIES,
  TRACK_READY_POLL_INTERVAL_MS,
  LATE_JOINER_RETRY_DELAYS,
  TRACK_RESUBSCRIBE_DELAY_MS,
  MIC_RESTART_DELAY_MS,
  CAMERA_RESTART_DELAY_MS,
} from "./livekit-constants";

// ============================================
// Types
// ============================================

export type MediaError = {
  type: "permission_denied" | "not_found" | "not_connected" | "unknown";
  message: string;
};

export interface ScreenShareOptions {
  audio?: boolean;
}

export interface AudioCaptureOptionsInput {
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  voiceIsolation?: boolean;
  deviceId?: string;
}

export interface LiveKitMediaContextValue {
  participantTracks: Map<string, ParticipantTrack>;
  mediaState: MediaState;
  mediaError: MediaError | null;
  isAvailable: boolean;
  localParticipantId: string | null;
  localAudioTrack: MediaStreamTrack | null;
  toggleCamera: () => Promise<boolean>;
  toggleMicrophone: () => Promise<boolean>;
  toggleScreenShare: (options?: ScreenShareOptions) => Promise<boolean>;
  setLocalMicrophoneMuted: (muted: boolean) => Promise<boolean>;
  setLocalAudioGated: (gated: boolean) => boolean;
  replaceAudioTrackWithProcessed: (
    processedTrack: MediaStreamTrack
  ) => Promise<boolean>;
  restartMicrophoneWithOptions: (
    options: AudioCaptureOptionsInput
  ) => Promise<boolean>;
  switchCameraDevice: (deviceId: string) => Promise<boolean>;
  switchMicrophoneDevice: (deviceId: string) => Promise<boolean>;
  restartCamera: () => Promise<boolean>;
}

// ============================================
// Default value
// ============================================

const defaultContextValue: LiveKitMediaContextValue = {
  participantTracks: new Map(),
  mediaState: {
    isCameraEnabled: false,
    isMicrophoneEnabled: false,
    isScreenShareEnabled: false,
  },
  mediaError: null,
  isAvailable: false,
  localParticipantId: null,
  localAudioTrack: null,
  toggleCamera: async () => false,
  toggleMicrophone: async () => false,
  toggleScreenShare: async () => false,
  setLocalMicrophoneMuted: async () => false,
  setLocalAudioGated: () => false,
  replaceAudioTrackWithProcessed: async () => false,
  restartMicrophoneWithOptions: async () => false,
  switchCameraDevice: async () => false,
  switchMicrophoneDevice: async () => false,
  restartCamera: async () => false,
};

const LiveKitMediaContext =
  createContext<LiveKitMediaContextValue>(defaultContextValue);

/**
 * useLiveKitMedia - Context consumer hook
 * Always safe to call (returns defaults when not in LiveKit context)
 */
export function useLiveKitMedia(): LiveKitMediaContextValue {
  return useContext(LiveKitMediaContext);
}

/**
 * LiveKitMediaFallbackProvider - Default values when outside LiveKitRoom
 */
export function LiveKitMediaFallbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LiveKitMediaContext.Provider value={defaultContextValue}>
      {children}
    </LiveKitMediaContext.Provider>
  );
}

// ============================================
// Internal Provider (MUST be inside LiveKitRoom)
// ============================================

interface StoredTrackInfo {
  track: RemoteTrack;
  publication: RemoteTrackPublication;
  source: Track.Source;
}

export function LiveKitMediaInternalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mediaError, setMediaError] = useState<MediaError | null>(null);

  const room = useMaybeRoomContext();
  const connectionState = useConnectionState(room);
  const isConnected = connectionState === ConnectionState.Connected;

  const {
    localParticipant,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();

  const participants = useParticipants();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  );

  const [trackUpdateTrigger, setTrackUpdateTrigger] = useState(0);
  const subscribedTracksRef = useRef<Map<string, StoredTrackInfo>>(
    new Map()
  );
  const trackReadyRetryCountRef = useRef<number>(0);

  // ============================================
  // Subscription logic (event-driven)
  // ============================================
  useEffect(() => {
    if (!room || !isConnected) return;

    const shouldSubscribeSource = (source: Track.Source) =>
      source === Track.Source.Camera ||
      source === Track.Source.ScreenShare ||
      source === Track.Source.Microphone;

    const collectExistingSubscribedTracks = () => {
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (
            publication instanceof RemoteTrackPublication &&
            publication.track &&
            shouldSubscribeSource(publication.source)
          ) {
            const key = `${participant.identity}::${publication.source}`;
            if (!subscribedTracksRef.current.has(key)) {
              subscribedTracksRef.current.set(key, {
                track: publication.track,
                publication,
                source: publication.source,
              });
            }
          }
        });
      });
    };

    const subscribeParticipantTracks = (
      participant: RemoteParticipant
    ) => {
      participant.trackPublications.forEach((publication) => {
        if (
          publication instanceof RemoteTrackPublication &&
          shouldSubscribeSource(publication.source)
        ) {
          if (!publication.isSubscribed) {
            publication.setSubscribed(true);
          } else if (
            publication.isSubscribed &&
            !publication.track
          ) {
            publication.setSubscribed(false);
            setTimeout(() => {
              publication.setSubscribed(true);
            }, TRACK_RESUBSCRIBE_DELAY_MS);
          } else if (
            publication.isSubscribed &&
            publication.track
          ) {
            const key = `${participant.identity}::${publication.source}`;
            if (!subscribedTracksRef.current.has(key)) {
              subscribedTracksRef.current.set(key, {
                track: publication.track,
                publication,
                source: publication.source,
              });
            }
          }
        }
      });
    };

    collectExistingSubscribedTracks();
    room.remoteParticipants.forEach((p) =>
      subscribeParticipantTracks(p)
    );

    const handleParticipantConnected = (
      participant: RemoteParticipant
    ) => {
      setTimeout(
        () => subscribeParticipantTracks(participant),
        TRACK_READY_POLL_INTERVAL_MS
      );
    };

    const handleTrackPublished = (
      publication: TrackPublication,
      participant: Participant
    ) => {
      if (
        participant instanceof RemoteParticipant &&
        publication instanceof RemoteTrackPublication &&
        shouldSubscribeSource(publication.source)
      ) {
        if (!publication.isSubscribed) {
          publication.setSubscribed(true);
        }

        const waitForTrack = (attempts: number = 0) => {
          const track = publication.track;
          if (
            track &&
            track.mediaStreamTrack &&
            track.mediaStreamTrack.readyState !== "ended"
          ) {
            const key = `${participant.identity}::${publication.source}`;
            subscribedTracksRef.current.set(key, {
              track: track as RemoteTrack,
              publication,
              source: publication.source,
            });
            setTrackUpdateTrigger((prev) => prev + 1);
          } else if (attempts < MAX_TRACK_READY_RETRIES) {
            setTimeout(
              () => waitForTrack(attempts + 1),
              TRACK_READY_POLL_INTERVAL_MS
            );
          }
        };

        waitForTrack();
        setTrackUpdateTrigger((prev) => prev + 1);
      }
    };

    const handleTrackSubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      const key = `${participant.identity}::${publication.source}`;
      subscribedTracksRef.current.set(key, {
        track,
        publication,
        source: publication.source,
      });
      setTrackUpdateTrigger((prev) => prev + 1);
    };

    const handleTrackUnsubscribed = (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      const key = `${participant.identity}::${publication.source}`;
      subscribedTracksRef.current.delete(key);
      setTrackUpdateTrigger((prev) => prev + 1);
    };

    const handleTrackMuted = () => {
      setTrackUpdateTrigger((prev) => prev + 1);
    };

    const handleTrackUnmuted = () => {
      setTrackUpdateTrigger((prev) => prev + 1);
    };

    room.on(
      RoomEvent.ParticipantConnected,
      handleParticipantConnected
    );
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

    // Late joiner multi-stage retry
    const retryTimeouts = LATE_JOINER_RETRY_DELAYS.map((delay) =>
      setTimeout(() => {
        collectExistingSubscribedTracks();
        room.remoteParticipants.forEach((p) =>
          subscribeParticipantTracks(p)
        );
        setTrackUpdateTrigger((prev) => prev + 1);
      }, delay)
    );

    return () => {
      retryTimeouts.forEach(clearTimeout);
      room.off(
        RoomEvent.ParticipantConnected,
        handleParticipantConnected
      );
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(
        RoomEvent.TrackUnsubscribed,
        handleTrackUnsubscribed
      );
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    };
  }, [room, isConnected]);

  // ============================================
  // iOS Safari audio unlock
  // ============================================
  const audioUnlockedRef = useRef(false);
  const mediaSessionActivatedRef = useRef(false);

  const isIOSSafari = useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined")
      return false;
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);
    return isIOS;
  }, []);

  useEffect(() => {
    if (!room || !isConnected) return;

    const playAllAudioElements = () => {
      const audioElements = document.querySelectorAll("audio");
      audioElements.forEach((audio) => {
        if (audio.paused && audio.srcObject) {
          audio.play().catch(() => {});
        }
      });
    };

    const activateIOSMediaSession =
      async (): Promise<boolean> => {
        if (mediaSessionActivatedRef.current) return true;
        if (!isIOSSafari) {
          mediaSessionActivatedRef.current = true;
          return true;
        }

        try {
          const stream =
            await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
          stream.getTracks().forEach((track) => track.stop());
          mediaSessionActivatedRef.current = true;
          return true;
        } catch {
          return false;
        }
      };

    const tryUnlockAudio = async () => {
      if (
        audioUnlockedRef.current &&
        mediaSessionActivatedRef.current
      )
        return true;

      try {
        await room.startAudio();
        playAllAudioElements();
        audioUnlockedRef.current = true;
        return true;
      } catch {
        return false;
      }
    };

    tryUnlockAudio();

    const handleUserInteraction = async () => {
      if (isIOSSafari && !mediaSessionActivatedRef.current) {
        await activateIOSMediaSession();
      }
      await tryUnlockAudio();
      playAllAudioElements();
    };

    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction, {
      passive: true,
    });
    document.addEventListener("touchend", handleUserInteraction, {
      passive: true,
    });
    document.addEventListener("keydown", handleUserInteraction);

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener(
        "touchstart",
        handleUserInteraction
      );
      document.removeEventListener(
        "touchend",
        handleUserInteraction
      );
      document.removeEventListener(
        "keydown",
        handleUserInteraction
      );
    };
  }, [room, isConnected, isIOSSafari]);

  // ============================================
  // Sync useTracks → subscribedTracksRef
  // ============================================
  useEffect(() => {
    if (!isConnected) return;

    tracks.forEach((trackRef) => {
      if (trackRef.participant.isLocal) return;
      const publication = trackRef.publication;
      const track = publication?.track;

      if (
        track &&
        track.mediaStreamTrack &&
        track.mediaStreamTrack.readyState !== "ended"
      ) {
        const key = `${trackRef.participant.identity}::${trackRef.source}`;
        if (!subscribedTracksRef.current.has(key)) {
          subscribedTracksRef.current.set(key, {
            track: track as RemoteTrack,
            publication: publication as RemoteTrackPublication,
            source: trackRef.source,
          });
        }
      }
    });
  }, [tracks, isConnected]);

  // ============================================
  // Build participantTracks (3-tier strategy)
  // ============================================
  const participantTracks = useMemo(() => {
    const map = new Map<string, ParticipantTrack>();

    if (!isConnected || participants.length === 0) return map;

    const currentRevision = trackUpdateTrigger;

    // Base entries
    participants.forEach((participant) => {
      map.set(participant.identity, {
        participantId: participant.identity,
        participantName: participant.name || participant.identity,
        isSpeaking: participant.isSpeaking,
        isVideoMuted: true,
        isAudioMuted: true,
        isScreenMuted: true,
        revision: currentRevision,
      });
    });

    // Tier 1: useTracks
    tracks.forEach((trackRef) => {
      const identity = trackRef.participant.identity;
      const entry = map.get(identity);
      if (!entry) return;

      const publication = trackRef.publication;
      const mediaTrack = publication?.track?.mediaStreamTrack;
      const isMuted = publication?.isMuted === true;

      switch (trackRef.source) {
        case Track.Source.Camera:
          if (mediaTrack && mediaTrack.readyState !== "ended") {
            entry.videoTrack = mediaTrack;
            entry.isVideoMuted = isMuted;
          }
          break;
        case Track.Source.Microphone:
          if (mediaTrack && mediaTrack.readyState !== "ended") {
            entry.audioTrack = mediaTrack;
            entry.isAudioMuted = isMuted;
          }
          break;
        case Track.Source.ScreenShare:
          if (mediaTrack && mediaTrack.readyState !== "ended") {
            entry.screenTrack = mediaTrack;
            entry.isScreenMuted = isMuted;
          }
          break;
      }
    });

    // Tier 2: subscribedTracksRef
    // trackUpdateTrigger in deps ensures re-run when ref changes
    /* eslint-disable react-hooks/refs */
    subscribedTracksRef.current.forEach((storedInfo, key) => {
      const [identity] = key.split("::");
      const entry = map.get(identity);
      if (!entry) return;

      const mediaTrack = storedInfo.track.mediaStreamTrack;
      if (!mediaTrack || mediaTrack.readyState === "ended") return;

      const isMuted = storedInfo.publication.isMuted === true;

      switch (storedInfo.source) {
        case Track.Source.Camera:
          if (!entry.videoTrack) {
            entry.videoTrack = mediaTrack;
            entry.isVideoMuted = isMuted;
          }
          break;
        case Track.Source.Microphone:
          if (!entry.audioTrack) {
            entry.audioTrack = mediaTrack;
            entry.isAudioMuted = isMuted;
          }
          break;
        case Track.Source.ScreenShare:
          if (!entry.screenTrack) {
            entry.screenTrack = mediaTrack;
            entry.isScreenMuted = isMuted;
          }
          break;
      }
    });
    /* eslint-enable react-hooks/refs */

    // Tier 3: room.remoteParticipants fallback
    if (room) {
      room.remoteParticipants.forEach((remoteParticipant) => {
        const entry = map.get(remoteParticipant.identity);
        if (!entry) return;

        remoteParticipant.trackPublications.forEach(
          (publication) => {
            const track = publication.track;
            const isMuted = publication.isMuted === true;

            switch (publication.source) {
              case Track.Source.Camera:
                if (
                  track?.mediaStreamTrack &&
                  track.mediaStreamTrack.readyState !== "ended"
                ) {
                  if (!entry.videoTrack) {
                    entry.videoTrack = track.mediaStreamTrack;
                  }
                  entry.isVideoMuted = isMuted;
                }
                break;
              case Track.Source.Microphone:
                if (
                  track?.mediaStreamTrack &&
                  track.mediaStreamTrack.readyState !== "ended"
                ) {
                  if (!entry.audioTrack) {
                    entry.audioTrack = track.mediaStreamTrack;
                  }
                  entry.isAudioMuted = isMuted;
                }
                break;
              case Track.Source.ScreenShare:
                if (
                  track?.mediaStreamTrack &&
                  track.mediaStreamTrack.readyState !== "ended"
                ) {
                  if (!entry.screenTrack) {
                    entry.screenTrack = track.mediaStreamTrack;
                  }
                  entry.isScreenMuted = isMuted;
                }
                break;
            }
          }
        );
      });
    }

    return map;
  }, [participants, tracks, isConnected, trackUpdateTrigger, room]);

  // Track ready monitoring
  useEffect(() => {
    const pendingTracks = tracks.filter((trackRef) => {
      if (trackRef.participant.isLocal) return false;
      const pub = trackRef.publication;
      return (
        pub &&
        (pub.isSubscribed || pub.track) &&
        !pub.track?.mediaStreamTrack
      );
    });

    if (
      pendingTracks.length > 0 &&
      trackReadyRetryCountRef.current < MAX_TRACK_READY_RETRIES
    ) {
      trackReadyRetryCountRef.current++;
      const timer = setTimeout(() => {
        setTrackUpdateTrigger((prev) => prev + 1);
      }, TRACK_READY_POLL_INTERVAL_MS);
      return () => clearTimeout(timer);
    } else if (pendingTracks.length === 0) {
      trackReadyRetryCountRef.current = 0;
    }
  }, [tracks, trackUpdateTrigger]);

  // ============================================
  // Media state & controls
  // ============================================

  const mediaState: MediaState = useMemo(
    () => ({
      isCameraEnabled: isCameraEnabled ?? false,
      isMicrophoneEnabled: isMicrophoneEnabled ?? false,
      isScreenShareEnabled: isScreenShareEnabled ?? false,
    }),
    [isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled]
  );

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

  const playAllAudioElements = useCallback(() => {
    const audioElements = document.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      if (audio.paused && audio.srcObject) {
        audio.play().catch(() => {});
      }
    });
  }, []);

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
        audioUnlockedRef.current = true;
        playAllAudioElements();
      }

      const newState = !localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(newState);

      // iOS Safari touch event recovery
      if (
        typeof window !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent)
      ) {
        requestAnimationFrame(() => {
          const activeEl =
            document.activeElement as HTMLElement | null;
          if (activeEl && typeof activeEl.blur === "function") {
            activeEl.blur();
          }
        });
      }

      return true;
    } catch (error) {
      console.error("[LiveKitMediaContext] Camera toggle error:", error);
      setMediaError(parseMediaError(error));
      return false;
    }
  }, [localParticipant, room, parseMediaError, playAllAudioElements]);

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
          audioUnlockedRef.current = true;
          playAllAudioElements();
        }

        const newState = !localParticipant.isMicrophoneEnabled;
        await localParticipant.setMicrophoneEnabled(newState);

        // iOS Safari touch event recovery
        if (
          typeof window !== "undefined" &&
          /iPad|iPhone|iPod/.test(navigator.userAgent)
        ) {
          requestAnimationFrame(() => {
            const activeEl =
              document.activeElement as HTMLElement | null;
            if (
              activeEl &&
              typeof activeEl.blur === "function"
            ) {
              activeEl.blur();
            }
          });
        }

        return true;
      } catch (error) {
        console.error(
          "[LiveKitMediaContext] Microphone toggle error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    }, [
      localParticipant,
      room,
      parseMediaError,
      playAllAudioElements,
    ]);

  const toggleScreenShare = useCallback(
    async (options?: ScreenShareOptions): Promise<boolean> => {
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

        if (newState && options?.audio) {
          await localParticipant.setScreenShareEnabled(true, {
            audio: true,
            suppressLocalAudioPlayback: true,
          });
        } else {
          await localParticipant.setScreenShareEnabled(newState);
        }
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
          "[LiveKitMediaContext] Screen share toggle error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    },
    [localParticipant, parseMediaError]
  );

  // Local audio track (for VAD)
  const localAudioTrack = useMemo(() => {
    if (!localParticipant || !isConnected) return null;
    const audioTrackRef = tracks.find(
      (t) =>
        t.participant === localParticipant &&
        t.source === Track.Source.Microphone
    );
    return (
      audioTrackRef?.publication?.track?.mediaStreamTrack ?? null
    );
  }, [localParticipant, tracks, isConnected]);

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
          "[LiveKitMediaContext] setLocalMicrophoneMuted error:",
          error
        );
        return false;
      }
    },
    [localParticipant]
  );

  const setLocalAudioGated = useCallback(
    (gated: boolean): boolean => {
      if (!localParticipant) return false;

      try {
        const publication =
          localParticipant.getTrackPublication(
            Track.Source.Microphone
          );
        if (!publication?.track) return false;

        const mediaStreamTrack =
          publication.track.mediaStreamTrack;
        if (!mediaStreamTrack) return false;

        mediaStreamTrack.enabled = !gated;
        return true;
      } catch (error) {
        console.error(
          "[LiveKitMediaContext] setLocalAudioGated error:",
          error
        );
        return false;
      }
    },
    [localParticipant]
  );

  const replaceAudioTrackWithProcessed = useCallback(
    async (
      processedTrack: MediaStreamTrack
    ): Promise<boolean> => {
      if (!localParticipant || !room) return false;

      try {
        const publication =
          localParticipant.getTrackPublication(
            Track.Source.Microphone
          );
        if (!publication?.track) return false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const localTrack = publication.track as any;

        if (typeof localTrack.replaceTrack === "function") {
          try {
            await localTrack.replaceTrack(
              processedTrack,
              true
            );
            return true;
          } catch {
            // Fallback to RTCRtpSender
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const engine = (room as any).engine;
        const pc = engine?.publisher
          ?.pc as RTCPeerConnection | undefined;
        if (!pc) return false;

        const senders = pc.getSenders();
        let audioSender: RTCRtpSender | null = null;

        for (const sender of senders) {
          if (sender.track?.kind === "audio") {
            audioSender = sender;
            break;
          }
          const params = sender.getParameters();
          if (
            params.codecs?.some((c) =>
              c.mimeType.toLowerCase().includes("audio")
            )
          ) {
            audioSender = sender;
            break;
          }
        }

        if (!audioSender) {
          const transceivers = pc.getTransceivers();
          for (const transceiver of transceivers) {
            if (
              transceiver.sender &&
              transceiver.receiver?.track?.kind === "audio"
            ) {
              audioSender = transceiver.sender;
              break;
            }
          }
        }

        if (!audioSender) return false;

        await audioSender.replaceTrack(processedTrack);
        return true;
      } catch (error) {
        console.error(
          "[LiveKitMediaContext] replaceAudioTrackWithProcessed error:",
          error
        );
        return false;
      }
    },
    [localParticipant, room]
  );

  const restartMicrophoneWithOptions = useCallback(
    async (
      options: AudioCaptureOptionsInput
    ): Promise<boolean> => {
      if (!localParticipant) return false;
      if (!localParticipant.isMicrophoneEnabled) return true;

      try {
        setMediaError(null);
        await localParticipant.setMicrophoneEnabled(false);
        await new Promise((resolve) =>
          setTimeout(resolve, MIC_RESTART_DELAY_MS)
        );
        await localParticipant.setMicrophoneEnabled(true, {
          noiseSuppression: options.noiseSuppression,
          echoCancellation: options.echoCancellation,
          autoGainControl: options.autoGainControl,
          ...(options.voiceIsolation !== undefined && {
            voiceIsolation: options.voiceIsolation,
          }),
          ...(options.deviceId && {
            deviceId: options.deviceId,
          }),
        });
        return true;
      } catch (error) {
        console.error(
          "[LiveKitMediaContext] restartMicrophoneWithOptions error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    },
    [localParticipant, parseMediaError]
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
          "[LiveKitMediaContext] Camera switch error:",
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
          "[LiveKitMediaContext] Microphone switch error:",
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
          "[LiveKitMediaContext] Camera restart error:",
          error
        );
        setMediaError(parseMediaError(error));
        return false;
      }
    }, [localParticipant, parseMediaError]);

  // ============================================
  // Context value
  // ============================================
  const value = useMemo<LiveKitMediaContextValue>(
    () => ({
      participantTracks,
      mediaState,
      mediaError,
      isAvailable: isConnected,
      localParticipantId: localParticipant?.identity ?? null,
      localAudioTrack,
      toggleCamera,
      toggleMicrophone,
      toggleScreenShare,
      setLocalMicrophoneMuted,
      setLocalAudioGated,
      replaceAudioTrackWithProcessed,
      restartMicrophoneWithOptions,
      switchCameraDevice,
      switchMicrophoneDevice,
      restartCamera,
    }),
    [
      participantTracks,
      mediaState,
      mediaError,
      isConnected,
      localParticipant?.identity,
      localAudioTrack,
      toggleCamera,
      toggleMicrophone,
      toggleScreenShare,
      setLocalMicrophoneMuted,
      setLocalAudioGated,
      replaceAudioTrackWithProcessed,
      restartMicrophoneWithOptions,
      switchCameraDevice,
      switchMicrophoneDevice,
      restartCamera,
    ]
  );

  return (
    <LiveKitMediaContext.Provider value={value}>
      {children}
    </LiveKitMediaContext.Provider>
  );
}
