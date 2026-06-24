/**
 * 클라이언트 kick 가드(WI-047) — space 단위 자동 재입장 차단.
 *
 * 강퇴(`space:error` code="KICKED") 수신 시 해당 space를 짧게 기록해, effect 리마운트/
 * 소켓 재연결로 join:space가 자동 재발송되는 루프를 끊는다. **최종 강제력은 서버 join:space
 * 쿨다운**이며 이 가드는 UX 보조다(다중 탭은 모듈 메모리를 공유하지 않으므로 — codex).
 *
 * 모듈 레벨 싱글턴이라 use-socket effect가 리마운트돼도 가드 상태가 유지된다.
 */
import { createKickCooldown, KICK_COOLDOWN_MS } from "@/lib/kick-cooldown";

const guard = createKickCooldown(KICK_COOLDOWN_MS);

/** space를 kick 가드에 등록(KICKED 수신 시). */
export function markSpaceKicked(spaceId: string): void {
  guard.mark(spaceId, Date.now());
}

/** space가 kick 가드 쿨다운 중인지(join 재발송 차단 판정). */
export function isSpaceKicked(spaceId: string): boolean {
  return guard.isActive(spaceId, Date.now());
}

/** space의 kick 가드를 즉시 해제(테스트/재입장 허용). */
export function clearSpaceKicked(spaceId: string): void {
  guard.clear(spaceId);
}
