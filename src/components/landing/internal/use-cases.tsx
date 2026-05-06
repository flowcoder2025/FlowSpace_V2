import { ImageSlot } from "./image-slot";

const CASES = [
  {
    label: "재택 사무실",
    title: "팀의 출근 공간",
    body: "매일 같은 자리에 모이는 가벼운 사무실. 책상에 앉으면 옆 자리 동료와 자연스럽게 통화가 시작됩니다.",
    caption: "사무실 룸",
  },
  {
    label: "온라인 모임",
    title: "행사장과 모임 공간",
    body: "참가자들이 흩어지지 않는 모임. 캐릭터로 돌아다니며 원하는 그룹과 대화에 합류할 수 있습니다.",
    caption: "행사장 룸",
  },
];

export function UseCases() {
  return (
    <section id="cases" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-serif text-4xl font-medium tracking-tightest text-ink sm:text-5xl">
            이런 자리에 어울립니다.
          </h2>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          {CASES.map((useCase) => (
            <article
              key={useCase.title}
              className="overflow-hidden rounded-2xl border border-line bg-cream"
            >
              <ImageSlot alt={useCase.caption} caption={useCase.caption} aspect="aspect-[16/10]" rounded="" border={false} />
              <div className="p-8">
                <p className="text-xs font-medium uppercase tracking-widest text-ink-muted">
                  {useCase.label}
                </p>
                <h3 className="mt-3 font-serif text-2xl font-medium text-ink">{useCase.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-ink-soft">{useCase.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
