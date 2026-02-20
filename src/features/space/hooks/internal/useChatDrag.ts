/**
 * useChatDrag - 채팅창 드래그 & 리사이즈 훅
 *
 * 기능:
 * - 헤더 드래그로 위치 이동
 * - 모서리 드래그로 크기 조절
 * - localStorage에 위치/크기 저장
 * - 화면 경계 내 제한
 */
import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "flowspace-chat-position";

const getDefaultSize = () => {
  if (typeof window === "undefined") return { width: 320, height: 300 };
  const isMobile = window.innerWidth < 640;
  const isTablet = window.innerWidth < 1024;
  if (isMobile) {
    return { width: Math.min(window.innerWidth * 0.9, 320), height: 280 };
  } else if (isTablet) {
    return { width: 300, height: 280 };
  }
  return { width: 320, height: 300 };
};

const getMinSize = () => {
  if (typeof window === "undefined") return { width: 280, height: 200 };
  const isMobile = window.innerWidth < 640;
  return { width: isMobile ? 240 : 280, height: isMobile ? 180 : 200 };
};

const MAX_WIDTH = 600;
const MAX_HEIGHT = 600;

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 16, y: 400 };
  const { width: defaultWidth, height: defaultHeight } = getDefaultSize();
  const isMobile = window.innerWidth < 640;
  if (isMobile) {
    return {
      x: (window.innerWidth - defaultWidth) / 2,
      y: Math.max(50, window.innerHeight - defaultHeight - 80),
    };
  }
  return {
    x: 16,
    y: Math.max(100, window.innerHeight - defaultHeight - 100),
  };
};

interface Position { x: number; y: number }
interface Size { width: number; height: number }
interface ChatState { position: Position; size: Size }
type DragMode = "none" | "move" | "resize";

export function useChatDrag() {
  const [state, setState] = useState<ChatState>(() => {
    const defaultSize = getDefaultSize();
    if (typeof window === "undefined") {
      return { position: { x: 16, y: 400 }, size: defaultSize };
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.position && parsed.size) {
          return {
            position: {
              x: typeof parsed.position.x === "number" ? parsed.position.x : 16,
              y: typeof parsed.position.y === "number" ? parsed.position.y : 400,
            },
            size: {
              width: typeof parsed.size.width === "number" ? parsed.size.width : defaultSize.width,
              height: typeof parsed.size.height === "number" ? parsed.size.height : defaultSize.height,
            },
          };
        }
      }
    } catch { /* ignore */ }
    return { position: getDefaultPosition(), size: defaultSize };
  });

  const [dragMode, setDragMode] = useState<DragMode>("none");
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; state: ChatState } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastMouseRef = useRef<Position>({ x: 0, y: 0 });

  const clampPosition = useCallback((x: number, y: number, width: number, height: number): Position => {
    if (typeof window === "undefined") return { x, y };
    return {
      x: Math.max(0, Math.min(x, window.innerWidth - width - 16)),
      y: Math.max(0, Math.min(y, window.innerHeight - height - 16)),
    };
  }, []);

  const clampSize = useCallback((width: number, height: number): Size => {
    const minSize = getMinSize();
    return {
      width: Math.max(minSize.width, Math.min(width, MAX_WIDTH)),
      height: Math.max(minSize.height, Math.min(height, MAX_HEIGHT)),
    };
  }, []);

  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setState((cur) => {
      dragOffsetRef.current = { x: e.clientX - cur.position.x, y: e.clientY - cur.position.y };
      return cur;
    });
    setDragMode("move");
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setState((cur) => {
      dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, state: cur };
      return cur;
    });
    setDragMode("resize");
  }, []);

  useEffect(() => {
    if (dragMode === "none") return;

    const updatePosition = () => {
      const { x: mouseX, y: mouseY } = lastMouseRef.current;

      if (dragMode === "move") {
        const newX = mouseX - dragOffsetRef.current.x;
        const newY = mouseY - dragOffsetRef.current.y;
        setState((prev) => {
          const clamped = clampPosition(newX, newY, prev.size.width, prev.size.height);
          if (clamped.x === prev.position.x && clamped.y === prev.position.y) return prev;
          return { ...prev, position: clamped };
        });
      } else if (dragMode === "resize" && dragStartRef.current) {
        const deltaX = mouseX - dragStartRef.current.mouseX;
        const deltaY = mouseY - dragStartRef.current.mouseY;
        const s = dragStartRef.current.state;
        const clampedSize = clampSize(s.size.width + deltaX, s.size.height + deltaY);
        setState((prev) => {
          if (clampedSize.width === prev.size.width && clampedSize.height === prev.size.height) return prev;
          const clampedPos = clampPosition(prev.position.x, prev.position.y, clampedSize.width, clampedSize.height);
          return { position: clampedPos, size: clampedSize };
        });
      }

      rafIdRef.current = requestAnimationFrame(updatePosition);
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setDragMode("none");
      if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
      setState((cur) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cur)); } catch { /* ignore */ }
        return cur;
      });
    };

    rafIdRef.current = requestAnimationFrame(updatePosition);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragMode, clampPosition, clampSize]);

  useEffect(() => {
    const handleWindowResize = () => {
      setState((prev) => {
        const clamped = clampPosition(prev.position.x, prev.position.y, prev.size.width, prev.size.height);
        if (clamped.x === prev.position.x && clamped.y === prev.position.y) return prev;
        return { ...prev, position: clamped };
      });
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [clampPosition]);

  return {
    position: state.position,
    size: state.size,
    isDragging: dragMode !== "none",
    isResizing: dragMode === "resize",
    handleMoveStart,
    handleResizeStart,
  };
}
