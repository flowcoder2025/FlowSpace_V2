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
import { handleInternalHttp } from "./handlers/enforce";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/features/space/protocol/internal/socket-events";

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || process.env.AUTH_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

// 내부 enforce 엔드포인트(POST /internal/enforce)를 socket.io 와 동일 httpServer 에서 처리.
// request 핸들러는 createServer 시점에 전달해야 socket.io(engine.io)가 이를 캡처해
// non-socket.io 요청에 위임한다. io 는 아래에서 할당되며, 핸들러는 요청 시점(listen 이후)에만
// 호출되므로 그때 io 는 이미 바인딩돼 있다.
let io: Server<ClientToServerEvents, ServerToClientEvents>;

const httpServer = createServer((req, res) => {
  void handleInternalHttp(io, req, res).then((handled) => {
    if (!handled && !res.writableEnded) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });
});

io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
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
  console.log(`[Socket.io] CORS origins: ${CORS_ORIGINS.join(", ")}`);
});
