# Phase 6 보완: 채팅 시스템 레거시 포팅

> Epic: [comfyui-asset-pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
레거시(flow_metaverse) 채팅 시스템의 전체 기능을 FlowSpace에 포팅.
기존 단일 ChatPanel → 탭 기반 오케스트레이터 + 서브컴포넌트 구조.

## Task 목록
- [x] A1: 타입 확장 (MessageType, ChatTab, ReactionType, ParsedInput 등)
- [x] A2: 소켓 타입 확장 (C2S/S2C 20+ 이벤트 추가)
- [x] A3: 서버 핸들러 대폭 확장 (chat.ts 재작성 + party.ts 신규)
- [x] A4: 채팅 유틸리티 (chat-filter.ts, chat-parser.ts)
- [x] A5: useChat 훅 확장 (ID매핑, 리액션, reply, 탭)
- [x] A6: 컴포넌트 재작성 (chat-panel → 오케스트레이터 + 3 서브컴포넌트)
- [x] A7: 채팅 히스토리 API (cursor 페이지네이션)
- [x] A8: 통합 업데이트 (index.ts, use-socket.ts, use-socket-bridge.ts, space-client.tsx)

## 구현 상세

### A1: 타입 확장
**파일:** `src/features/space/chat/internal/chat-types.ts`
```typescript
export type MessageType = "message" | "party" | "whisper" | "system" | "announcement";
export type ChatTab = "all" | "party" | "whisper" | "system" | "links";
export type ReactionType = "thumbsup" | "heart" | "check";
export interface MessageReaction { type: ReactionType; userId: string; userNickname: string; }
export interface ReplyTo { id: string; senderNickname: string; content: string; }
export interface ChatMessage {
  id: string; tempId?: string; userId: string; nickname: string; content: string;
  type: MessageType; timestamp: string; reactions?: MessageReaction[];
  targetNickname?: string; partyId?: string; partyName?: string;
  replyTo?: ReplyTo; isDeleted?: boolean; failed?: boolean;
}
export type AdminCommandType = "mute" | "unmute" | "kick" | "announce";
export interface ParsedInput { type: "message"|"whisper"|"admin"; content: string; targetNickname?: string; adminCommand?: AdminCommandType; }
```

### A2: 소켓 타입 확장
**파일:** `src/features/space/socket/internal/types.ts`
- C2S 추가: `whisper:send`, `party:message`, `reaction:toggle`, `chat:delete`, `admin:mute/unmute/kick/announce`
- S2C 추가: `whisper:receive/sent`, `chat:messageIdUpdate/messageFailed/messageDeleted`, `party:message`, `reaction:updated`, `member:muted/unmuted/kicked`, `space:announcement`
- `SocketData` 인터페이스 추가 (role, restriction, memberId)

### A3: 서버 핸들러
**파일:** `server/handlers/chat.ts` (재작성)
- Optimistic broadcast: tempId 발행 → DB 비동기 저장 → 실패 시 messageFailed
- Mute 체크, Rate limiting (500ms)
- Whisper: 닉네임 기반 타겟 탐색, 멀티소켓 지원
- 관리 명령: mute/unmute/kick/announce (OWNER/STAFF만)
- 메시지 삭제, 리액션 토글

**파일:** `server/handlers/party.ts` (신규)
- `party:join/leave/message`
- Socket.io room 기반 (`party-{spaceId}-{partyId}`)

**파일:** `server/handlers/room.ts` (수정)
- `loadMemberInfo()` 추가: DB에서 SpaceMember role/restriction 로드

**파일:** `server/index.ts` (수정)
- `handleParty` 등록

### A4: 채팅 유틸리티
**파일:** `src/features/space/chat/internal/chat-filter.ts`
- `filterMessagesByTab()`, `calculateUnreadCounts()`, `extractUrls()`, `parseContentWithUrls()`

**파일:** `src/features/space/chat/internal/chat-parser.ts`
- `parseInput()`: admin(@) → whisper(/) → regular 우선순위

### A5: useChat 훅 확장
**파일:** `src/features/space/chat/internal/use-chat.ts`
- 통합 sendMessage (parseInput → admin/whisper/message 라우팅)
- 리액션 토글 (낙관적 업데이트)
- replyTo 상태 관리, 탭 상태
- _handleMessageIdUpdate/_handleMessageFailed/_handleMessageDeleted/_handleReactionUpdated 내부 핸들러

**파일:** `src/features/space/chat/internal/use-chat-storage.ts` (신규)
- LocalStorage 캐싱 (spaceId별, max 200, 500ms debounce, 7일 만료)

### A6: 컴포넌트 재작성
**파일:** `src/components/space/chat-panel.tsx` → 오케스트레이터
**파일:** `src/components/space/chat/chat-tabs.tsx` - 5탭 + 안읽은 배지
**파일:** `src/components/space/chat/chat-message-list.tsx` - 메시지 렌더링 (리액션, 답장, 호버 액션, 자동스크롤)
**파일:** `src/components/space/chat/chat-input-area.tsx` - 입력 (답장모드, 파티모드, ESC 취소)
**파일:** `src/components/space/chat/index.ts` - Public API

### A7: 채팅 히스토리 API
**파일:** `src/app/api/spaces/[id]/messages/route.ts`
- GET: cursor 기반 페이지네이션 (기본 50, 최대 100)
- 멤버십 검증, 귓속말 필터링

### A8: 통합
- `src/features/space/chat/index.ts` - 새 export 추가
- `src/features/space/socket/internal/use-socket.ts` - 12+ 새 이벤트 리스너
- `src/features/space/bridge/internal/use-socket-bridge.ts` - 새 콜백 전달
- `src/app/space/[id]/space-client.tsx` - sendChatRef/sendWhisperRef/sendReactionRef/sendAdminRef 패턴

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/features/space/chat/internal/chat-types.ts` | 수정 | MessageType, ChatTab, Reaction 등 |
| `src/features/space/socket/internal/types.ts` | 수정 | 20+ C2S/S2C 이벤트 |
| `server/handlers/chat.ts` | 수정 | 전면 재작성 |
| `server/handlers/party.ts` | 추가 | 파티존 핸들러 |
| `server/handlers/room.ts` | 수정 | role/restriction 로드 |
| `server/index.ts` | 수정 | handleParty 등록 |
| `src/features/space/chat/internal/chat-filter.ts` | 추가 | 탭 필터링 |
| `src/features/space/chat/internal/chat-parser.ts` | 추가 | 입력 파싱 |
| `src/features/space/chat/internal/use-chat.ts` | 수정 | 전면 재작성 |
| `src/features/space/chat/internal/use-chat-storage.ts` | 추가 | LocalStorage 캐싱 |
| `src/features/space/chat/index.ts` | 수정 | 새 export |
| `src/components/space/chat-panel.tsx` | 수정 | 오케스트레이터 |
| `src/components/space/chat/chat-tabs.tsx` | 추가 | 탭 선택기 |
| `src/components/space/chat/chat-message-list.tsx` | 추가 | 메시지 렌더링 |
| `src/components/space/chat/chat-input-area.tsx` | 추가 | 입력 영역 |
| `src/components/space/chat/index.ts` | 추가 | 컴포넌트 API |
| `src/app/api/spaces/[id]/messages/route.ts` | 추가 | 히스토리 API |
| `src/features/space/socket/internal/use-socket.ts` | 수정 | 새 리스너 |
| `src/features/space/bridge/internal/use-socket-bridge.ts` | 수정 | 새 콜백 |
| `src/app/space/[id]/space-client.tsx` | 수정 | 전체 통합 |
