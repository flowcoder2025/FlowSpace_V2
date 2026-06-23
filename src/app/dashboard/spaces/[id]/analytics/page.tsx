"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { UsageChart } from "@/components/dashboard/usage-chart";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { analyticsToCsv, downloadCsv, csvFilename } from "@/components/dashboard/csv-export";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

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
        if (!res.ok) throw new Error(DASHBOARD_COPY.ANALYTICS.loadError);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [spaceId, days]);

  if (error) return <div className="text-red-600 text-sm">{error}</div>;
  if (!data) return <div className="text-ink-muted text-sm">{DASHBOARD_COPY.COMMON.loading}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{DASHBOARD_COPY.ANALYTICS.title}</h1>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm border border-line rounded px-3 py-1.5"
          >
            {DASHBOARD_COPY.ANALYTICS.ranges.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
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
        <UsageChart title={DASHBOARD_COPY.ANALYTICS.dailyMessages} data={data.dailyMessages} color="bg-blue-500" />
        <UsageChart title={DASHBOARD_COPY.ANALYTICS.dailyVisitors} data={data.dailyVisitors} color="bg-green-500" />
      </div>
    </div>
  );
}
