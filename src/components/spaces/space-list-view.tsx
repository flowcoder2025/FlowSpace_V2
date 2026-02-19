"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSpaceStore } from "@/stores/space-store";
import { SpaceCard } from "./space-card";

export function SpaceListView() {
  const router = useRouter();
  const { spaces, isLoading, filter, setFilter, fetchSpaces } =
    useSpaceStore();

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "owned", "joined"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f === "all" ? "All" : f === "owned" ? "My Spaces" : "Joined"}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push("/spaces/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + New Space
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-20">
          <p className="text-lg font-medium text-gray-500">No spaces yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Create your first space or join one with an invite code
          </p>
          <button
            onClick={() => router.push("/spaces/new")}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Space
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}
    </div>
  );
}
