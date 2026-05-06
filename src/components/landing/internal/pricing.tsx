export function Pricing() {
  return (
    <section id="pricing" className="border-y border-line bg-cream-deep/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-serif text-4xl font-medium tracking-tightest text-ink sm:text-5xl">
            팀에 도입하기
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-ink-soft">
            팀 규모와 운영 방식에 맞춰 안내드립니다.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl">
          <div className="rounded-2xl border border-line bg-cream p-10 text-center sm:p-12">
            <p className="text-xs font-medium uppercase tracking-widest text-ink-muted">
              FlowSpace for Teams
            </p>
            <p className="mt-4 font-serif text-5xl font-medium text-ink">문의</p>
            <p className="mx-auto mt-4 max-w-md text-base text-ink-soft">
              사용 인원, 운영 환경, 필요한 기능을 알려주시면<br />
              가장 알맞은 방식으로 안내드립니다.
            </p>

            <a
              href="mailto:contact@flow-coder.com"
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-7 py-3.5 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
            >
              문의하기
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
