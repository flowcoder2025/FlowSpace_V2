// Enforcement Contract — Next HTTP(API) ↔ socket.io 서버 크로스프로세스 제재 채널 (WI-005)
//
// dashboard 관리 액션(ban/kick/mute/unmute/changeRole)을 살아있는 소켓 연결에 즉시
// 반영하기 위한 순수 계약. Next API route(서명 생성)와 socket 서버(서명 검증) 양쪽이
// 공유하며, React/Node-fs 의존이 없는 순수 모듈이라 server 번들이 단독 COPY할 수 있다.
//
// 인증: 정적 헤더 시크릿이 아닌 HMAC-SHA256(`{timestamp}.{rawBody}`) 서명 + replay
// window. 엔드포인트가 socket 서버와 같은 public 포트에 노출되고 "강제 추방 권한"을
// 갖기 때문이다(설계 codex consult).

import { createHmac, timingSafeEqual } from "crypto";

/** 단일 사용자 대상 제재(특정 멤버 ban/kick/mute/unmute/role). userId 필수. */
export const ENFORCE_USER_ACTIONS = ["ban", "kick", "mute", "unmute", "role"] as const;
export type EnforceUserAction = (typeof ENFORCE_USER_ACTIONS)[number];

/** 전체 enforce action — 사용자 대상 + 공간 전체(archive). */
export const ENFORCE_ACTIONS = [...ENFORCE_USER_ACTIONS, "archive"] as const;
export type EnforceAction = (typeof ENFORCE_ACTIONS)[number];

export const ENFORCE_ROLES = ["OWNER", "STAFF", "PARTICIPANT"] as const;
export type EnforceRole = (typeof ENFORCE_ROLES)[number];

interface EnforceRequestBase {
  spaceId: string;
  /** 표시용 actor 이름(kickedBy/mutedBy 등). 권한 판정엔 사용하지 않음 */
  actorName?: string;
}

/** 특정 멤버 대상 제재 — userId 필수. */
export interface UserEnforceRequest extends EnforceRequestBase {
  action: EnforceUserAction;
  userId: string;
  /** action === "role" 일 때 필수 — 강등/승격 후 갱신할 역할 */
  role?: EnforceRole;
}

/**
 * 공간 전체 archive — 그 공간의 모든 접속자를 추방한다(WI-036).
 * 단일 user 대상이 아니므로 userId 가 없다(discriminated union — 타입이 userId 누락을 강제).
 */
export interface ArchiveEnforceRequest extends EnforceRequestBase {
  action: "archive";
}

/**
 * 크로스프로세스 제재 요청. action 으로 분기되는 discriminated union이라
 * archive 에 userId 를 넣거나 멤버 제재에서 userId 를 빠뜨리면 컴파일 타임에 잡힌다.
 */
export type EnforceRequest = UserEnforceRequest | ArchiveEnforceRequest;

/** socket 서버 내부 엔드포인트 경로 */
export const ENFORCE_PATH = "/internal/enforce";
export const ENFORCE_SIGNATURE_HEADER = "x-flowspace-signature";
export const ENFORCE_TIMESTAMP_HEADER = "x-flowspace-timestamp";
/** replay 허용 시간차(±) — 발신/수신 시계 오차 + 전송 지연 흡수 */
export const ENFORCE_REPLAY_WINDOW_MS = 30_000;
/** 내부 요청 body 상한 (작은 고정 페이로드) */
export const ENFORCE_MAX_BODY_BYTES = 4096;

const HEX_RE = /^[0-9a-f]+$/i;

function signaturePayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

/** HMAC-SHA256 서명(hex) 생성 */
export function computeEnforceSignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(signaturePayload(timestamp, rawBody)).digest("hex");
}

/**
 * 서명 검증 (timing-safe). 비-hex/홀수길이/길이불일치는 timingSafeEqual 예외 없이 false.
 */
export function verifyEnforceSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  if (!signature || signature.length % 2 !== 0 || !HEX_RE.test(signature)) return false;
  const expected = computeEnforceSignature(secret, timestamp, rawBody);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  // 길이 불일치 시 timingSafeEqual은 throw → 선제 차단
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/** timestamp가 replay window 내 신선한 값인지 */
export function isFreshTimestamp(timestamp: string, nowMs: number): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowMs - ts) <= ENFORCE_REPLAY_WINDOW_MS;
}

/**
 * 신뢰할 수 없는 파싱 객체를 EnforceRequest로 검증. 실패 시 null.
 * action 별로 분기 검증한다(기존 멤버 제재 회귀 방지):
 *  - "archive": userId 불필요(공간 전체 대상). 입력에 userId가 있어도 무시(타입엔 미포함).
 *  - 그 외(ban/kick/mute/unmute/role): userId 필수. "role"은 role 화이트리스트 필수.
 * actorName은 100자로 절단.
 */
export function parseEnforceRequest(raw: unknown): EnforceRequest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.spaceId !== "string" || r.spaceId.length === 0) return null;
  if (typeof r.action !== "string" || !ENFORCE_ACTIONS.includes(r.action as EnforceAction)) return null;
  const action = r.action as EnforceAction;

  const actorName = typeof r.actorName === "string" ? r.actorName.slice(0, 100) : undefined;

  if (action === "archive") {
    // 공간 전체 archive — userId/role 무시(다른 행위자 식별자가 섞여도 채택하지 않음).
    return { spaceId: r.spaceId, action: "archive", actorName };
  }

  // 멤버 대상 제재 — userId 필수.
  if (typeof r.userId !== "string" || r.userId.length === 0) return null;

  let role: EnforceRole | undefined;
  if (action === "role") {
    if (typeof r.role !== "string" || !ENFORCE_ROLES.includes(r.role as EnforceRole)) return null;
    role = r.role as EnforceRole;
  }

  return { spaceId: r.spaceId, userId: r.userId, action, role, actorName };
}
