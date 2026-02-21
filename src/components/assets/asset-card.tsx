"use client";

const TYPE_LABELS: Record<string, string> = {
  CHARACTER: "캐릭터",
  TILESET: "타일셋",
  OBJECT: "오브젝트",
  MAP: "맵",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  PROCESSING: "생성중",
  COMPLETED: "완료",
  FAILED: "실패",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-600",
  PROCESSING: "text-blue-600",
  COMPLETED: "text-green-600",
  FAILED: "text-red-600",
};

interface AssetCardProps {
  id: string;
  name: string;
  type: string;
  status: string;
  thumbnailPath?: string | null;
  createdAt: string;
  onClick: (id: string) => void;
}

export function AssetCard({
  id,
  name,
  type,
  status,
  thumbnailPath,
  createdAt,
  onClick,
}: AssetCardProps) {
  const isProcessing = status === "PENDING" || status === "PROCESSING";

  return (
    <button
      onClick={() => onClick(id)}
      className="text-left border border-gray-200 rounded-lg overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
    >
      {/* Thumbnail */}
      <div
        className="aspect-square relative"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        {thumbnailPath ? (
          <img
            src={thumbnailPath}
            alt={name}
            className="w-full h-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <span className="text-gray-400 text-sm">미리보기 없음</span>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {TYPE_LABELS[type] || type}
          </span>
          <span className={`text-xs font-medium ${STATUS_COLORS[status] || "text-gray-500"}`}>
            {STATUS_LABELS[status] || status}
          </span>
        </div>
        <p className="text-sm font-medium truncate mt-1 group-hover:text-blue-600 transition-colors">
          {name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(createdAt).toLocaleDateString("ko-KR")}
        </p>
      </div>
    </button>
  );
}
