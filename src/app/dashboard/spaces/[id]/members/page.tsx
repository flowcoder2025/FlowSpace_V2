"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  MemberTable,
  type Member,
  type MemberRoleFilter,
} from "@/components/dashboard/member-table";
import { filterMembers } from "@/components/dashboard/member-filter";

const ROLE_FILTERS: { value: MemberRoleFilter; label: string }[] = [
  { value: "ALL", label: "All Roles" },
  { value: "OWNER", label: "Owner" },
  { value: "STAFF", label: "Staff" },
  { value: "PARTICIPANT", label: "Participant" },
];

export default function MembersPage() {
  const params = useParams<{ id: string }>();
  const spaceId = params.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>("ALL");

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/admin/members`);
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      setMembers(data.members);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "멤버를 불러오지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const visibleMembers = useMemo(
    () => filterMembers(members, query, roleFilter),
    [members, query, roleFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Members</h1>
        <span className="text-sm text-ink-muted">
          {visibleMembers.length}
          {visibleMembers.length !== members.length ? ` / ${members.length}` : ""} members
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 또는 이메일 검색..."
          aria-label="멤버 검색"
          className="flex-1 text-sm border border-line rounded px-3 py-1.5"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as MemberRoleFilter)}
          aria-label="역할 필터"
          className="text-sm border border-line rounded px-3 py-1.5"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-line p-5">
        {isLoading ? (
          <div className="text-ink-muted text-sm py-4">Loading...</div>
        ) : members.length === 0 ? (
          // 로드 실패 시엔 빈 상태 대신 위의 error 메시지만 노출(실패 ≠ 빈 목록)
          error ? null : (
            <div className="text-ink-muted text-sm py-4">멤버가 없습니다.</div>
          )
        ) : visibleMembers.length === 0 ? (
          <div className="text-ink-muted text-sm py-4">검색 결과가 없습니다.</div>
        ) : (
          <MemberTable
            spaceId={spaceId}
            members={visibleMembers}
            onRefresh={loadMembers}
          />
        )}
      </div>
    </div>
  );
}
