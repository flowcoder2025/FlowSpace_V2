"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { OAuthButtons } from "./oauth-buttons";

type Mode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/my-spaces";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          mode === "login"
            ? "Invalid email or password"
            : "Registration succeeded but login failed. Please try logging in."
        );
        if (mode === "register") setMode("login");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
      {/* Tab */}
      <div className="mb-6 flex rounded-lg bg-cream-deep p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "login"
              ? "bg-white text-ink shadow-sm"
              : "text-ink-muted hover:text-ink-soft"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setError("");
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "register"
              ? "bg-white text-ink shadow-sm"
              : "text-ink-muted hover:text-ink-soft"
          }`}
        >
          Register
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-ink-soft"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name (optional)"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-ink-soft"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-ink-soft"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "register" ? "8 characters minimum" : "Your password"
            }
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Processing..."
            : mode === "login"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-light">OR</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* OAuth */}
      <OAuthButtons callbackUrl={callbackUrl} />
    </div>
  );
}
