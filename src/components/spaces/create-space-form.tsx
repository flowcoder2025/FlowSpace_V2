"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEMPLATES = [
  { key: "OFFICE", name: "Office", icon: "🏢", desc: "Team collaboration" },
  { key: "CLASSROOM", name: "Classroom", icon: "🏫", desc: "Teaching & learning" },
  { key: "LOUNGE", name: "Lounge", icon: "🛋️", desc: "Casual hangout" },
];

const ACCESS_TYPES = [
  { value: "PUBLIC", label: "Public", desc: "Anyone can join" },
  { value: "PASSWORD", label: "Password", desc: "Requires password to join" },
  { value: "PRIVATE", label: "Private", desc: "Invite only" },
];

export function CreateSpaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateKey, setTemplateKey] = useState("OFFICE");
  const [accessType, setAccessType] = useState("PUBLIC");
  const [accessSecret, setAccessSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          templateKey,
          accessType,
          accessSecret: accessType === "PASSWORD" ? accessSecret : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create space");
        return;
      }

      router.push("/my-spaces");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="space-name" className="mb-1 block text-sm font-medium text-gray-700">
            Space Name
          </label>
          <input
            id="space-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Space"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="space-desc" className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="space-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this space for? (optional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Template */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Template
          </label>
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplateKey(t.key)}
                className={`flex flex-col items-center rounded-lg border-2 p-3 transition-colors ${
                  templateKey === t.key
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="mt-1 text-sm font-medium">{t.name}</span>
                <span className="text-xs text-gray-400">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Access Type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Access
          </label>
          <div className="space-y-2">
            {ACCESS_TYPES.map((a) => (
              <label
                key={a.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  accessType === a.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="accessType"
                  value={a.value}
                  checked={accessType === a.value}
                  onChange={(e) => setAccessType(e.target.value)}
                  className="accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium">{a.label}</span>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Password */}
        {accessType === "PASSWORD" && (
          <div>
            <label htmlFor="space-pw" className="mb-1 block text-sm font-medium text-gray-700">
              Space Password
            </label>
            <input
              id="space-pw"
              type="text"
              required
              value={accessSecret}
              onChange={(e) => setAccessSecret(e.target.value)}
              placeholder="Set a password for this space"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Space"}
          </button>
        </div>
      </form>
    </div>
  );
}
