"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ROUTES } from "@/constants/navigation";
import type { ComfyUIStatus } from "@/lib/comfyui";

const MARKETING_LINKS = [
  { label: "기능", href: "/#features" },
  { label: "사용법", href: "/#how" },
  { label: "사례", href: "/#cases" },
  { label: "가격", href: "/#pricing" },
];

function isAppRoute(pathname: string): boolean {
  return (
    pathname === "/my-spaces" ||
    pathname.startsWith("/spaces") ||
    pathname.startsWith("/dashboard")
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const spacesActive = isAppRoute(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Logo */}
        <Link href={ROUTES.HOME} className="flex items-center gap-2 text-ink">
          <Image src="/Logo.png" alt="FlowSpace" width={32} height={32} priority />
          <span className="font-serif text-xl font-medium tracking-tight">
            FlowSpace
          </span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden items-center gap-8 md:flex">
          {MARKETING_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          {session?.user && (
            <Link
              href={ROUTES.MY_SPACES}
              className={
                spacesActive
                  ? "relative text-sm font-medium text-ink after:absolute after:left-0 after:right-0 after:-bottom-[22px] after:h-[1.5px] after:bg-ink"
                  : "text-sm text-ink-soft transition-colors hover:text-ink"
              }
            >
              공간
            </Link>
          )}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <ComfyUIStatusDot />
          {session?.user ? (
            <>
              <span className="hidden text-sm text-ink-soft lg:inline lg:mr-2">
                {session.user.name || session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: ROUTES.HOME })}
                className="rounded-md border border-line bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-cream-deep"
              >
                로그아웃
              </button>
              {session.user.isSuperAdmin && (
                <Link
                  href={ROUTES.SPACES_NEW}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
                >
                  새 스페이스
                  <span aria-hidden="true">+</span>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href={ROUTES.LOGIN}
                className="rounded-md border border-line bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-cream-deep"
              >
                로그인
              </Link>
              <Link
                href={ROUTES.LOGIN}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
              >
                시작하기
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-ink-soft transition-colors hover:bg-cream-deep hover:text-ink md:hidden"
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileOpen}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-line bg-cream md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-6 py-4">
            {MARKETING_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2.5 text-base text-ink-soft transition-colors hover:bg-cream-deep hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            {session?.user && (
              <Link
                href={ROUTES.MY_SPACES}
                onClick={() => setMobileOpen(false)}
                className={
                  spacesActive
                    ? "block rounded-md bg-cream-deep px-3 py-2.5 text-base font-medium text-ink"
                    : "block rounded-md px-3 py-2.5 text-base text-ink-soft transition-colors hover:bg-cream-deep hover:text-ink"
                }
              >
                공간
              </Link>
            )}

            {/* Mobile actions */}
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              {session?.user ? (
                <>
                  <p className="px-3 text-xs text-ink-muted">
                    {session.user.name || session.user.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: ROUTES.HOME })}
                    className="block w-full rounded-md border border-line bg-cream px-3 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-cream-deep"
                  >
                    로그아웃
                  </button>
                  {session.user.isSuperAdmin && (
                    <Link
                      href={ROUTES.SPACES_NEW}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md bg-brand px-3 py-2.5 text-center text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
                    >
                      새 스페이스 +
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link
                    href={ROUTES.LOGIN}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md border border-line bg-cream px-3 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-cream-deep"
                  >
                    로그인
                  </Link>
                  <Link
                    href={ROUTES.LOGIN}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md bg-brand px-3 py-2.5 text-center text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
                  >
                    시작하기 →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

const STATUS_POLL_INTERVAL = 30_000;

function ComfyUIStatusDot() {
  const [status, setStatus] = useState<ComfyUIStatus | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let mounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/comfyui/status");
        if (res.ok && mounted) {
          setStatus(await res.json());
        }
      } catch {
        // Silently ignore
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, STATUS_POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!status) return null;

  const dotColor =
    status.resolvedMode === "real" ? "bg-emerald-400" : "bg-amber-400";

  const title =
    status.resolvedMode === "real"
      ? `ComfyUI: connected (${status.url})`
      : `ComfyUI: mock mode`;

  return (
    <span
      className={`mr-2 inline-block h-2 w-2 rounded-full ${dotColor}`}
      title={title}
    />
  );
}
