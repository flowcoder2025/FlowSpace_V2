"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  MemberTable,
  type Member,
  type MemberRoleFilter,
} from "@/components/dashboard/member-table";
import { filterMembers } from "@/components/dashboard/member-filter";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { membersToCsv, downloadCsv, csvFilename } from "@/components/dashboard/csv-export";
import { DASHBOARD_COPY } from "@/constants/dashboard-copy";

const ROLE_FILTERS: { value: MemberRoleFilter; label: string }[] = [
  { value: "ALL", label: DASHBOARD_COPY.MEMBERS.roleFilters.ALL },
  { value: "OWNER", label: DASHBOARD_COPY.MEMBERS.roleFilters.OWNER },
  { value: "STAFF", label: DASHBOARD_COPY.MEMBERS.roleFilters.STAFF },
  { value: "PARTICIPANT", label: DASHBOARD_COPY.MEMBERS.roleFilters.PARTICIPANT },
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
      if (!res.ok) throw new Error(DASHBOARD_COPY.MEMBERS.loadError);
      const data = await res.json();
      setMembers(data.members);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : DASHBOARD_COPY.MEMBERS.loadError
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
        <h1 className="text-2xl font-bold text-ink">{DASHBOARD_COPY.MEMBERS.title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">
            {DASHBOARD_COPY.MEMBERS.count(visibleMembers.length, members.length)}
          </span>
          <ExportCsvButton
            disabled={visibleMembers.length === 0}
            onExport={() =>
              downloadCsv(
                csvFilename("members", spaceId, new Date()),
                membersToCsv(visibleMembers)
              )
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={DASHBOARD_COPY.MEMBERS.searchPlaceholder}
          aria-label={DASHBOARD_COPY.MEMBERS.searchAriaLabel}
          className="flex-1 text-sm border border-line rounded px-3 py-1.5"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as MemberRoleFilter)}
          aria-label={DASHBOARD_COPY.MEMBERS.roleFilterAriaLabel}
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
          <div className="text-ink-muted text-sm py-4">{DASHBOARD_COPY.COMMON.loading}</div>
        ) : members.length === 0 ? (
          // 로드 실패 시엔 빈 상태 대신 위의 error 메시지만 노출(실패 ≠ 빈 목록)
          error ? null : (
            <div className="text-ink-muted text-sm py-4">{DASHBOARD_COPY.MEMBERS.empty}</div>
          )
        ) : visibleMembers.length === 0 ? (
          <div className="text-ink-muted text-sm py-4">{DASHBOARD_COPY.MEMBERS.emptySearch}</div>
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
