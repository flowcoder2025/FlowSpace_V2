"use client";

import { useState } from "react";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface SpaceSettingsFormProps {
  spaceId: string;
  /**
   * 설정 편집 가능 여부 = PATCH /api/spaces/[id] 게이트(owner/superAdmin)의 미러.
   * false(STAFF)면 모든 입력을 읽기전용으로, 저장 버튼을 숨기고 안내를 노출한다.
   */
  canEdit: boolean;
  initialValues: {
    name: string;
    description: string;
    maxUsers: number;
    accessType: string;
    primaryColor: string;
    loadingMessage: string;
  };
}

export function SpaceSettingsForm({ spaceId, canEdit, initialValues }: SpaceSettingsFormProps) {
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleChange(key: string, value: string | number) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 이중 방어: 편집 불가(STAFF)면 PATCH 요청 자체를 보내지 않는다.
    // 서버 PATCH 403이 근본 게이트이고, 이 가드는 Enter 제출·disabled 누락 등 UX 경로 차단용.
    if (!canEdit) return;
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
        throw new Error(data.error || DASHBOARD_COPY.SETTINGS.saveError);
      }

      setMessage({ type: "success", text: DASHBOARD_COPY.SETTINGS.success });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : DASHBOARD_COPY.COMMON.unknownError });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 읽기전용 안내 — STAFF 등 편집 불가 사용자에게 노출 */}
      {!canEdit && (
        <p
          role="status"
          className="text-sm text-ink-soft bg-line/30 border border-line rounded-md px-3 py-2"
        >
          {DASHBOARD_COPY.SETTINGS.readOnlyNotice}
        </p>
      )}

      {/* Name */}
      <div>
        <label htmlFor="space-name" className="block text-sm font-medium text-ink-soft mb-1">
          {DASHBOARD_COPY.SETTINGS.form.name}
        </label>
        <input
          id="space-name"
          type="text"
          value={values.name}
          onChange={(e) => handleChange("name", e.target.value)}
          required
          disabled={!canEdit}
          className="w-full px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:bg-line/20 disabled:cursor-not-allowed"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="space-desc" className="block text-sm font-medium text-ink-soft mb-1">
          {DASHBOARD_COPY.SETTINGS.form.description}
        </label>
        <textarea
          id="space-desc"
          value={values.description}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={3}
          disabled={!canEdit}
          className="w-full px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 resize-none disabled:bg-line/20 disabled:cursor-not-allowed"
        />
      </div>

      {/* Max Users */}
      <div>
        <label htmlFor="max-users" className="block text-sm font-medium text-ink-soft mb-1">
          {DASHBOARD_COPY.SETTINGS.form.maxUsers}
        </label>
        <input
          id="max-users"
          type="number"
          min={1}
          max={500}
          value={values.maxUsers}
          onChange={(e) => handleChange("maxUsers", Number(e.target.value))}
          disabled={!canEdit}
          className="w-32 px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:bg-line/20 disabled:cursor-not-allowed"
        />
      </div>

      {/* Access Type */}
      <div>
        <label htmlFor="access-type" className="block text-sm font-medium text-ink-soft mb-1">
          {DASHBOARD_COPY.SETTINGS.form.accessType}
        </label>
        <select
          id="access-type"
          value={values.accessType}
          onChange={(e) => handleChange("accessType", e.target.value)}
          disabled={!canEdit}
          className="w-48 px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:bg-line/20 disabled:cursor-not-allowed"
        >
          <option value="PUBLIC">{DASHBOARD_COPY.accessTypeLabel("PUBLIC")}</option>
          <option value="PRIVATE">{DASHBOARD_COPY.accessTypeLabel("PRIVATE")}</option>
          <option value="PASSWORD">{DASHBOARD_COPY.accessTypeLabel("PASSWORD")}</option>
        </select>
      </div>

      {/* Primary Color */}
      <div>
        <label htmlFor="primary-color" className="block text-sm font-medium text-ink-soft mb-1">
          {DASHBOARD_COPY.SETTINGS.form.primaryColor}
        </label>
        <input
          id="primary-color"
          type="color"
          value={values.primaryColor || "#3b82f6"}
          onChange={(e) => handleChange("primaryColor", e.target.value)}
          disabled={!canEdit}
          className="w-16 h-8 border border-line rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Loading Message */}
      <div>
        <label htmlFor="loading-msg" className="block text-sm font-medium text-ink-soft mb-1">
          {DASHBOARD_COPY.SETTINGS.form.loadingMessage}
        </label>
        <input
          id="loading-msg"
          type="text"
          value={values.loadingMessage}
          onChange={(e) => handleChange("loadingMessage", e.target.value)}
          placeholder={DASHBOARD_COPY.SETTINGS.form.loadingPlaceholder}
          disabled={!canEdit}
          className="w-full px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:bg-line/20 disabled:cursor-not-allowed"
        />
      </div>

      {/* Message */}
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      {/* Submit — 편집 불가(STAFF)면 저장 버튼 자체를 숨긴다 */}
      {canEdit && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? DASHBOARD_COPY.SETTINGS.form.saving : DASHBOARD_COPY.SETTINGS.form.save}
        </button>
      )}
    </form>
  );
}
