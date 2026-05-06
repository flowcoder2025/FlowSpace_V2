interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
}

export function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-line p-5">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-ink">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-ink-light">{description}</p>
      )}
    </div>
  );
}
