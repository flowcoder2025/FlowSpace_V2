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
}

const TEMPLATE_ICONS: Record<string, string> = {
  OFFICE: "🏢",
  CLASSROOM: "🏫",
  LOUNGE: "🛋️",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  STAFF: "Staff",
  PARTICIPANT: "Member",
};

export function SpaceCard({ space }: SpaceCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/space/${space.id}`)}
      className="group cursor-pointer rounded-xl border border-line bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {TEMPLATE_ICONS[space.template.key] || "🌐"}
          </span>
          <div>
            <h3 className="font-semibold text-ink group-hover:text-ink">
              {space.name}
            </h3>
            <span className="text-xs text-ink-light">{space.template.name}</span>
          </div>
        </div>

        {space.myRole && (
          <span className="rounded-full bg-cream-deep px-2 py-0.5 text-xs font-medium text-ink">
            {ROLE_LABELS[space.myRole] || space.myRole}
          </span>
        )}
      </div>

      {/* Description */}
      {space.description && (
        <p className="mb-3 line-clamp-2 text-sm text-ink-muted">
          {space.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-ink-light">
        <span>
          {space.memberCount}/{space.maxUsers} members
        </span>
        <div className="flex items-center gap-2">
          {(space.myRole === "OWNER" || space.myRole === "STAFF") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/spaces/${space.id}`);
              }}
              className="rounded-full bg-cream-deep px-2 py-0.5 text-ink-muted hover:bg-line transition-colors"
            >
              Dashboard
            </button>
          )}
          <span
            className={`rounded-full px-2 py-0.5 ${
              space.accessType === "PUBLIC"
                ? "bg-green-50 text-green-600"
                : space.accessType === "PASSWORD"
                  ? "bg-yellow-50 text-yellow-600"
                  : "bg-red-50 text-red-600"
            }`}
          >
            {space.accessType.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
