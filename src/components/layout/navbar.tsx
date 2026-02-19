"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ROUTES, NAV_ITEMS } from "@/constants/navigation";
import type { ComfyUIStatus } from "@/lib/comfyui";

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Left: Logo */}
        <Link href={ROUTES.HOME} className="text-lg font-bold text-gray-900">
          FlowSpace
        </Link>

        {/* Center: Nav links */}
        <div className="flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right: Auth */}
        <div className="flex items-center gap-3">
          <ComfyUIStatusDot />
          {session?.user ? (
            <>
              <span className="text-sm text-gray-600">
                {session.user.name || session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: ROUTES.HOME })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href={ROUTES.LOGIN}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

const STATUS_POLL_INTERVAL = 30_000;

function ComfyUIStatusDot() {
  const [status, setStatus] = useState<ComfyUIStatus | null>(null);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== "development") return;

    let mounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/comfyui/status");
        if (res.ok && mounted) {
          setStatus(await res.json());
        }
      } catch {
        // Silently ignore fetch errors
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
    status.resolvedMode === "real"
      ? "bg-green-400"
      : status.connected
        ? "bg-yellow-400"
        : "bg-yellow-400";

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
