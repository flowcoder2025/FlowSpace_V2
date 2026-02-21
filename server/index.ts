import { config } from "dotenv";
config({ quiet: true });

import { createServer } from "http";
import { Server } from "socket.io";
import { verifySocketToken } from "./middleware/auth";
import { handleRoom } from "./handlers/room";
import { handleMovement } from "./handlers/movement";
import { handleChat } from "./handlers/chat";
import { handleParty } from "./handlers/party";
import { handleEditor } from "./handlers/editor";
import { handleMedia } from "./handlers/media";
import { handleAvatar } from "./handlers/avatar";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/features/space/socket/internal/types";

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
const CORS_ORIGIN = process.env.AUTH_URL || "http://localhost:3000";

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// 인증 미들웨어
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const user = await verifySocketToken(token);
    socket.data.userId = user.userId;
    socket.data.name = user.name;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// 연결 핸들러
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.data.userId} (${socket.id})`);

  handleRoom(io, socket);
  handleMovement(io, socket);
  handleChat(io, socket);
  handleParty(io, socket);
  handleEditor(io, socket);
  handleMedia(io, socket);
  handleAvatar(io, socket);

  socket.on("disconnect", (reason) => {
    console.log(
      `[Socket] Disconnected: ${socket.data.userId} (${reason})`
    );
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Socket.io] Server running on port ${PORT}`);
  console.log(`[Socket.io] CORS origin: ${CORS_ORIGIN}`);
});
