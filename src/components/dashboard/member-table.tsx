"use client";

import { useState } from "react";

interface Member {
  id: string;
  role: "OWNER" | "STAFF" | "PARTICIPANT";
  restriction: "NONE" | "MUTED" | "BANNED";
  displayName: string | null;
  user?: { id: string; name: string | null; email: string; image: string | null } | null;
  guestSession?: { id: string; nickname: string } | null;
  createdAt: string;
}

interface MemberTableProps {
  spaceId: string;
  members: Member[];
  onRefresh: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  STAFF: "bg-blue-100 text-blue-700",
  PARTICIPANT: "bg-gray-100 text-gray-600",
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
        alert(data.error || "Action failed");
      }
      onRefresh();
    } catch {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Role</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Joined</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const name = m.user?.name || m.guestSession?.nickname || m.displayName || "Unknown";
            const isOwner = m.role === "OWNER";
            const isLoading = actionLoading === m.id;

            return (
              <tr key={m.id} className="border-b border-gray-100">
                <td className="py-3">
                  <div className="font-medium text-gray-900">{name}</div>
                  {m.user?.email && (
                    <div className="text-xs text-gray-400">{m.user.email}</div>
                  )}
                  {m.guestSession && (
                    <div className="text-xs text-gray-400">Guest</div>
                  )}
                </td>
                <td className="py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                    {m.role}
                  </span>
                </td>
                <td className="py-3">
                  {m.restriction !== "NONE" && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESTRICTION_COLORS[m.restriction]}`}>
                      {m.restriction}
                    </span>
                  )}
                </td>
                <td className="py-3 text-gray-500">
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
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white disabled:opacity-50"
                      >
                        <option value="">Actions...</option>
                        {m.restriction === "MUTED" ? (
                          <option value="unmute">Unmute</option>
                        ) : (
                          <option value="mute">Mute</option>
                        )}
                        <option value="kick">Kick</option>
                        <option value="ban">Ban</option>
                        <option value="role:STAFF">Set Staff</option>
                        <option value="role:PARTICIPANT">Set Participant</option>
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
