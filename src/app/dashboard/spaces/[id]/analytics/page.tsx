"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { UsageChart } from "@/components/dashboard/usage-chart";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { analyticsToCsv, downloadCsv, csvFilename } from "@/components/dashboard/csv-export";

interface DataPoint {
  date: string;
  count: number;
}

interface AnalyticsData {
  dailyMessages: DataPoint[];
  dailyVisitors: DataPoint[];
}

export default function AnalyticsPage() {
  const params = useParams<{ id: string }>();
  const spaceId = params.id;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(14);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/spaces/${spaceId}/admin/analytics?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load analytics");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [spaceId, days]);

  if (error) return <div className="text-red-600 text-sm">{error}</div>;
  if (!data) return <div className="text-ink-muted text-sm">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm border border-line rounded px-3 py-1.5"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <ExportCsvButton
            disabled={data.dailyMessages.length === 0 && data.dailyVisitors.length === 0}
            onExport={() =>
              downloadCsv(
                csvFilename("analytics", spaceId, new Date()),
                analyticsToCsv(data)
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageChart title="Daily Messages" data={data.dailyMessages} color="bg-blue-500" />
        <UsageChart title="Daily Visitors" data={data.dailyVisitors} color="bg-green-500" />
      </div>
    </div>
  );
}
