import type { Prisma } from "@prisma/client";

/**
 * 어드민 이벤트 로그(SpaceEventLog) 공개 응답 정규화 (WI-032)
 *
 * `GET /api/spaces/[id]/admin/logs`는 raw `SpaceEventLog` 행을 그대로 반환했고,
 * 그 행의 `payload`(Json)는 화면(`event-log-table`)·CSV(`csv-export`)에서 키 필터
 * 없이 `JSON.stringify`로 직렬화된다. 현재 payload write site 5곳은 전부 operational
 * 메타데이터(action/대상ID/표시명/미디어 종류)만 담지만, 향후 새 event type이 payload에
 * email·inviteCode·accessSecret·prompt 같은 값을 넣으면 API → 화면 → CSV 세 경로로
 * 동시에 raw 노출된다(WI-014/019/021/024에서 반복 확인한 "DB Json이 응답으로 자동 이동"
 * 패턴과 동형).
 *
 * 차단 지점은 **API 응답 DTO**다 — 화면/CSV만 필터하면 raw JSON을 직접 호출하는 admin
 * 클라이언트가 우회한다(codex consult 지적). 따라서 이 모듈이 payload를 키 allowlist로
 * 정규화하고, 로그 행 자체도 소비처가 쓰는 필드만 남기는 lean DTO로 축소한다
 * (deny-by-default — WI-019/021 패턴). 화면/CSV는 이미 정규화된 payload를 받으므로
 * 별도 sanitize를 두지 않고(이중 책임 회피, codex), 같은 공개 타입만 공유한다.
 *
 * 순수 함수 + 타입만 노출하며 Prisma 런타임을 import하지 않아(`import type`만) 클라이언트
 * 컴포넌트에서도 타입을 안전하게 공유할 수 있다.
 */

/**
 * 공개 payload 키 allowlist — 현존 5개 write site에서 실측한 8키만 통과시킨다.
 *
 * - livekit/webhook(track_(un)published): trackType, trackSource, participantName
 * - admin/announce: action, messageId
 * - admin/members(kick): action, targetName
 * - admin/members(제재): action, targetMemberId, targetName
 * - admin/messages(deleteMessage): action, messageId, senderName
 *
 * allowlist(deny-by-default)이므로 향후 신규 키는 명시 등재 전까지 응답에서 제거된다.
 */
export const PUBLIC_SPACE_EVENT_PAYLOAD_KEYS = [
  "action",
  "messageId",
  "targetMemberId",
  "targetName",
  "senderName",
  "trackType",
  "trackSource",
  "participantName",
] as const;

/** 공개 payload 표현(JSON-safe). 비객체/빈 객체는 `null`로 축소한다. */
export type PublicSpaceEventPayload = Record<string, unknown> | null;

/**
 * 저장된 payload(Json)를 공개 키 allowlist로 축소한다.
 * null/undefined/비객체/배열 → null. 객체면 allowlist 키만 골라 새 객체로.
 * allowlist 키가 하나도 없으면 → null(화면의 "-", CSV 빈 Details 계약 보존).
 */
export function toPublicSpaceEventPayload(
  payload: Prisma.JsonValue | null | undefined
): PublicSpaceEventPayload {
  if (
    payload === null ||
    payload === undefined ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const src = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_SPACE_EVENT_PAYLOAD_KEYS) {
    const value = src[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** 어드민 로그 공개 응답 DTO (WI-032). 소비처(table/page/csv)가 쓰는 필드만. */
export interface PublicSpaceEventLog {
  id: string;
  eventType: string;
  payload: PublicSpaceEventPayload;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
}

/**
 * 헬퍼 입력 — route의 `findMany` 행을 구조적으로 수용한다(여분 스칼라 필드는 무시).
 * `eventType`은 `SpaceEventType`(enum ⊆ string)을 string으로 받는다.
 */
export interface SpaceEventLogForPublic {
  id: string;
  eventType: string;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
}

/**
 * raw SpaceEventLog 행 → 공개 응답 DTO.
 * payload는 allowlist로 정규화하고, 응답엔 소비처가 쓰는 필드만 포함한다
 * (deny-by-default: spaceId·userId·guestSessionId·participantId 등 내부 스칼라 제외).
 * select가 우발적으로 넓어지거나 모델에 컬럼이 추가돼도 응답 키 집합은 고정된다.
 */
export function toPublicSpaceEventLog(
  log: SpaceEventLogForPublic
): PublicSpaceEventLog {
  return {
    id: log.id,
    eventType: log.eventType,
    payload: toPublicSpaceEventPayload(log.payload),
    createdAt: log.createdAt,
    user: log.user ? { name: log.user.name, email: log.user.email } : null,
  };
}
