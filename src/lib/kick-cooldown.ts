/**
 * kick 쿨다운 — 멤버 강퇴(kick) 후 일정 시간 자동 재입장을 차단하는 만료 기반 키-스토어 (WI-047).
 *
 * kick은 BANNED(영구 restriction)와 분리된 "임시 퇴장" 시맨틱이라 DB 상태를 바꾸지
 * 않는다. 따라서 강퇴 직후 클라이언트가 소켓을 재생성/재연결하면 join:space 게이트를
 * 그대로 통과해 즉시 복귀한다(근본원인). 이 모듈은 그 창을 닫는 단기 in-memory 쿨다운을
 * 제공한다 — 서버(OCI 소켓)의 join:space 게이트가 최종 강제력이고, 클라이언트 가드는
 * 자동 재생성/재연결 루프를 끊는 UX 보조다(다중 탭은 모듈 메모리를 공유하지 않으므로).
 *
 * 순수 모듈(React/Node-fs 의존 없음) — 서버 번들이 단독 COPY할 수 있고, 시각(now)을
 * 주입받아 Date.now() 의존 없이 결정적으로 테스트된다.
 */

/** kick 후 자동 재입장 차단 시간(ms). 임시 퇴장이라 짧게 둔다. */
export const KICK_COOLDOWN_MS = 30_000;

export interface KickCooldown {
  /** key를 now 기준 ttl만큼 쿨다운에 등록(기존 값 덮어씀 — 재-kick 시 연장). */
  mark(key: string, now: number): void;
  /** key가 now 기준 아직 쿨다운 중인지. 만료된 항목은 lazy 삭제(메모리 누수 방지). */
  isActive(key: string, now: number): boolean;
  /** key의 쿨다운을 즉시 해제. */
  clear(key: string): void;
  /** 현재 보관 중인(미정리 포함) 항목 수 — 테스트/관측용. */
  size(): number;
}

/**
 * 만료 기반 쿨다운 스토어를 생성한다. ttlMs는 mark 시 적용되는 유효시간.
 * 호출자가 now(ms)를 주입하므로 Date.now() 의존이 없어 결정적이다.
 */
export function createKickCooldown(ttlMs: number): KickCooldown {
  const expiry = new Map<string, number>();
  return {
    mark(key, now) {
      expiry.set(key, now + ttlMs);
    },
    isActive(key, now) {
      const until = expiry.get(key);
      if (until === undefined) return false;
      if (now >= until) {
        expiry.delete(key); // lazy 정리 — 만료 조회 시 제거
        return false;
      }
      return true;
    },
    clear(key) {
      expiry.delete(key);
    },
    size() {
      return expiry.size;
    },
  };
}
