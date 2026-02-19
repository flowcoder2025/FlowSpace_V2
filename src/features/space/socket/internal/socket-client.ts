import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

const SOCKET_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:${process.env.NEXT_PUBLIC_SOCKET_PORT || 3001}`
    : "";

/** 소켓 클라이언트 인스턴스 (싱글턴) */
export async function getSocketClient(): Promise<TypedSocket> {
  if (socket?.connected) return socket;

  // 토큰 발급
  const res = await fetch("/api/socket/token");
  if (!res.ok) throw new Error("Failed to get socket token");
  const { token } = await res.json();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: Infinity,
  });

  return socket;
}

/** 소켓 연결 해제 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
