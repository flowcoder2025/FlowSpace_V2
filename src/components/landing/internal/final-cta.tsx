import Link from "next/link";
import { ROUTES } from "@/constants/navigation";

export function FinalCta() {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <h2 className="font-serif text-5xl font-medium tracking-tightest text-ink sm:text-6xl">
          지금 팀과<br />
          모여보세요.
        </h2>
        <p className="mx-auto mt-8 max-w-md text-lg text-ink-soft">
          회의 링크를 붙여넣는 일이, 더는 없습니다.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={ROUTES.LOGIN}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-7 py-4 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
          >
            지금 시작하기
            <span aria-hidden="true">→</span>
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 px-7 py-4 text-sm font-medium text-ink transition hover:border-ink/40"
          >
            팀 도입 문의
          </a>
        </div>
      </div>
    </section>
  );
}
