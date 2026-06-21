"use client";

import { useRouter } from "next/navigation";

interface SpaceCardProps {
  space: {
    id: string;
    name: string;
    description: string | null;
    accessType: string;
    template: { key: string; name: string };
    memberCount: number;
    maxUsers: number;
    myRole: string | null;
    primaryColor: string | null;
  };
  /** 슈퍼어드민이면 멤버 역할과 무관하게 '관리' 진입을 노출 (서버 세션 권위) */
  isSuperAdmin?: boolean;
}

const TEMPLATE_LABELS: Record<string, string> = {
  OFFICE: "사무실",
  CLASSROOM: "강의실",
  LOUNGE: "라운지",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "오너",
  STAFF: "스태프",
  PARTICIPANT: "참여자",
};

const ACCESS_LABELS: Record<string, string> = {
  PUBLIC: "공개",
  PASSWORD: "비밀번호",
  PRIVATE: "비공개",
};

export function SpaceCard({ space, isSuperAdmin = false }: SpaceCardProps) {
  const router = useRouter();
  const isAdmin =
    space.myRole === "OWNER" || space.myRole === "STAFF" || isSuperAdmin;
  const templateLabel =
    TEMPLATE_LABELS[space.template.key] ?? space.template.name;

  return (
    <article
      onClick={() => router.push(`/space/${space.id}`)}
      className="group flex cursor-pointer flex-col rounded-xl border border-line bg-cream p-6 transition-all hover:border-ink/30 hover:shadow-[0_4px_20px_rgba(10,10,10,0.04)]"
    >
      {/* Header — Template label + Role badge */}
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-muted">
          {templateLabel}
        </p>
        {space.myRole && (
          <span className="inline-flex items-center rounded-full border border-line bg-cream-deep/60 px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
            {ROLE_LABELS[space.myRole] ?? space.myRole}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="mt-3 font-serif text-2xl font-medium tracking-tight text-ink line-clamp-2">
        {space.name}
      </h3>

      {/* Description */}
      {space.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
          {space.description}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-light">설명 없음</p>
      )}

      {/* Footer — meta + actions */}
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span>
            멤버 <span className="font-medium text-ink-soft">{space.memberCount}</span>
            <span className="text-ink-light">/{space.maxUsers}</span>
          </span>
          <span className="text-line">·</span>
          <AccessBadge type={space.accessType} />
        </div>

        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/spaces/${space.id}`);
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-cream-deep hover:text-ink"
          >
            관리
          </button>
        )}
      </div>
    </article>
  );
}

function AccessBadge({ type }: { type: string }) {
  const label = ACCESS_LABELS[type] ?? type.toLowerCase();
  return <span>{label}</span>;
}
