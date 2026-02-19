"use client";

interface DataPoint {
  date: string;
  count: number;
}

interface UsageChartProps {
  title: string;
  data: DataPoint[];
  color?: string;
}

export function UsageChart({ title, data, color = "bg-blue-500" }: UsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="flex items-end gap-1 h-40">
        {data.map((point) => {
          const heightPct = (point.count / maxCount) * 100;
          return (
            <div key={point.date} className="flex-1 flex flex-col items-center group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                {point.date}: {point.count}
              </div>
              {/* Bar */}
              <div
                className={`w-full rounded-t ${color} transition-all`}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels (show every few labels to avoid crowding) */}
      <div className="flex gap-1 mt-1">
        {data.map((point, i) => (
          <div key={point.date} className="flex-1 text-center">
            {i % Math.max(1, Math.floor(data.length / 7)) === 0 ? (
              <span className="text-[10px] text-gray-400">
                {point.date.slice(5)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
