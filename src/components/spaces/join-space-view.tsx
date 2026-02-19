"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SpaceInfo {
  id: string;
  name: string;
  description: string | null;
  accessType: string;
  memberCount: number;
  maxUsers: number;
  template: { key: string; name: string };
}

interface JoinSpaceViewProps {
  inviteCode: string;
}

export function JoinSpaceView({ inviteCode }: JoinSpaceViewProps) {
  const router = useRouter();
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/spaces/join/${inviteCode}`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Not found")))
      .then(setSpace)
      .catch(() => setError("Space not found or invalid invite code"))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const handleJoin = async () => {
    setError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/spaces/join/${inviteCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessSecret: password || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join");
        return;
      }

      router.push(`/space/${data.spaceId}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-medium text-gray-900">Space Not Found</p>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <button
          onClick={() => router.push("/my-spaces")}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to My Spaces
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-gray-900">{space.name}</h2>
        {space.description && (
          <p className="mt-2 text-sm text-gray-500">{space.description}</p>
        )}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-400">
          <span>{space.template.name}</span>
          <span>
            {space.memberCount}/{space.maxUsers} members
          </span>
        </div>
      </div>

      {space.accessType === "PASSWORD" && (
        <div className="mb-4">
          <label
            htmlFor="join-pw"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Space Password
          </label>
          <input
            id="join-pw"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to join"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        onClick={handleJoin}
        disabled={joining || (space.accessType === "PASSWORD" && !password)}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {joining ? "Joining..." : "Join Space"}
      </button>
    </div>
  );
}
