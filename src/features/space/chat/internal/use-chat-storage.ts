"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "./chat-types";
import {
  STORAGE_PREFIX,
  MAX_MESSAGES,
  DEBOUNCE_MS,
  CACHE_EXPIRY_DAYS,
} from "./chat-constants";

interface UseChatStorageOptions {
  spaceId: string;
  messages: ChatMessage[];
}

interface UseChatStorageReturn {
  loadCachedMessages: () => ChatMessage[];
  clearCache: () => void;
}

export function useChatStorage({ spaceId, messages }: UseChatStorageOptions): UseChatStorageReturn {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = `${STORAGE_PREFIX}${spaceId}`;

  // 디바운스 저장
  useEffect(() => {
    if (messages.length === 0) return;

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        // tempId 패턴 제외
        const filtered = messages
          .filter((m) => !m.tempId?.startsWith("msg-") || m.id !== m.tempId)
          .filter((m) => !m.failed)
          .slice(-MAX_MESSAGES);

        const data = {
          messages: filtered,
          savedAt: new Date().toISOString(),
        };

        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
      } catch (err) {
        console.warn("[ChatStorage] Save failed:", err);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [messages, storageKey]);

  /** 캐시에서 메시지 로드 */
  const loadCachedMessages = useCallback((): ChatMessage[] => {
    try {
      if (typeof window === "undefined") return [];

      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];

      const data = JSON.parse(raw) as { messages: ChatMessage[]; savedAt: string };

      // 7일 초과 데이터 자동 정리
      const savedDate = new Date(data.savedAt);
      const now = new Date();
      const diffDays = (now.getTime() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays > CACHE_EXPIRY_DAYS) {
        localStorage.removeItem(storageKey);
        return [];
      }

      return data.messages || [];
    } catch {
      return [];
    }
  }, [storageKey]);

  /** 캐시 삭제 */
  const clearCache = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // 오래된 캐시 정리 (앱 시작 시 1회)
  useEffect(() => {
    cleanupExpiredCaches();
  }, []);

  return { loadCachedMessages, clearCache };
}

/** 만료된 캐시 전체 정리 */
function cleanupExpiredCaches() {
  try {
    if (typeof window === "undefined") return;

    const now = new Date();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw) as { savedAt: string };
        const savedDate = new Date(data.savedAt);
        const diffDays = (now.getTime() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > CACHE_EXPIRY_DAYS) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key!);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
