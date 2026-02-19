"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MemberTable } from "@/components/dashboard/member-table";

export default function MembersPage() {
  const params = useParams<{ id: string }>();
  const spaceId = params.id;
  const [members, setMembers] = useState<[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(() => {
    fetch(`/api/spaces/${spaceId}/admin/members`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load members");
        return res.json();
      })
      .then((data) => setMembers(data.members))
      .catch((err) => setError(err.message));
  }, [spaceId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <span className="text-sm text-gray-500">{members.length} members</span>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <MemberTable spaceId={spaceId} members={members} onRefresh={loadMembers} />
      </div>
    </div>
  );
}
