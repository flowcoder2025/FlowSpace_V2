import Link from "next/link";
import { ROUTES } from "@/constants/navigation";
import { ImageSlot } from "./image-slot";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-20 lg:px-8 lg:pt-32 lg:pb-28">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-cream-deep/60 px-3 py-1 text-xs text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent"></span>
              한국에서 만든 가상 공간 플랫폼
            </p>
            <h1 className="font-serif text-5xl font-medium tracking-tightest text-ink sm:text-6xl lg:text-7xl">
              다 함께 모이는<br />
              가상의 사무실.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-soft">
              팀이 매일 출근하는 공간을 직접 디자인하고,<br />
              음성과 영상으로 실시간 연결됩니다.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href={ROUTES.LOGIN}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-6 py-3.5 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
              >
                지금 시작하기
                <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 px-6 py-3.5 text-sm font-medium text-ink transition hover:border-ink/40"
              >
                팀 도입 문의
              </a>
            </div>
            <p className="mt-6 text-xs text-ink-muted">이메일 또는 Google 계정으로 즉시 이용</p>
          </div>

          <div className="relative">
            <ImageSlot
              alt="가상 룸 — 캐릭터들이 모인 사무실"
              aspect="aspect-[4/3]"
              caption="가상 룸 스크린샷"
              priority
              className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
            />
            <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-line bg-cream p-4 shadow-lg sm:block">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-accent-soft ring-2 ring-line"></div>
                <div>
                  <p className="text-xs font-medium text-ink">새 멤버가 입장했습니다</p>
                  <p className="text-[11px] text-ink-muted">방금 전</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
