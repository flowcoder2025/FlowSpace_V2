"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { AnnounceForm } from "@/components/dashboard/announce-form";

interface Stats {
  memberCount: number;
  messageCount: number;
  todayMessageCount: number;
  recentActivity: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    user?: { name: string | null; email: string };
    payload?: Record<string, unknown>;
  }>;
}

export default function DashboardOverviewPage() {
  const params = useParams<{ id: string }>();
  const spaceId = params.id;
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/spaces/${spaceId}/admin/stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load stats");
        return res.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [spaceId]);

  if (error) {
    return <div className="text-red-600 text-sm">{error}</div>;
  }

  if (!stats) {
    return <div className="text-gray-500 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Members" value={stats.memberCount} />
        <StatCard label="Total Messages" value={stats.messageCount} />
        <StatCard
          label="Today Messages"
          value={stats.todayMessageCount}
          description="오늘 자정 이후"
        />
      </div>

      {/* Announcement */}
      <AnnounceForm spaceId={spaceId} />

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-gray-400">No recent activity</p>
        ) : (
          <ul className="space-y-2">
            {stats.recentActivity.map((event) => (
              <li key={event.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 mr-2">
                    {event.eventType}
                  </span>
                  <span className="text-gray-700">
                    {event.user?.name || event.user?.email || "Unknown"}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(event.createdAt).toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
