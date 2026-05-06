"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEMPLATES = [
  { key: "OFFICE", label: "사무실", desc: "팀 협업 공간" },
  { key: "CLASSROOM", label: "강의실", desc: "학습과 교육" },
  { key: "LOUNGE", label: "라운지", desc: "편안한 모임" },
];

const ACCESS_TYPES = [
  { value: "PUBLIC", label: "공개", desc: "누구나 입장 가능" },
  { value: "PASSWORD", label: "비밀번호", desc: "비밀번호로 입장" },
  { value: "PRIVATE", label: "비공개", desc: "초대 받은 사람만" },
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
        setError(data.error || "스페이스 생성 실패");
        return;
      }

      router.push("/my-spaces");
      router.refresh();
    } catch {
      setError("예상치 못한 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-cream p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)]">
      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Name */}
        <div>
          <label
            htmlFor="space-name"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted"
          >
            스페이스 이름
          </label>
          <input
            id="space-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="우리 팀 사무실"
            className="w-full rounded-md border border-line bg-cream px-3 py-2.5 text-sm placeholder:text-ink-light focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="space-desc"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted"
          >
            설명 <span className="text-ink-light">(선택)</span>
          </label>
          <textarea
            id="space-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="이 공간을 어떻게 사용하시나요?"
            className="w-full resize-none rounded-md border border-line bg-cream px-3 py-2.5 text-sm placeholder:text-ink-light focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
        </div>

        {/* Template */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-muted">
            템플릿
          </p>
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplateKey(t.key)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  templateKey === t.key
                    ? "border-ink bg-cream-deep/60"
                    : "border-line hover:border-ink/30 hover:bg-cream-deep/30"
                }`}
              >
                <p className="font-serif text-base font-medium text-ink">
                  {t.label}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Access Type */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-muted">
            접근 권한
          </p>
          <div className="space-y-2">
            {ACCESS_TYPES.map((a) => (
              <label
                key={a.value}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3.5 transition-colors ${
                  accessType === a.value
                    ? "border-ink bg-cream-deep/60"
                    : "border-line hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  name="accessType"
                  value={a.value}
                  checked={accessType === a.value}
                  onChange={(e) => setAccessType(e.target.value)}
                  className="size-4 accent-ink"
                />
                <div>
                  <p className="text-sm font-medium text-ink">{a.label}</p>
                  <p className="text-xs text-ink-muted">{a.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Password */}
        {accessType === "PASSWORD" && (
          <div>
            <label
              htmlFor="space-pw"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted"
            >
              비밀번호
            </label>
            <input
              id="space-pw"
              type="text"
              required
              value={accessSecret}
              onChange={(e) => setAccessSecret(e.target.value)}
              placeholder="이 공간의 입장 비밀번호"
              className="w-full rounded-md border border-line bg-cream px-3 py-2.5 text-sm placeholder:text-ink-light focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-md border border-line py-3 text-sm font-medium text-ink-soft transition-colors hover:border-ink/30 hover:bg-cream-deep/50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 rounded-md bg-brand py-3 text-sm font-medium text-cream transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "생성 중..." : "스페이스 만들기"}
          </button>
        </div>
      </form>
    </div>
  );
}
