"use client";

interface SpaceHudProps {
  spaceName: string;
  isConnected: boolean;
  playerCount: number;
}

export default function SpaceHud({ spaceName, isConnected, playerCount }: SpaceHudProps) {
  return (
    <div className="absolute left-4 top-4 z-40 flex items-center gap-3 rounded bg-gray-800/80 px-3 py-2">
      {/* Space name */}
      <h2 className="text-sm font-semibold text-white">{spaceName}</h2>

      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-green-400" : "bg-red-400"
          }`}
        />
        <span className="text-xs text-gray-300">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Player count */}
      <span className="text-xs text-gray-400">
        {playerCount} online
      </span>
    </div>
  );
}
