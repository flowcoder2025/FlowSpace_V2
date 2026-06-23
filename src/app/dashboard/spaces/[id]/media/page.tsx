"use client";

import { useParams } from "next/navigation";
import { MediaManagement } from "@/components/dashboard/media-management";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

export default function DashboardMediaPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{DASHBOARD_COPY.MEDIA.title}</h1>
      <p className="text-sm text-ink-muted">{DASHBOARD_COPY.MEDIA.description}</p>
      <MediaManagement spaceId={params.id} />
    </div>
  );
}
