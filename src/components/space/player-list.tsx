"use client";

import { useState } from "react";

interface PlayerInfo {
  id: string;
  nickname: string;
}

interface PlayerListProps {
  players: PlayerInfo[];
  currentUserId: string;
  currentNickname: string;
}

export default function PlayerList({ players, currentNickname }: PlayerListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const totalCount = players.length + 1; // +1 for self

  return (
    <div className="absolute right-4 top-14 z-40">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-1 rounded bg-gray-800/80 px-3 py-1.5 text-sm text-white hover:bg-gray-700/80"
      >
        Players ({totalCount})
      </button>

      {/* Player list panel */}
      {isOpen && (
        <div className="w-48 rounded bg-gray-800/90 p-2 text-sm text-white">
          {/* Self */}
          <div className="flex items-center gap-2 border-b border-gray-700 pb-1 mb-1">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="truncate">{currentNickname}</span>
            <span className="ml-auto text-xs text-gray-400">(You)</span>
          </div>

          {/* Others */}
          {players.length === 0 ? (
            <p className="py-1 text-xs text-gray-500">No other players</p>
          ) : (
            <ul className="max-h-48 space-y-0.5 overflow-y-auto">
              {players.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="truncate">{p.nickname}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
