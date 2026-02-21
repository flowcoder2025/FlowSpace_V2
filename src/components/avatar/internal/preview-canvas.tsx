"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PartsAvatarConfig } from "@/features/space/avatar";
import { renderPartsPreview } from "@/features/space/avatar";

interface PreviewCanvasProps {
  config: PartsAvatarConfig;
  animate?: boolean;
}

export function PreviewCanvas({ config, animate = true }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const dirRef = useRef(0);
  const tickRef = useRef(0);

  const SCALE = 5;
  const FRAME_DELAY = 12; // 프레임당 틱 수 (약 200ms @ 60fps)

  const renderFrame = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;

    const preview = renderPartsPreview(config, dirRef.current, frameRef.current, SCALE);
    const ctx = el.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(preview, 0, 0);
  }, [config]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    el.width = 32 * SCALE;
    el.height = 48 * SCALE;

    if (!animate) {
      dirRef.current = 0;
      frameRef.current = 0;
      renderFrame();
      return;
    }

    // 워킹 애니메이션 루프: down → left → right → up
    const directions = [0, 1, 2, 3];
    let dirIdx = 0;

    const loop = () => {
      tickRef.current++;
      if (tickRef.current >= FRAME_DELAY) {
        tickRef.current = 0;
        frameRef.current = (frameRef.current + 1) % 4;
        if (frameRef.current === 0) {
          dirIdx = (dirIdx + 1) % directions.length;
          dirRef.current = directions[dirIdx];
        }
      }
      renderFrame();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [config, animate, renderFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto"
      style={{ imageRendering: "pixelated", width: 32 * SCALE, height: 48 * SCALE }}
    />
  );
}
