"use client";

import { useParams } from "next/navigation";
import { MediaManagement } from "@/components/dashboard/media-management";

export default function DashboardMediaPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Media Management</h1>
      <p className="text-sm text-ink-muted">
        Manage spotlight permissions for space members. Recording and proximity
        settings are controlled in real-time from within the space.
      </p>
      <MediaManagement spaceId={params.id} />
    </div>
  );
}
