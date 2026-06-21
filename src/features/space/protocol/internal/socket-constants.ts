// Socket.io transport 상수 (통신 도메인 순수 계약)
//
// 클라이언트 소켓 연결의 transport 정책. React/Node 무의존 순수 const.
// (WI-012-1: chat/internal/chat-constants.ts에서 의미상 올바른 위치로 승격)
//
// 도메인 규칙 근거 (communication.md):
//   invariant #1 — 위치 100ms throttle (클라 → 서버 이동 업데이트 최소 간격)
//   invariant #2 — 지수 백오프 재연결 500ms → 5s, 최대 30회 시도

// ── 소켓 재연결 (지수 백오프) ──
export const RECONNECTION_ATTEMPTS = 30;
export const RECONNECTION_DELAY = 500;
export const RECONNECTION_DELAY_MAX = 5000;
export const RECONNECTION_TIMEOUT = 20000;

// ── 이동 쓰로틀 ──
export const MOVE_THROTTLE_MS = 100;
