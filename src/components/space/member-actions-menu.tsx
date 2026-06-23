"use client";

/**
 * MemberActionsMenu — 인-스페이스 참가자 1인에 대한 관리 메뉴.
 *
 * OWNER/STAFF가 다른 멤버를 채팅 음소거/해제·내보내기·차단할 수 있다.
 * 권한 게이팅은 `canActOn`(호출자 role > 대상 role) 단일 SoT를 사용하고,
 * 실제 강제는 서버 PATCH(`/api/spaces/[id]/admin/members`)가 재검증한다(hard gate).
 * 클라 게이팅은 best-effort UX다.
 *
 * ⚠️ PATCH 대상은 **오직 `member.memberId`(=SpaceMember.id)**. userId를 쓰지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { canActOn } from "@/lib/space-role";
import { SPACE_COPY } from "@/constants/space-copy";
import type { SpaceRole } from "@prisma/client";
import type { ManagedMember } from "./use-space-members";

type RestrictAction = "mute" | "unmute" | "kick" | "ban";

interface MemberActionsMenuProps {
  spaceId: string;
  target: { userId: string; nickname: string };
  /** 해당 참가자의 SpaceMember 매핑(없으면 = 게스트/미매칭 → 관리 불가). */
  member: ManagedMember | null;
  /** 호출자 본인의 권위 role(스냅샷 기준). */
  actorRole: SpaceRole | null;
  currentUserId: string;
  /** 액션 성공 시 호출(멤버 스냅샷 재조회). */
  onActionDone: () => void;
  /** 드롭다운 전개 방향(버튼 위치에 맞춰). 기본 우측 정렬. */
  align?: "left" | "right";
  /**
   * 음성 강제 음소거(WI-038/039)용 **LiveKit identity**(`user-{userId}`/`guest-{...}`).
   * LiveKit room에 연결된 참가자에게만 주어진다(비-미디어 소켓 전용 플레이어는 undefined →
   * 음성 액션 미노출). userId에서 재구성하지 않는다 — 라우트 계약(LiveKit identity)을
   * UI에서 복제하지 않기 위함이고, guest-* 확장을 막지 않기 위함이다.
   *
   * ⚠️ 메뉴 가시성 게이트(member/actorRole/canActOn)와 **분리된** 액션별 게이트다 —
   * 음성 액션 추가가 기존 채팅/킥/밴 권한 모델을 흐리지 않는다.
   */
  participantIdentity?: string | null;
}

const COPY = SPACE_COPY.PARTICIPANT_PANEL;

export function MemberActionsMenu({
  spaceId,
  target,
  member,
  actorRole,
  currentUserId,
  onActionDone,
  align = "right",
  participantIdentity,
}: MemberActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<"kick" | "ban" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setPendingConfirm(null);
    setError(null);
  }, []);

  // 메뉴 밖 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeMenu]);

  const runAction = useCallback(
    async (action: RestrictAction) => {
      if (!member || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/spaces/${spaceId}/admin/members`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // 식별자 혼동 방지: SpaceMember.id만 사용(userId·identity 금지).
          body: JSON.stringify({ memberId: member.memberId, action }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error || COPY.actionFailed);
          setPendingConfirm(null);
          return;
        }
        closeMenu();
        onActionDone();
      } catch {
        setError(COPY.networkError);
        setPendingConfirm(null);
      } finally {
        setLoading(false);
      }
    },
    [member, loading, spaceId, onActionDone, closeMenu]
  );

  // 음성 강제 음소거(WI-038/039) — LiveKit identity로 moderate 라우트 호출.
  // 멤버 상태(restriction)를 바꾸지 않으므로 onActionDone(refetch) 호출하지 않는다.
  // 실제 오디오 상태는 LiveKit 이벤트로 자연 갱신된다.
  const runVoiceAction = useCallback(
    async (muted: boolean) => {
      if (!participantIdentity || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/spaces/${spaceId}/livekit/moderate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identity: participantIdentity, muted }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { code?: string };
          // 서버 영문 error 미노출 — code별 한글 매핑, 미지의 code는 폴백.
          setError((data.code && COPY.voiceError[data.code]) || COPY.actionFailed);
          return;
        }
        closeMenu();
      } catch {
        setError(COPY.networkError);
      } finally {
        setLoading(false);
      }
    },
    [participantIdentity, loading, spaceId, closeMenu]
  );

  // 게이팅: 멤버 매핑/권위 role 없으면, 본인이면, 계층상 불가하면 표시 안 함.
  if (!member || !actorRole) return null;
  if (member.userId === currentUserId) return null;
  if (!canActOn(actorRole, member.role)) return null;

  const isMuted = member.restriction === "MUTED";
  // 음성 액션은 LiveKit identity가 있을 때만(LiveKit room 참가자). 메뉴 가시성과 분리된 게이트.
  const showVoiceActions = !!participantIdentity;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={COPY.manageAriaLabel(target.nickname)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setPendingConfirm(null);
          setError(null);
        }}
        className="rounded bg-black/60 p-1 text-white/90 transition-colors hover:bg-black/80"
      >
        <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-50 mt-1 w-44 overflow-hidden rounded-md border border-cream/15 bg-ink/95 text-sm text-cream shadow-lg backdrop-blur-md`}
          onClick={(e) => e.stopPropagation()}
        >
          {pendingConfirm ? (
            <div className="p-2">
              <p className="mb-2 text-xs leading-snug text-ink-light">
                {pendingConfirm === "kick"
                  ? COPY.confirm.kick(target.nickname)
                  : COPY.confirm.ban(target.nickname)}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAction(pendingConfirm)}
                  className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  {COPY.confirm.confirmLabel}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPendingConfirm(null)}
                  className="flex-1 rounded bg-cream/10 px-2 py-1 text-xs text-cream transition-colors hover:bg-cream/20 disabled:opacity-50"
                >
                  {COPY.confirm.cancelLabel}
                </button>
              </div>
            </div>
          ) : (
            <ul className="py-1">
              <li>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAction(isMuted ? "unmute" : "mute")}
                  className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-cream/10 disabled:opacity-50"
                >
                  {isMuted ? COPY.actions.unmute : COPY.actions.mute}
                </button>
              </li>
              {/* 음성 제어 — LiveKit 강제 음소거(채팅 음소거와 별개 레이어). identity 있을 때만. */}
              {showVoiceActions && (
                <>
                  <li
                    aria-hidden="true"
                    className="mt-1 border-t border-cream/10 px-3 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted"
                  >
                    {COPY.voiceSectionLabel}
                  </li>
                  <li>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => runVoiceAction(true)}
                      className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-cream/10 disabled:opacity-50"
                    >
                      {COPY.voiceActions.mute}
                    </button>
                  </li>
                  <li className="border-b border-cream/10 pb-1">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => runVoiceAction(false)}
                      className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-cream/10 disabled:opacity-50"
                    >
                      {COPY.voiceActions.allow}
                    </button>
                  </li>
                </>
              )}
              <li>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPendingConfirm("kick")}
                  className="block w-full px-3 py-1.5 text-left transition-colors hover:bg-cream/10 disabled:opacity-50"
                >
                  {COPY.actions.kick}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPendingConfirm("ban")}
                  className="block w-full px-3 py-1.5 text-left text-red-400 transition-colors hover:bg-cream/10 disabled:opacity-50"
                >
                  {COPY.actions.ban}
                </button>
              </li>
            </ul>
          )}
          {error && (
            <p className="border-t border-cream/10 px-3 py-1.5 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
