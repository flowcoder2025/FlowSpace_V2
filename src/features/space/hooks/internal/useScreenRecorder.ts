"use client";

/**
 * useScreenRecorder
 *
 * 클라이언트 녹화 훅
 * - MediaRecorder API 기반
 * - 여러 오디오 트랙 믹싱 지원
 * - File System Access API / 다운로드 폴백
 */

import { useState, useRef, useCallback } from "react";

// ============================================
// Types
// ============================================

export type RecordingState =
  | "idle"
  | "recording"
  | "paused"
  | "stopping";

export type NotificationType = "info" | "success" | "error";

interface Notification {
  type: NotificationType;
  message: string;
}

interface UseScreenRecorderOptions {
  spaceName: string;
  onError?: (error: string) => void;
  notificationDuration?: number;
}

// ============================================
// Utilities
// ============================================

function mixAudioTracks(audioTracks: MediaStreamTrack[]): {
  mixedStream: MediaStream;
  audioContext: AudioContext;
} | null {
  if (audioTracks.length === 0) return null;

  try {
    const audioContext = new AudioContext();
    const destination =
      audioContext.createMediaStreamDestination();

    audioTracks.forEach((track) => {
      const stream = new MediaStream([track]);
      const source =
        audioContext.createMediaStreamSource(stream);
      source.connect(destination);
    });

    return { mixedStream: destination.stream, audioContext };
  } catch (err) {
    console.error(
      "[useScreenRecorder] Failed to mix audio tracks:",
      err
    );
    return null;
  }
}

function generateFileName(spaceName: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

  const dateStr = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const safeName =
    spaceName.replace(/[<>:"/\\|?*]/g, "_").trim() || "recording";

  return `${dateStr}_${timeStr}_${safeName}.webm`;
}

function supportsFileSystemAccess(): boolean {
  return (
    typeof window !== "undefined" && "showSaveFilePicker" in window
  );
}

type SaveResult =
  | { status: "saved"; fileName: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

async function saveFile(
  blob: Blob,
  fileName: string
): Promise<SaveResult> {
  if (supportsFileSystemAccess() && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "WebM Video",
            accept: { "video/webm": [".webm"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { status: "saved", fileName };
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return { status: "cancelled" };
      }
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { status: "saved", fileName };
  } catch {
    return { status: "error", message: "파일 다운로드에 실패했습니다" };
  }
}

// ============================================
// Hook
// ============================================

export function useScreenRecorder({
  spaceName,
  onError,
  notificationDuration = 4000,
}: UseScreenRecorderOptions) {
  const [recordingState, setRecordingState] =
    useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notification | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const startTimeRef = useRef<number>(0);
  const notificationTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const showNotification = useCallback(
    (type: NotificationType, message: string) => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      setNotification({ type, message });
      notificationTimerRef.current = setTimeout(() => {
        setNotification(null);
      }, notificationDuration);
    },
    [notificationDuration]
  );

  const clearNotification = useCallback(() => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setNotification(null);
  }, []);

  const handleError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - recordingTime * 1000;
    timerRef.current = setInterval(() => {
      setRecordingTime(
        Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        )
      );
    }, 1000);
  }, [recordingTime]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(
    async (
      screenTrack: MediaStreamTrack,
      audioTracks?: MediaStreamTrack[]
    ) => {
      try {
        setError(null);
        chunksRef.current = [];

        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        const tracks: MediaStreamTrack[] = [screenTrack];

        if (audioTracks && audioTracks.length > 0) {
          const mixResult = mixAudioTracks(audioTracks);
          if (mixResult) {
            audioContextRef.current = mixResult.audioContext;
            const mixedAudioTrack =
              mixResult.mixedStream.getAudioTracks()[0];
            if (mixedAudioTrack) {
              tracks.push(mixedAudioTrack);
            }
          }
        }
        const stream = new MediaStream(tracks);

        const mimeType = MediaRecorder.isTypeSupported(
          "video/webm;codecs=vp9,opus"
        )
          ? "video/webm;codecs=vp9,opus"
          : MediaRecorder.isTypeSupported(
                "video/webm;codecs=vp8,opus"
              )
            ? "video/webm;codecs=vp8,opus"
            : "video/webm";

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onerror = () => {
          handleError("녹화 중 오류가 발생했습니다");
          setRecordingState("idle");
          stopTimer();
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000);

        setRecordingState("recording");
        setRecordingTime(0);
        startTimer();
      } catch (err) {
        console.error(
          "[useScreenRecorder] Failed to start recording:",
          err
        );
        handleError("녹화를 시작할 수 없습니다");
      }
    },
    [handleError, startTimer, stopTimer]
  );

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recordingState === "idle") return;

    setRecordingState("stopping");
    stopTimer();

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: "video/webm",
        });
        const fileName = generateFileName(spaceName);

        const result = await saveFile(blob, fileName);

        chunksRef.current = [];
        setRecordingState("idle");
        setRecordingTime(0);

        switch (result.status) {
          case "saved":
            showNotification(
              "success",
              "녹화가 저장되었습니다"
            );
            break;
          case "cancelled":
            showNotification(
              "info",
              "녹화 저장이 취소되었습니다"
            );
            break;
          case "error":
            handleError(result.message);
            break;
        }

        resolve();
      };

      recorder.stop();
    });
  }, [
    recordingState,
    spaceName,
    stopTimer,
    handleError,
    showNotification,
  ]);

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recordingState === "recording") {
      recorder.pause();
      stopTimer();
      setRecordingState("paused");
    } else if (recordingState === "paused") {
      recorder.resume();
      startTimer();
      setRecordingState("recording");
    }
  }, [recordingState, startTimer, stopTimer]);

  return {
    recordingState,
    recordingTime,
    startRecording,
    stopRecording,
    togglePause,
    error,
    notification,
    clearNotification,
  };
}

// ============================================
// Type augmentation for File System Access API
// ============================================
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }
}
