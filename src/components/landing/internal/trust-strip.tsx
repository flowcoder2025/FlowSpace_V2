const SCENARIOS = ["재택 사무실", "온라인 행사장", "스터디룸", "교실", "밋업"];

export function TrustStrip() {
  return (
    <section className="border-y border-line bg-cream-deep/40">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="mb-4 text-center text-xs uppercase tracking-widest text-ink-muted">
          함께 쓰는 곳
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-ink-muted">
          {SCENARIOS.map((scenario, i) => (
            <span key={scenario} className="flex items-center gap-12">
              <span className="font-serif text-lg">{scenario}</span>
              {i < SCENARIOS.length - 1 && (
                <span className="hidden text-line sm:inline">·</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
