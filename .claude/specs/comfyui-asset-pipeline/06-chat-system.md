# Phase 6: 채팅 시스템

> Epic: [ComfyUI Asset Pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
실시간 채팅 시스템 구현 (Socket.io 기반 메시지 중계 + 채팅 UI + EventBridge CHAT_FOCUS 연동)

## Task 목록
- [x] Task 6.1: 서버 채팅 핸들러
- [x] Task 6.2: 채팅 모듈 (chat-types, use-chat, index)
- [x] Task 6.3: 채팅 UI 컴포넌트 (ChatPanel)
- [x] Task 6.4: 통합 (space-client.tsx에 ChatPanel 연동)

## 구현 상세

### Task 6.1: 서버 채팅 핸들러

**파일:** `server/handlers/chat.ts` (신규)
```typescript
import type { Server, Socket } from "socket.io";
import { spacePlayersMap } from "./room";

const MAX_CONTENT_LENGTH = 500;

function sanitizeContent(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_CONTENT_LENGTH);
  return trimmed.replace(/[<>]/g, "");
}

export function handleChat(io: IO, socket: TypedSocket) {
  socket.on("chat:send", ({ content, type, targetId }) => {
    // sanitize → nickname 조회 → 타입별 브로드캐스트
    // group/party: io.to(spaceId).emit("chat:message", ...)
    // whisper: targetId 소켓에만 + 보낸 사람에게 emit
  });
}
```

**변경사항:**
- `server/handlers/room.ts`: `spacePlayersMap` → `export` 추가
- `server/index.ts`: `handleChat(io, socket)` 등록

### Task 6.2: 채팅 모듈

**파일:** `src/features/space/chat/internal/chat-types.ts` (신규)
```typescript
export type ChatType = "group" | "whisper" | "party" | "system";

export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  type: ChatType;
  timestamp: string;
}
```

**파일:** `src/features/space/chat/internal/use-chat.ts` (신규)
```typescript
export function useChat({ sendChat }: UseChatOptions): UseChatReturn {
  // messages 배열 관리 (최대 200개)
  // sendMessage: DOMPurify sanitize → socket sendChat 호출
  // setChatFocused: EventBridge CHAT_FOCUS emit
  // addMessage: 외부에서 수신 메시지 추가용
}
```

**파일:** `src/features/space/chat/index.ts` (신규)
```typescript
export { useChat } from "./internal/use-chat";
export type { ChatMessage, ChatType } from "./internal/chat-types";
```

### Task 6.3: 채팅 UI 컴포넌트

**파일:** `src/components/space/chat-panel.tsx` (신규)
```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  onFocusChange: (focused: boolean) => void;
}

export default function ChatPanel({ messages, onSend, onFocusChange }: ChatPanelProps)
// - 하단 좌측 고정 (absolute bottom-4 left-4 w-80)
// - 접기/펼치기 토글 버튼
// - 메시지 목록 (h-60 스크롤, 자동 하단 스크롤)
// - system 메시지: italic gray-500
// - whisper 메시지: purple-300 + "(귓속말)" 태그
// - 입력창: Enter 전송, focus/blur → onFocusChange
```

### Task 6.4: 통합

**파일:** `src/app/space/[id]/space-client.tsx` (수정)
- `useChat` 훅 + `ChatPanel` 컴포넌트 추가
- `sendChatRef` 패턴으로 순환 의존 해결 (useChat ↔ useSocketBridge)
- `onChatMessage` 콜백: socket `chat:message` → `useChat.addMessage`
- `useSocketBridge`에 `onChatMessage` 전달, `sendChat` 반환 추가

**파일:** `src/features/space/socket/internal/use-socket.ts` (수정)
- `onChatMessage` 콜백 옵션 추가
- `chat:message` 소켓 이벤트 리스너 등록
- `onChatMessageRef`로 렌더 중 ref 업데이트 방지 (useEffect 내 할당)

**파일:** `src/features/space/bridge/internal/use-socket-bridge.ts` (수정)
- `onChatMessage` 옵션 전달
- `sendChat` 반환값 추가

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `server/handlers/chat.ts` | 추가 | 채팅 핸들러 (sanitize + 브로드캐스트/귓속말) |
| `server/handlers/room.ts` | 수정 | spacePlayersMap export |
| `server/index.ts` | 수정 | handleChat 등록 |
| `src/features/space/chat/index.ts` | 추가 | 채팅 모듈 Public API |
| `src/features/space/chat/internal/chat-types.ts` | 추가 | ChatMessage, ChatType 타입 |
| `src/features/space/chat/internal/use-chat.ts` | 추가 | useChat 훅 |
| `src/components/space/chat-panel.tsx` | 추가 | 채팅 UI 패널 |
| `src/app/space/[id]/space-client.tsx` | 수정 | useChat + ChatPanel 통합 |
| `src/features/space/socket/internal/use-socket.ts` | 수정 | onChatMessage 콜백 + chat:message 리스너 |
| `src/features/space/bridge/internal/use-socket-bridge.ts` | 수정 | sendChat + onChatMessage 전달 |

## 데이터 플로우
```
[입력] → ChatPanel → useChat.sendMessage() → DOMPurify → socket.emit("chat:send")
                                                     ↓
[서버] chat handler: sanitize → nickname 조회 → chat:message broadcast
                                                     ↓
[수신] socket.on("chat:message") → onChatMessage callback → useChat.addMessage → ChatPanel
                                                     ↓
[Phaser] 입력창 focus → EventBridge CHAT_FOCUS → InputController (이동 비활성)
```

## 컨트랙트 준수
- Communication: 서버 DB 직접 접근 없음 (메모리 중계만), 양쪽 sanitize (서버: HTML태그 제거, 클라이언트: DOMPurify)
- Frontend: CHAT_FOCUS EventBridge emit → Phaser InputController 연동
- 모듈 구조: index.ts(Public) + internal/(Private) 준수

## 검증 결과
- tsc --noEmit: ✅ 통과
- next lint: ✅ 통과 (0 errors, 0 warnings)
- next build: ✅ 성공 (28 routes)

## 다음 Phase로 넘기는 것
- DB ChatMessage 저장 (현재 메모리 중계만)
- party 타입 → 실제 파티 멤버 필터링 (현재 group과 동일)
- 채팅 히스토리 로드 (DB 기반)
