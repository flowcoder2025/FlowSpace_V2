# Phase 4: Socket.io 실시간 서버

> Epic: [ComfyUI Asset Pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19
> Agent: Communication

## 목표
Socket.io 기반 멀티플레이어 인프라 구축

## 컨트랙트 준수
- event-protocol.md 정의 이벤트 타입 사용 ✅
- DB 직접 접근 없음 ✅
- 위치 업데이트 throttle 100ms ✅
- 재연결 exponential backoff ✅
- module/index.ts + internal/ 구조 ✅

## Socket Events (구현됨)
| Event | Direction | 용도 |
|-------|-----------|------|
| `join:space` | C→S | 공간 입장 |
| `leave:space` | C→S | 공간 퇴장 |
| `move` | C→S | 위치 업데이트 |
| `player:joined` | S→C | 입장 알림 |
| `player:left` | S→C | 퇴장 알림 |
| `player:moved` | S→C | 위치 브로드캐스트 |
| `players:list` | S→C | 접속자 목록 |

## 인증 플로우
```
Client → GET /api/socket/token (NextAuth 세션 검증)
       ← { token: JWT(userId, name) }
Client → Socket handshake { auth: { token } }
Server → jwtVerify(token, AUTH_SECRET) → socket.data.userId
```

## 변경 파일 (9파일)
- `server/` (4): index.ts, middleware/auth.ts, handlers/room.ts, handlers/movement.ts
- `src/features/space/socket/` (4): index.ts, internal/types.ts, socket-client.ts, use-socket.ts
- `src/app/api/socket/token/route.ts` (1)

## Level 1 검증: tsc ✅ | eslint ✅ | build ✅
