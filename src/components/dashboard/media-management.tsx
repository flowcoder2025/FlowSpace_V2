"use client";

import { useEffect, useState, useCallback } from "react";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

interface SpotlightGrant {
  id: string;
  userId: string | null;
  guestSessionId: string | null;
  grantedBy: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface SpaceMember {
  id: string;
  userId: string | null;
  displayName: string | null;
  role: string;
  user?: { id: string; name: string | null; email: string } | null;
}

interface MediaManagementProps {
  spaceId: string;
}

export function MediaManagement({ spaceId }: MediaManagementProps) {
  const [grants, setGrants] = useState<SpotlightGrant[]>([]);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [expiresMinutes, setExpiresMinutes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [grantsRes, membersRes] = await Promise.all([
        fetch(`/api/spaces/${spaceId}/admin/media`),
        fetch(`/api/spaces/${spaceId}/admin/members`),
      ]);

      if (!grantsRes.ok) throw new Error(DASHBOARD_COPY.MEDIA.loadDataError);
      if (!membersRes.ok) throw new Error(DASHBOARD_COPY.MEDIA.loadMembersError);

      const grantsData = await grantsRes.json();
      const membersData = await membersRes.json();

      setGrants(grantsData.grants);
      setMembers(membersData.members ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : DASHBOARD_COPY.COMMON.unknownError);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGrantSpotlight = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/admin/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedUserId,
          expiresInMinutes: expiresMinutes ? parseInt(expiresMinutes, 10) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || DASHBOARD_COPY.MEDIA.grantError);
      }

      setSelectedUserId("");
      setExpiresMinutes("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : DASHBOARD_COPY.COMMON.unknownError);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/admin/media/${grantId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(DASHBOARD_COPY.MEDIA.revokeError);

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : DASHBOARD_COPY.COMMON.unknownError);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-ink-muted">{DASHBOARD_COPY.COMMON.loading}</div>;

  // grant가 없는 멤버만 선택 가능
  const grantedUserIds = new Set(grants.map((g) => g.userId));
  const availableMembers = members.filter(
    (m) => m.userId && !grantedUserIds.has(m.userId)
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Grant Spotlight Form */}
      <div className="bg-white rounded-lg border border-line p-5">
        <h3 className="text-sm font-semibold text-ink-soft mb-3">
          {DASHBOARD_COPY.MEDIA.grantTitle}
        </h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-ink-muted mb-1">{DASHBOARD_COPY.MEDIA.memberLabel}</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            >
              <option value="">{DASHBOARD_COPY.MEDIA.selectMember}</option>
              {availableMembers.map((m) => (
                <option key={m.userId} value={m.userId!}>
                  {m.displayName || m.user?.name || m.user?.email || m.userId}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs text-ink-muted mb-1">
              {DASHBOARD_COPY.MEDIA.expiresLabel}
            </label>
            <input
              type="number"
              min="1"
              placeholder={DASHBOARD_COPY.MEDIA.unlimited}
              value={expiresMinutes}
              onChange={(e) => setExpiresMinutes(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleGrantSpotlight}
            disabled={!selectedUserId || actionLoading}
            className="px-4 py-2 bg-brand text-white text-sm rounded hover:bg-brand-deep disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {DASHBOARD_COPY.MEDIA.grant}
          </button>
        </div>
      </div>

      {/* Spotlight Grants List */}
      <div className="bg-white rounded-lg border border-line p-5">
        <h3 className="text-sm font-semibold text-ink-soft mb-3">
          {DASHBOARD_COPY.MEDIA.grantsTitle(grants.length)}
        </h3>

        {grants.length === 0 ? (
          <p className="text-sm text-ink-light">{DASHBOARD_COPY.MEDIA.noGrants}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="pb-2 font-medium">{DASHBOARD_COPY.MEDIA.table.user}</th>
                  <th className="pb-2 font-medium">{DASHBOARD_COPY.MEDIA.table.status}</th>
                  <th className="pb-2 font-medium">{DASHBOARD_COPY.MEDIA.table.expires}</th>
                  <th className="pb-2 font-medium">{DASHBOARD_COPY.MEDIA.table.granted}</th>
                  <th className="pb-2 font-medium">{DASHBOARD_COPY.MEDIA.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => {
                  const isExpired = grant.expiresAt && new Date(grant.expiresAt) < new Date();
                  return (
                    <tr key={grant.id} className="border-b border-line">
                      <td className="py-2">
                        {grant.user?.name || grant.user?.email || grant.userId || DASHBOARD_COPY.MEMBERS.guest}
                      </td>
                      <td className="py-2">
                        {isExpired ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-cream-deep text-ink-muted">
                            {DASHBOARD_COPY.MEDIA.statusExpired}
                          </span>
                        ) : grant.isActive ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                            {DASHBOARD_COPY.MEDIA.statusActive}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                            {DASHBOARD_COPY.MEDIA.statusGranted}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-ink-muted">
                        {grant.expiresAt
                          ? new Date(grant.expiresAt).toLocaleString("ko-KR")
                          : DASHBOARD_COPY.MEDIA.unlimited}
                      </td>
                      <td className="py-2 text-ink-muted">
                        {new Date(grant.createdAt).toLocaleString("ko-KR")}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleRevokeGrant(grant.id)}
                          disabled={actionLoading}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {DASHBOARD_COPY.MEDIA.revoke}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
