"use client";

import { useEffect, useState, useCallback } from "react";

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

      if (!grantsRes.ok) throw new Error("Failed to load media data");
      if (!membersRes.ok) throw new Error("Failed to load members");

      const grantsData = await grantsRes.json();
      const membersData = await membersRes.json();

      setGrants(grantsData.grants);
      setMembers(membersData.members ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
        throw new Error(data.error || "Failed to grant spotlight");
      }

      setSelectedUserId("");
      setExpiresMinutes("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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

      if (!res.ok) throw new Error("Failed to revoke grant");

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;

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
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Grant Spotlight Permission
        </h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Member</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select member...</option>
              {availableMembers.map((m) => (
                <option key={m.userId} value={m.userId!}>
                  {m.displayName || m.user?.name || m.user?.email || m.userId}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">
              Expires (min)
            </label>
            <input
              type="number"
              min="1"
              placeholder="Unlimited"
              value={expiresMinutes}
              onChange={(e) => setExpiresMinutes(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleGrantSpotlight}
            disabled={!selectedUserId || actionLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Grant
          </button>
        </div>
      </div>

      {/* Spotlight Grants List */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Spotlight Grants ({grants.length})
        </h3>

        {grants.length === 0 ? (
          <p className="text-sm text-gray-400">No spotlight grants</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Expires</th>
                  <th className="pb-2 font-medium">Granted</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => {
                  const isExpired = grant.expiresAt && new Date(grant.expiresAt) < new Date();
                  return (
                    <tr key={grant.id} className="border-b border-gray-100">
                      <td className="py-2">
                        {grant.user?.name || grant.user?.email || grant.userId || "Guest"}
                      </td>
                      <td className="py-2">
                        {isExpired ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                            Expired
                          </span>
                        ) : grant.isActive ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">
                            Granted
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-gray-500">
                        {grant.expiresAt
                          ? new Date(grant.expiresAt).toLocaleString("ko-KR")
                          : "Unlimited"}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(grant.createdAt).toLocaleString("ko-KR")}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleRevokeGrant(grant.id)}
                          disabled={actionLoading}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Revoke
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
