---
paths:
  - "src/features/space/socket/**"
  - "server/**"
  - "src/features/space/bridge/**"
  - "src/features/space/chat/**"
---

# Communication Domain

실시간 통신 — Socket.io 서버/클라이언트, 플레이어 동기화, 채팅, 파티존

## Invariants

1. **위치 100ms throttle**: 클라이언트 → 서버 이동 업데이트 최소 간격
2. **지수 백오프 재연결**: 500ms → 5s, 최대 30회 시도
3. **socket.data.userId 강제**: 항상 서버의 socket.data.userId 사용 (클라이언트 전송값 무시)
4. **XSS sanitize**: 모든 메시지 콘텐츠 sanitize 후 broadcast
5. **파티존 범위 자동 퇴장**: 물리적 범위 밖 이동 시 자동 party:leave
6. **party:message 전용 핸들러**: chat:send 경로로 party 메시지 전송 차단
7. **Optimistic broadcast**: server tempId → broadcast → DB async → messageIdUpdate/messageFailed
8. **에러 세분화**: chat:error / whisper:error / party:error / admin:error (code + message)
9. **인증 토큰**: `/api/socket/token` → jose JWT 발급 → 서버 미들웨어 검증

이벤트 타입은 `src/features/space/socket/internal/types.ts` 참조
