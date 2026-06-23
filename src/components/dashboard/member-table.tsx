"use client";

import { useState } from "react";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

export interface Member {
  id: string;
  role: "OWNER" | "STAFF" | "PARTICIPANT";
  restriction: "NONE" | "MUTED" | "BANNED";
  displayName: string | null;
  user?: { id: string; name: string | null; email: string; image: string | null } | null;
  guestSession?: { id: string; nickname: string } | null;
  createdAt: string;
}

/** 멤버 검색 가능한 역할 필터 값 ("ALL" = 전체) */
export type MemberRoleFilter = "ALL" | "OWNER" | "STAFF" | "PARTICIPANT";

interface MemberTableProps {
  spaceId: string;
  members: Member[];
  onRefresh: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  STAFF: "bg-blue-100 text-ink",
  PARTICIPANT: "bg-cream-deep text-ink-muted",
};

const RESTRICTION_COLORS: Record<string, string> = {
  NONE: "",
  MUTED: "bg-yellow-100 text-yellow-700",
  BANNED: "bg-red-100 text-red-700",
};

export function MemberTable({ spaceId, members, onRefresh }: MemberTableProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleAction(memberId: string, action: string, role?: string) {
    setActionLoading(memberId);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/admin/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, action, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || DASHBOARD_COPY.MEMBERS.actionFailed);
      }
      onRefresh();
    } catch {
      alert(DASHBOARD_COPY.COMMON.networkError);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            <th className="pb-3 font-medium">{DASHBOARD_COPY.MEMBERS.table.name}</th>
            <th className="pb-3 font-medium">{DASHBOARD_COPY.MEMBERS.table.role}</th>
            <th className="pb-3 font-medium">{DASHBOARD_COPY.MEMBERS.table.status}</th>
            <th className="pb-3 font-medium">{DASHBOARD_COPY.MEMBERS.table.joined}</th>
            <th className="pb-3 font-medium text-right">{DASHBOARD_COPY.MEMBERS.table.actions}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const name = m.user?.name || m.guestSession?.nickname || m.displayName || DASHBOARD_COPY.COMMON.unknown;
            const isOwner = m.role === "OWNER";
            const isLoading = actionLoading === m.id;

            return (
              <tr key={m.id} className="border-b border-line">
                <td className="py-3">
                  <div className="font-medium text-ink">{name}</div>
                  {m.user?.email && (
                    <div className="text-xs text-ink-light">{m.user.email}</div>
                  )}
                  {m.guestSession && (
                    <div className="text-xs text-ink-light">{DASHBOARD_COPY.MEMBERS.guest}</div>
                  )}
                </td>
                <td className="py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                    {DASHBOARD_COPY.roleLabel(m.role)}
                  </span>
                </td>
                <td className="py-3">
                  {m.restriction !== "NONE" && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESTRICTION_COLORS[m.restriction]}`}>
                      {DASHBOARD_COPY.restrictionLabel(m.restriction)}
                    </span>
                  )}
                </td>
                <td className="py-3 text-ink-muted">
                  {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                </td>
                <td className="py-3 text-right">
                  {!isOwner && (
                    <div className="relative inline-block">
                      <select
                        disabled={isLoading}
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          e.target.value = "";
                          if (!val) return;
                          if (val === "mute" || val === "unmute" || val === "kick" || val === "ban") {
                            handleAction(m.id, val);
                          } else if (val.startsWith("role:")) {
                            handleAction(m.id, "changeRole", val.replace("role:", ""));
                          }
                        }}
                        className="text-xs border border-line rounded px-2 py-1 bg-white disabled:opacity-50"
                      >
                        <option value="">{DASHBOARD_COPY.MEMBERS.actions.placeholder}</option>
                        {m.restriction === "MUTED" ? (
                          <option value="unmute">{DASHBOARD_COPY.MEMBERS.actions.unmute}</option>
                        ) : (
                          <option value="mute">{DASHBOARD_COPY.MEMBERS.actions.mute}</option>
                        )}
                        <option value="kick">{DASHBOARD_COPY.MEMBERS.actions.kick}</option>
                        <option value="ban">{DASHBOARD_COPY.MEMBERS.actions.ban}</option>
                        <option value="role:STAFF">{DASHBOARD_COPY.MEMBERS.actions.setStaff}</option>
                        <option value="role:PARTICIPANT">{DASHBOARD_COPY.MEMBERS.actions.setParticipant}</option>
                      </select>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
