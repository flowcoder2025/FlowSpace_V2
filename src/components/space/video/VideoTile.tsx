"use client";

/**
 * VideoTile - 개별 참가자 비디오 타일
 *
 * 기능:
 * - 비디오/오디오 트랙 재생
 * - 볼륨 제어 (참가자별 localStorage 저장)
 * - 풀스크린/PIP 지원
 * - 화면공유 녹화
 * - 뮤트/스피킹 상태 표시
 * - 스포트라이트 뱃지
 * - iOS Safari 오디오 autoplay 복구
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useScreenRecorder } from "@/features/space/hooks";
import type { ParticipantTrack } from "@/features/space/livekit";

interface VideoTileProps {
  track: ParticipantTrack;
  isLocal?: boolean;
  isScreenShare?: boolean;
  className?: string;
  canRecord?: boolean;
  spaceName?: string;
  allAudioTracks?: MediaStreamTrack[];
  globalOutputVolume?: number;
  mirrorLocalVideo?: boolean;
  isSpotlight?: boolean;
}

function formatRecordingTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

export function VideoTile({
  track,
  isLocal = false,
  isScreenShare = false,
  className,
  canRecord = false,
  spaceName = "recording",
  allAudioTracks = [],
  globalOutputVolume = 100,
  mirrorLocalVideo = true,
  isSpotlight = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const volumeStorageKey = `flow-volume-${track.participantId}`;
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem(volumeStorageKey);
    return saved ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${volumeStorageKey}-muted`) === "true";
  });

  const {
    recordingState,
    recordingTime,
    startRecording,
    stopRecording,
  } = useScreenRecorder({
    spaceName,
    notificationDuration: 4000,
  });

  const isRecording =
    recordingState === "recording" || recordingState === "paused";
  const showRecordButton = isScreenShare && canRecord;
  const activeVideoTrack = isScreenShare
    ? track.screenTrack
    : track.videoTrack;

  const tryPlayAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !track.audioTrack || isLocal) return;
    try {
      await audio.play();
      setAudioBlocked(false);
    } catch (error) {
      if ((error as Error).name === "NotAllowedError") {
        setAudioBlocked(true);
      }
    }
  }, [track.audioTrack, isLocal]);

  const clearVideoElement = useCallback(
    (video: HTMLVideoElement) => {
      video.srcObject = null;
      video.load();
    },
    []
  );

  const isTrackMuted = isScreenShare
    ? track.isScreenMuted
    : track.isVideoMuted;
  const isTrackActuallyLive =
    activeVideoTrack &&
    activeVideoTrack.enabled &&
    activeVideoTrack.readyState === "live";
  const shouldShowVideo =
    !!activeVideoTrack &&
    activeVideoTrack.readyState !== "ended" &&
    (isLocal || !isTrackMuted || isTrackActuallyLive);

  // Attach video track
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!shouldShowVideo) {
      clearVideoElement(video);
      return;
    }

    const stream = new MediaStream([activeVideoTrack!]);
    video.srcObject = stream;
    video.play().catch((err) => {
      if (
        err.name !== "NotAllowedError" &&
        err.name !== "AbortError"
      ) {
        console.error("[VideoTile] Video play error:", err);
      }
    });

    const handleTrackEnded = () => clearVideoElement(video);
    activeVideoTrack!.addEventListener("ended", handleTrackEnded);

    return () => {
      activeVideoTrack!.removeEventListener(
        "ended",
        handleTrackEnded
      );
      clearVideoElement(video);
    };
  }, [
    activeVideoTrack,
    shouldShowVideo,
    isTrackMuted,
    track.revision,
    isTrackActuallyLive,
    clearVideoElement,
    isLocal,
  ]);

  // Attach audio track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isLocal) return;

    if (track.audioTrack) {
      const stream = new MediaStream([track.audioTrack]);
      audio.srcObject = stream;
      void Promise.resolve().then(async () => {
        try {
          await audio.play();
          setAudioBlocked(false);
        } catch (error) {
          if ((error as Error).name === "NotAllowedError") {
            setAudioBlocked(true);
          }
        }
      });
    } else {
      audio.srcObject = null;
      void Promise.resolve().then(() => setAudioBlocked(false));
    }

    return () => {
      audio.srcObject = null;
    };
  }, [track.audioTrack, isLocal]);

  // Audio blocked recovery
  useEffect(() => {
    if (!audioBlocked) return;
    const handler = () => tryPlayAudio();
    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler, {
      passive: true,
    });
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [audioBlocked, tryPlayAudio]);

  // Volume application
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isLocal || !audio.srcObject) return;
    const effectiveVolume = (volume * globalOutputVolume) / 100;
    audio.volume = isMuted ? 0 : effectiveVolume;
  }, [volume, isMuted, isLocal, globalOutputVolume, track.audioTrack]);

  // Fullscreen detection
  useEffect(() => {
    const handler = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () =>
      document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      setVolume(newVolume);
      localStorage.setItem(
        volumeStorageKey,
        newVolume.toString()
      );
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        localStorage.setItem(
          `${volumeStorageKey}-muted`,
          "false"
        );
      }
    },
    [volumeStorageKey, isMuted]
  );

  const handleToggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      localStorage.setItem(
        `${volumeStorageKey}-muted`,
        newMuted.toString()
      );
    },
    [isMuted, volumeStorageKey]
  );

  const handleToggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("[VideoTile] Fullscreen error:", error);
    }
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else if (track.screenTrack) {
      const audioTracksToRecord =
        allAudioTracks.length > 0
          ? allAudioTracks
          : track.audioTrack
            ? [track.audioTrack]
            : [];
      await startRecording(track.screenTrack, audioTracksToRecord);
    }
  }, [
    isRecording,
    track.screenTrack,
    track.audioTrack,
    allAudioTracks,
    startRecording,
    stopRecording,
  ]);

  const hasAudio = !!track.audioTrack;
  const isAudioMuted = track.isAudioMuted ?? !hasAudio;

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative aspect-video rounded-lg bg-black",
        !isFullscreen && "overflow-hidden",
        isSpotlight && "ring-2 ring-yellow-400 ring-offset-2",
        !isSpotlight &&
          track.isSpeaking &&
          "ring-2 ring-blue-500 ring-offset-2",
        isFullscreen &&
          "fixed inset-0 z-50 aspect-auto rounded-none",
        className
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "absolute inset-0 size-full",
          isScreenShare
            ? "object-contain bg-black"
            : "object-cover",
          !shouldShowVideo && "opacity-0 pointer-events-none",
          isLocal &&
            !isScreenShare &&
            mirrorLocalVideo &&
            "scale-x-[-1]"
        )}
      />

      {!shouldShowVideo && (
        <div className="flex size-full items-center justify-center bg-gray-900">
          <div className="flex size-16 items-center justify-center rounded-full bg-gray-700 text-2xl text-white">
            {track.participantName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {!isLocal && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          className="hidden"
        />
      )}

      {isRecording && (
        <div className="absolute left-2 top-2 flex items-center gap-2 rounded-md bg-red-600/90 px-2 py-1 text-white shadow-lg">
          <div className="size-2 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-medium tracking-wider">
            REC {formatRecordingTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute right-2 top-2 flex items-center gap-1 transition-opacity duration-200",
          showControls || isFullscreen
            ? "opacity-100"
            : "opacity-0"
        )}
      >
        {showRecordButton && (
          <button
            onClick={handleToggleRecording}
            disabled={recordingState === "stopping"}
            className={cn(
              "rounded p-1.5 transition-colors",
              isRecording
                ? "bg-red-600/80 text-white hover:bg-red-600"
                : "bg-black/60 text-red-500 hover:bg-black/80"
            )}
            title={isRecording ? "녹화 중지" : "녹화 시작"}
          >
            {isRecording ? (
              <svg
                className="size-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="6"
                  y="6"
                  width="12"
                  height="12"
                  rx="1"
                />
              </svg>
            ) : (
              <svg
                className="size-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="8" />
              </svg>
            )}
          </button>
        )}
        <button
          onClick={handleToggleFullscreen}
          className="rounded bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
          title={isFullscreen ? "전체화면 종료" : "전체화면"}
        >
          <svg
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>

      {/* Bottom info bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        {!isLocal && hasAudio && (
          <div
            className={cn(
              "mb-2 flex items-center gap-2 transition-all duration-200",
              showControls
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-2 opacity-0"
            )}
          >
            <button
              onClick={handleToggleMute}
              className="shrink-0 text-white/80 transition-colors hover:text-white"
              title={isMuted ? "음소거 해제" : "음소거"}
            >
              <svg
                className="size-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3z" />
                {!isMuted && (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                )}
              </svg>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) =>
                handleVolumeChange(parseFloat(e.target.value))
              }
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="w-8 shrink-0 text-right text-xs text-white/80">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isSpotlight && (
              <div className="rounded bg-yellow-500/90 p-0.5 text-black">
                <svg
                  className="size-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
            {track.isSpeaking && !isSpotlight && (
              <div className="rounded bg-blue-500/80 p-0.5 text-white">
                <svg
                  className="size-3 animate-pulse"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
            <span className="truncate text-xs text-white">
              {track.participantName}
              {isLocal && " (나)"}
              {isScreenShare && " - 화면공유"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {audioBlocked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  tryPlayAudio();
                }}
                className="flex items-center gap-1 rounded bg-yellow-500/90 px-1.5 py-0.5 text-xs font-medium text-white"
              >
                소리 켜기
              </button>
            )}
            {isAudioMuted && (
              <div className="rounded bg-red-500/80 p-0.5 text-white">
                <svg
                  className="size-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
            {!shouldShowVideo && (
              <div className="rounded bg-gray-500/80 p-0.5 text-white">
                <svg
                  className="size-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
