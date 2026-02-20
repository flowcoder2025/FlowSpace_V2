"use client";

/**
 * ScreenShare - 화면공유 오버레이
 *
 * 기능:
 * - 반응형 크기 계산 (가로세로비 유지)
 * - 볼륨 제어
 * - 전체화면/PIP/녹화 지원
 * - 녹화 타이머 표시
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { useScreenRecorder } from "@/features/space/hooks";
import type { ParticipantTrack } from "@/features/space/livekit";

function formatRecordingTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

function calculateFitSize(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number
): { width: number; height: number } {
  if (
    videoWidth === 0 ||
    videoHeight === 0 ||
    containerWidth === 0 ||
    containerHeight === 0
  ) {
    return { width: containerWidth, height: containerHeight };
  }

  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  if (videoAspect > containerAspect) {
    const width = containerWidth;
    const height = width / videoAspect;
    return { width, height };
  } else {
    const height = containerHeight;
    const width = height * videoAspect;
    return { width, height };
  }
}

interface ScreenShareProps {
  track: ParticipantTrack;
  isLocal?: boolean;
  spaceName?: string;
  allAudioTracks?: MediaStreamTrack[];
  onClose?: () => void;
}

export function ScreenShare({
  track,
  isLocal = false,
  spaceName = "recording",
  allAudioTracks = [],
  onClose,
}: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoSize, setVideoSize] = useState({
    width: 0,
    height: 0,
  });
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem(
      `flow-screen-volume-${track.participantId}`
    );
    return saved ? parseFloat(saved) : 1;
  });

  const {
    recordingState,
    recordingTime,
    startRecording,
    stopRecording,
  } = useScreenRecorder({ spaceName });

  const isRecording =
    recordingState === "recording" || recordingState === "paused";

  // Attach screen track
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !track.screenTrack) return;

    const stream = new MediaStream([track.screenTrack]);
    video.srcObject = stream;
    video.play().catch(() => {});

    const handleMetadata = () => {
      setVideoSize({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
    video.addEventListener("loadedmetadata", handleMetadata);

    return () => {
      video.removeEventListener(
        "loadedmetadata",
        handleMetadata
      );
      video.srcObject = null;
    };
  }, [track.screenTrack]);

  // Container size observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Fullscreen detection
  useEffect(() => {
    const handler = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () =>
      document.removeEventListener("fullscreenchange", handler);
  }, []);

  const displaySize = useMemo(
    () =>
      calculateFitSize(
        videoSize.width,
        videoSize.height,
        containerSize.width,
        containerSize.height
      ),
    [videoSize, containerSize]
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
      console.error("[ScreenShare] Fullscreen error:", error);
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

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      setVolume(newVolume);
      localStorage.setItem(
        `flow-screen-volume-${track.participantId}`,
        newVolume.toString()
      );
    },
    [track.participantId]
  );

  if (!track.screenTrack) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center bg-black",
        isFullscreen
          ? "fixed inset-0 z-50"
          : "h-full w-full rounded-lg"
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="object-contain"
        style={{
          width: displaySize.width,
          height: displaySize.height,
        }}
      />

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md bg-red-600/90 px-3 py-1.5 text-white shadow-lg">
          <div className="size-2 animate-pulse rounded-full bg-white" />
          <span className="text-sm font-medium tracking-wider">
            REC {formatRecordingTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 transition-opacity duration-200",
          showControls || isFullscreen
            ? "opacity-100"
            : "opacity-0"
        )}
      >
        {/* Presenter name */}
        <div className="mb-2 text-sm text-white">
          {track.participantName}님의 화면공유
        </div>

        <div className="flex items-center justify-between">
          {/* Volume */}
          <div className="flex items-center gap-2">
            <svg
              className="size-4 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 9v6h4l5 5V4L7 9H3z" />
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) =>
                handleVolumeChange(parseFloat(e.target.value))
              }
              className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/30"
            />
            <span className="w-8 text-xs text-white/80">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleRecording}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                isRecording
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-white/20 text-white hover:bg-white/30"
              )}
            >
              {isRecording ? "녹화 중지" : "녹화"}
            </button>
            <button
              onClick={handleToggleFullscreen}
              className="rounded bg-white/20 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/30"
            >
              {isFullscreen ? "전체화면 종료" : "전체화면"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded bg-white/20 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/30"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ScreenShareOverlay - 전체 화면 오버레이
 */
interface ScreenShareOverlayProps {
  track: ParticipantTrack;
  isLocal?: boolean;
  spaceName?: string;
  allAudioTracks?: MediaStreamTrack[];
  onClose: () => void;
}

export function ScreenShareOverlay({
  track,
  isLocal,
  spaceName,
  allAudioTracks,
  onClose,
}: ScreenShareOverlayProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90">
      <div className="relative h-[90vh] w-[90vw]">
        <ScreenShare
          track={track}
          isLocal={isLocal}
          spaceName={spaceName}
          allAudioTracks={allAudioTracks}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
