import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import {
  RECONNECTION_ATTEMPTS,
  RECONNECTION_DELAY,
  RECONNECTION_DELAY_MAX,
  RECONNECTION_TIMEOUT,
} from "@/features/space/chat/internal/chat-constants";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001";
  const url = `${window.location.protocol}//${window.location.hostname}:${port}`;
  return url;
}

/** 소켓 클라이언트 인스턴스 (싱글턴) */
export async function getSocketClient(): Promise<TypedSocket> {
  // 이미 연결됐거나 연결 중인 소켓 재사용
  if (socket && (socket.connected || socket.active)) {
    return socket;
  }

  // 이전 소켓이 있으면 정리
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  // 토큰 발급
  const res = await fetch("/api/socket/token");
  if (!res.ok) throw new Error("Failed to get socket token");
  const { token } = await res.json();

  const url = getSocketUrl();
  console.log("[Socket] Connecting to:", url);

  socket = io(url, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: RECONNECTION_DELAY,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX,
    timeout: RECONNECTION_TIMEOUT,
  });

  return socket;
}

/** 소켓 연결 해제 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
