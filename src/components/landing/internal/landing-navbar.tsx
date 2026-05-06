"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { ROUTES } from "@/constants/navigation";

const SECTION_LINKS = [
  { label: "기능", href: "#features" },
  { label: "사용법", href: "#how" },
  { label: "사례", href: "#cases" },
  { label: "가격", href: "#pricing" },
];

export function LandingNavbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-cream/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href={ROUTES.HOME} className="flex items-center gap-2 text-ink">
          <Image src="/Logo.png" alt="FlowSpace" width={32} height={32} priority />
          <span className="font-serif text-xl font-medium tracking-tight">FlowSpace</span>
        </Link>

        <div className="hidden items-center gap-8 sm:flex">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink-soft transition hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <Link
              href={ROUTES.MY_SPACES}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
            >
              내 스페이스 →
            </Link>
          ) : (
            <>
              <Link
                href={ROUTES.LOGIN}
                className="hidden text-sm text-ink-soft transition hover:text-ink sm:block"
              >
                로그인
              </Link>
              <Link
                href={ROUTES.LOGIN}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
              >
                시작하기
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
