import { ImageSlot } from "./image-slot";

const STEPS = [
  {
    number: "01",
    caption: "빈 룸 화면",
    title: "스페이스를 만드세요",
    body: "템플릿 하나를 고르면 즉시 사용 가능한 공간이 만들어집니다.",
  },
  {
    number: "02",
    caption: "맵 에디터",
    title: "공간을 디자인하세요",
    body: "가구를 배치해 팀의 자리를 정하세요.",
  },
  {
    number: "03",
    caption: "사람들이 모인 룸",
    title: "팀을 초대하세요",
    body: "링크 한 줄을 보내면 모두가 같은 자리에 모입니다.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-line bg-cream-deep/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-serif text-4xl font-medium tracking-tightest text-ink sm:text-5xl">
            세 단계면 충분합니다.
          </h2>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number}>
              <ImageSlot alt={step.caption} caption={step.caption} aspect="aspect-[4/3]" rounded="rounded-xl" />
              <div className="mt-6 flex items-baseline gap-4">
                <span className="font-serif text-4xl font-light text-ink-light">{step.number}</span>
                <div>
                  <h3 className="font-serif text-xl font-medium text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
