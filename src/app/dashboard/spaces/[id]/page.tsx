"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { AnnounceForm } from "@/components/dashboard/announce-form";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";
import type { PublicSpaceEventPayload } from "@/lib/space-event-log-payload";

interface Stats {
  memberCount: number;
  messageCount: number;
  todayMessageCount: number;
  recentActivity: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    user?: { name: string | null; email: string } | null;
    // API가 allowlist로 정규화한 공개 payload(WI-032). 오버뷰는 미렌더.
    payload?: PublicSpaceEventPayload;
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
        if (!res.ok) throw new Error(DASHBOARD_COPY.OVERVIEW.loadError);
        return res.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [spaceId]);

  if (error) {
    return <div className="text-red-600 text-sm">{error}</div>;
  }

  if (!stats) {
    return <div className="text-ink-muted text-sm">{DASHBOARD_COPY.COMMON.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{DASHBOARD_COPY.OVERVIEW.title}</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={DASHBOARD_COPY.OVERVIEW.totalMembers} value={stats.memberCount} />
        <StatCard label={DASHBOARD_COPY.OVERVIEW.totalMessages} value={stats.messageCount} />
        <StatCard
          label={DASHBOARD_COPY.OVERVIEW.todayMessages}
          value={stats.todayMessageCount}
          description={DASHBOARD_COPY.OVERVIEW.todayMessagesDesc}
        />
      </div>

      {/* Announcement */}
      <AnnounceForm spaceId={spaceId} />

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-line p-5">
        <h3 className="text-sm font-semibold text-ink-soft mb-3">{DASHBOARD_COPY.OVERVIEW.recentActivity}</h3>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-ink-light">{DASHBOARD_COPY.OVERVIEW.noRecentActivity}</p>
        ) : (
          <ul className="space-y-2">
            {stats.recentActivity.map((event) => (
              <li key={event.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-cream-deep text-ink-muted mr-2">
                    {DASHBOARD_COPY.eventTypeLabel(event.eventType)}
                  </span>
                  <span className="text-ink-soft">
                    {event.user?.name || event.user?.email || DASHBOARD_COPY.COMMON.unknown}
                  </span>
                </div>
                <span className="text-xs text-ink-light">
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
