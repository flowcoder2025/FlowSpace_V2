// Enforcement Handler — socket 서버 측 (WI-005)
//
// Next API route(dashboard 제재)가 보낸 HMAC 서명 요청을 받아, 살아있는 소켓 연결에
// ban/kick/mute/unmute/role 을 즉시 반영한다. socket.io 와 동일한 httpServer 의
// non-socket.io 요청 경로(POST /internal/enforce)로 들어온다.
//
// 보안 다층 방어(설계 codex consult):
//  1) SOCKET_INTERNAL_SECRET HMAC 서명 검증 + replay window
//  2) body size limit + 스키마 검증
//  3) DB postcondition 재확인 — 시크릿 유출/Next 핸들러 버그가 곧바로 임의 추방으로
//     확대되는 것을 차단(예: ban이면 해당 멤버가 실제 BANNED인지 확인 후 끊기)

import type { IncomingMessage, ServerResponse } from "http";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/features/space/socket/internal/types";
import {
  ENFORCE_PATH,
  ENFORCE_SIGNATURE_HEADER,
  ENFORCE_TIMESTAMP_HEADER,
  ENFORCE_MAX_BODY_BYTES,
  verifyEnforceSignature,
  isFreshTimestamp,
  parseEnforceRequest,
  type EnforceRequest,
} from "../../src/features/space/enforce/internal/contract";
import { spacePlayersMap } from "./room";
import { getPrisma } from "../lib/prisma";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// space:error emit 이 클라이언트에 도달한 뒤 끊기 위한 짧은 grace.
// 즉시 disconnect(true) 하면 직전 emit 이 flush 되지 않을 수 있다(codex).
const DISCONNECT_GRACE_MS = 250;

/** spaceId room 에서 해당 userId 의 모든 소켓(다중 탭) */
function socketsForUser(io: IO, spaceId: string, userId: string): TypedSocket[] {
  const ids = io.sockets.adapter.rooms.get(spaceId);
  if (!ids) return [];
  const out: TypedSocket[] = [];
  for (const id of ids) {
    const s = io.sockets.sockets.get(id) as TypedSocket | undefined;
    if (s && s.data.userId === userId) out.push(s);
  }
  return out;
}

/**
 * DB postcondition 재확인. Next 핸들러가 실제로 그 상태를 만들었는지 확인한 뒤에만
 * 소켓을 조작한다. 불일치(또는 검증 오류)면 false → 호출측이 409 로 거부.
 */
async function verifyPostcondition(req: EnforceRequest): Promise<boolean> {
  const prisma = await getPrisma();
  const member = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: req.spaceId, userId: req.userId } },
    select: { restriction: true, role: true },
  });
  switch (req.action) {
    case "ban":
      return member?.restriction === "BANNED";
    case "kick":
      return member === null; // kick = row 삭제됨
    case "mute":
      return member?.restriction === "MUTED";
    case "unmute":
      return member?.restriction === "NONE";
    case "role":
      return member?.role === req.role;
    default:
      return false;
  }
}

/**
 * 검증된 enforce 요청을 소켓에 적용. 영향받은 소켓 수 반환(오프라인이면 0=no-op).
 */
export function applyEnforcement(io: IO, req: EnforceRequest): number {
  const targets = socketsForUser(io, req.spaceId, req.userId);
  if (targets.length === 0) return 0;

  const players = spacePlayersMap.get(req.spaceId);
  const nickname = players?.get(req.userId)?.nickname ?? "Unknown";
  const actor = req.actorName ?? "관리자";

  if (req.action === "ban" || req.action === "kick") {
    const code = req.action === "ban" ? "BANNED" : "KICKED";
    const message =
      req.action === "ban"
        ? "관리자에 의해 이 공간에서 차단되었습니다."
        : "관리자에 의해 이 공간에서 추방되었습니다.";

    // 주변 플레이어에게 1회 알림(사용자 단위). player:left 는 각 소켓 disconnect 시 발생.
    io.to(req.spaceId).emit("member:kicked", {
      memberId: req.userId,
      nickname,
      kickedBy: actor,
    });

    for (const s of targets) {
      s.emit("space:error", { code, message });
      // grace 후 강제 종료 — disconnect 핸들러가 leaveSpace(presence 정리)를 수행
      setTimeout(() => s.disconnect(true), DISCONNECT_GRACE_MS);
    }
  } else if (req.action === "mute" || req.action === "unmute") {
    const restriction = req.action === "mute" ? "MUTED" : "NONE";
    for (const s of targets) s.data.restriction = restriction;
    if (req.action === "mute") {
      io.to(req.spaceId).emit("member:muted", { memberId: req.userId, nickname, mutedBy: actor });
    } else {
      io.to(req.spaceId).emit("member:unmuted", { memberId: req.userId, nickname, unmutedBy: actor });
    }
  } else if (req.action === "role" && req.role) {
    // 권한 회수/변경 — 인메모리 role 캐시 갱신(강등 시 admin 이벤트 차단)
    for (const s of targets) s.data.role = req.role;
  }

  return targets.length;
}

function headerStr(req: IncomingMessage, name: string): string | null {
  const v = req.headers[name];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * /internal/enforce 요청 처리. 이 경로가 아니면 false(호출측이 404 처리).
 * 처리했으면 true.
 */
export async function handleInternalHttp(
  io: IO,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const pathname = (req.url ?? "").split("?")[0];
  if (pathname !== ENFORCE_PATH) return false;

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  const secret = process.env.SOCKET_INTERNAL_SECRET;
  if (!secret) {
    console.error("[enforce] SOCKET_INTERNAL_SECRET 미설정 — enforce 비활성(요청 거부)");
    sendJson(res, 503, { error: "Enforcement not configured" });
    return true;
  }

  // body 수집 (size limit 초과 시 즉시 중단)
  let raw = "";
  let tooLarge = false;
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > ENFORCE_MAX_BODY_BYTES) {
      tooLarge = true;
      break;
    }
  }
  if (tooLarge) {
    sendJson(res, 413, { error: "Body too large" });
    return true;
  }

  const signature = headerStr(req, ENFORCE_SIGNATURE_HEADER);
  const timestamp = headerStr(req, ENFORCE_TIMESTAMP_HEADER);
  if (!signature || !timestamp) {
    sendJson(res, 401, { error: "Missing signature" });
    return true;
  }
  if (!isFreshTimestamp(timestamp, Date.now())) {
    sendJson(res, 401, { error: "Stale timestamp" });
    return true;
  }
  if (!verifyEnforceSignature(secret, timestamp, raw, signature)) {
    sendJson(res, 403, { error: "Invalid signature" });
    return true;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return true;
  }
  const enforceReq = parseEnforceRequest(parsed);
  if (!enforceReq) {
    sendJson(res, 400, { error: "Invalid request" });
    return true;
  }

  try {
    const ok = await verifyPostcondition(enforceReq);
    if (!ok) {
      sendJson(res, 409, { error: "Postcondition not met" });
      return true;
    }
    const affectedSockets = applyEnforcement(io, enforceReq);
    sendJson(res, 200, { enforced: true, affectedSockets });
  } catch (err) {
    console.error("[enforce] 처리 오류:", err);
    sendJson(res, 500, { error: "Enforcement failed" });
  }
  return true;
}
