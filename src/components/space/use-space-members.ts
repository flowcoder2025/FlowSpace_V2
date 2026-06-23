"use client";

/**
 * useSpaceMembers — 인-스페이스 멤버 관리용 멤버 스냅샷 훅.
 *
 * 어드민 멤버 API(`GET /api/spaces/[id]/admin/members`, OWNER/STAFF/superAdmin만 200)를
 * 호출해 인-스페이스 참가자(userId)를 `SpaceMember`로 매핑한다. 이 GET 자체가
 * 자연 권한 게이트다 — 403이면 관리 UI 전체를 숨긴다(stale prop 우회).
 *
 * ⚠️ 식별자 혼동 방지(설계 협의 #1 위험):
 * - PATCH 대상 식별자는 **오직 `SpaceMember.id`(=memberId)** 다. userId·LiveKit
 *   identity·socket 이벤트의 memberId(실제 userId 보유)를 PATCH에 쓰지 않는다.
 * - 매핑 키는 `SpaceMember.userId`(등록 사용자만). 게스트(userId=null)는 1차 범위 제외.
 * - LiveKit identity → userId 해석은 `user-` 접두사만 허용한다. `guest-*`/`dev-anon-*`
 *   /접두사 없는 값은 관리 대상이 아니다(`null`).
 */
import { useCallback, useEffect, useState } from "react";
import type { SpaceRole } from "@prisma/client";
import type { ChatRestrictionValue } from "@/lib/space-role";

/** 인-스페이스에서 관리 가능한 멤버 한 건. */
export interface ManagedMember {
  /** SpaceMember.id — PATCH `memberId`로 쓰는 **유일한** 식별자. */
  memberId: string;
  /** SpaceMember.userId — 인-스페이스 참가자(userId)와 매핑하는 키. */
  userId: string;
  role: SpaceRole;
  restriction: ChatRestrictionValue;
}

export interface UseSpaceMembersResult {
  /** userId → ManagedMember (등록 사용자만). */
  membersByUserId: Map<string, ManagedMember>;
  /** 호출자 본인의 권위 role(스냅샷 기준) — stale prop 대신 사용. 미인가/미발견 시 null. */
  actorRole: SpaceRole | null;
  /** GET 200(OWNER/STAFF/superAdmin) 여부. false면 관리 UI 숨김. */
  isAuthorized: boolean;
  isLoading: boolean;
  /** 액션 후 스냅샷 재조회. */
  refetch: () => void;
}

interface AdminMemberRow {
  id: string;
  role: SpaceRole;
  restriction: ChatRestrictionValue;
  userId: string | null;
}

/**
 * LiveKit identity에서 관리 대상 userId를 해석한다.
 * `user-{userId}`만 userId로 본다. `guest-*`/`dev-anon-*`/기타는 관리 대상 아님(null).
 */
export function managedUserIdFromIdentity(identity: string): string | null {
  const PREFIX = "user-";
  if (!identity.startsWith(PREFIX)) return null;
  const userId = identity.slice(PREFIX.length);
  return userId.length > 0 ? userId : null;
}

export function useSpaceMembers(
  spaceId: string,
  currentUserId: string,
  enabled: boolean
): UseSpaceMembersResult {
  const [membersByUserId, setMembersByUserId] = useState<Map<string, ManagedMember>>(
    () => new Map()
  );
  const [actorRole, setActorRole] = useState<SpaceRole | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reqTick, setReqTick] = useState(0);

  const refetch = useCallback(() => setReqTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !spaceId || !currentUserId) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/spaces/${spaceId}/admin/members`);
        if (cancelled) return;

        if (!res.ok) {
          // 403(비인가)·기타 → 관리 UI 숨김.
          setIsAuthorized(false);
          setActorRole(null);
          setMembersByUserId(new Map());
          return;
        }

        const data = (await res.json().catch(() => null)) as
          | { members?: AdminMemberRow[] }
          | null;
        if (cancelled) return;

        const rows = data?.members ?? [];
        const map = new Map<string, ManagedMember>();
        let selfRole: SpaceRole | null = null;
        for (const m of rows) {
          if (!m.userId) continue; // 게스트 제외(1차 범위)
          map.set(m.userId, {
            memberId: m.id,
            userId: m.userId,
            role: m.role,
            restriction: m.restriction,
          });
          if (m.userId === currentUserId) selfRole = m.role;
        }

        setMembersByUserId(map);
        setActorRole(selfRole);
        setIsAuthorized(true);
      } catch {
        if (cancelled) return;
        // 네트워크 오류 → 권한 확인 불가 → 관리 UI 숨김(보수적).
        setIsAuthorized(false);
        setActorRole(null);
        setMembersByUserId(new Map());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spaceId, currentUserId, enabled, reqTick]);

  return { membersByUserId, actorRole, isAuthorized, isLoading, refetch };
}
