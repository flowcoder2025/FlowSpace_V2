const FEATURES = [
  {
    mark: "A",
    title: "공간을 직접 만드는 도구",
    body: "가구와 벽을 드래그로 배치하세요. 한 번 만들면 팀 모두의 공간이 됩니다.",
  },
  {
    mark: "B",
    title: "캐릭터로 자리 잡기",
    body: "키보드로 걷고, 점프로 인사하세요. 누가 어디 있는지 한눈에 보입니다.",
  },
  {
    mark: "C",
    title: "끊김 없는 소통",
    body: "룸에 들어서면 음성과 화상이 자동으로 연결됩니다. 채팅 창은 그 옆에서 계속 열려있습니다.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-medium tracking-wider text-ink-muted">FlowSpace의 시작</p>
          <h2 className="font-serif text-4xl font-medium tracking-tightest text-ink sm:text-5xl">
            메타버스를 만든다는 건<br />
            원래 어려운 일이었습니다.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">
            FlowSpace는 팀이 같은 자리에 있는 듯한 감각을<br />
            세 가지 방법으로 만들어냅니다.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.mark}
              className="group rounded-xl border border-line bg-cream-deep/30 p-8 transition hover:border-ink/20 hover:bg-cream-deep/60"
            >
              <div className="mb-6 grid h-10 w-10 place-items-center rounded-md bg-brand text-cream">
                <span className="font-serif text-base">{feature.mark}</span>
              </div>
              <h3 className="font-serif text-2xl font-medium text-ink">{feature.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-ink-soft">{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
