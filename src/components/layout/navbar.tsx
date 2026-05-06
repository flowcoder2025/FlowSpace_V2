"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { ROUTES } from "@/constants/navigation";
import type { ComfyUIStatus } from "@/lib/comfyui";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href={ROUTES.HOME} className="flex items-center gap-2 text-ink">
          <Image src="/Logo.png" alt="FlowSpace" width={32} height={32} priority />
          <span className="font-serif text-xl font-medium tracking-tight">FlowSpace</span>
        </Link>

        <div className="flex items-center gap-4">
          <ComfyUIStatusDot />
          {session?.user ? (
            <>
              <span className="hidden text-sm text-ink-soft sm:inline">
                {session.user.name || session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: ROUTES.HOME })}
                className="text-sm text-ink-muted transition-colors hover:text-ink"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href={ROUTES.LOGIN}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-deep"
            >
              로그인
            </Link>
          )}
        </div>
      </nav>
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
      className={`inline-block h-2 w-2 rounded-full ${dotColor}`}
      title={title}
    />
  );
}
