"use client";

import { useState } from "react";

interface SpaceSettingsFormProps {
  spaceId: string;
  initialValues: {
    name: string;
    description: string;
    maxUsers: number;
    accessType: string;
    primaryColor: string;
    loadingMessage: string;
  };
}

export function SpaceSettingsForm({ spaceId, initialValues }: SpaceSettingsFormProps) {
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleChange(key: string, value: string | number) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setMessage({ type: "success", text: "설정이 저장되었습니다." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="space-name" className="block text-sm font-medium text-gray-700 mb-1">
          Space Name
        </label>
        <input
          id="space-name"
          type="text"
          value={values.name}
          onChange={(e) => handleChange("name", e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="space-desc" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="space-desc"
          value={values.description}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Max Users */}
      <div>
        <label htmlFor="max-users" className="block text-sm font-medium text-gray-700 mb-1">
          Max Users
        </label>
        <input
          id="max-users"
          type="number"
          min={1}
          max={500}
          value={values.maxUsers}
          onChange={(e) => handleChange("maxUsers", Number(e.target.value))}
          className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Access Type */}
      <div>
        <label htmlFor="access-type" className="block text-sm font-medium text-gray-700 mb-1">
          Access Type
        </label>
        <select
          id="access-type"
          value={values.accessType}
          onChange={(e) => handleChange("accessType", e.target.value)}
          className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
          <option value="PASSWORD">Password</option>
        </select>
      </div>

      {/* Primary Color */}
      <div>
        <label htmlFor="primary-color" className="block text-sm font-medium text-gray-700 mb-1">
          Primary Color
        </label>
        <input
          id="primary-color"
          type="color"
          value={values.primaryColor || "#3b82f6"}
          onChange={(e) => handleChange("primaryColor", e.target.value)}
          className="w-16 h-8 border border-gray-300 rounded cursor-pointer"
        />
      </div>

      {/* Loading Message */}
      <div>
        <label htmlFor="loading-msg" className="block text-sm font-medium text-gray-700 mb-1">
          Loading Message
        </label>
        <input
          id="loading-msg"
          type="text"
          value={values.loadingMessage}
          onChange={(e) => handleChange("loadingMessage", e.target.value)}
          placeholder="Space에 입장 중입니다..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Message */}
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-6 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
