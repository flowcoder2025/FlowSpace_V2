"use client";

import { useState } from "react";
import Image from "next/image";

interface AssetPreviewProps {
  src: string | null;
  alt?: string;
}

export function AssetPreview({ src, alt = "Generated Asset" }: AssetPreviewProps) {
  const [zoom, setZoom] = useState(1);

  if (!src) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg border border-dashed border-gray-300">
        <p className="text-gray-400 text-sm">미리보기 없음</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-900">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          className="bg-gray-800/80 text-white w-7 h-7 rounded text-sm hover:bg-gray-700"
        >
          -
        </button>
        <span className="bg-gray-800/80 text-white px-2 h-7 flex items-center rounded text-xs">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          className="bg-gray-800/80 text-white w-7 h-7 rounded text-sm hover:bg-gray-700"
        >
          +
        </button>
      </div>

      {/* Image */}
      <div className="overflow-auto max-h-96 p-2">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          className="transition-transform"
        >
          <Image
            src={src}
            alt={alt}
            width={512}
            height={512}
            className="pixelated"
            style={{ imageRendering: "pixelated" }}
            unoptimized
          />
        </div>
      </div>

      {/* Download */}
      <div className="border-t border-gray-700 p-2 bg-gray-800">
        <a
          href={src}
          download
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          Download
        </a>
      </div>
    </div>
  );
}
