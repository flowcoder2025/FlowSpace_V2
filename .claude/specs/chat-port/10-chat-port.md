# Phase 10: Chat System Port (flow_metaverse → FlowSpace)

> Epic: [chat-port](./README.md)
> 상태: 완료 | 업데이트: 2026-02-20

## 목표
flow_metaverse 원본 채팅 기능을 FlowSpace 모듈 구조에 맞게 전체 포팅.

## Task 목록
- [x] Task 1.1: 공유 상수 파일 생성 (`chat-constants.ts`)
- [x] Task 1.2: 타입 확장 (`chat-types.ts`)
- [x] Task 1.3: 상수 import 적용 (6파일)
- [x] Task 1.4: 캡슐화 위반 수정 + index.ts 업데이트
- [x] Task 2.1: chat-parser.ts 재작성 (한/영 별칭, 에디터 명령어)
- [x] Task 2.2: command-hints.ts 생성
- [x] Task 2.3: use-chat.ts 새 파서 결과 처리
- [x] Task 3.1: URL 정규식 강화 (www., 도메인 전용)
- [x] Task 3.2: 5탭 필터링 완성 (links 탭 시스템 제외)
- [x] Task 3.3: 크로스탭 안읽음 카운트
- [x] Task 3.4: parseContentWithUrls 개선 (ensureProtocol, 50자 말줄임)
- [x] Task 4.1: socket-client.ts 재연결 설정
- [x] Task 4.2: use-socket.ts 재연결 모니터링
- [x] Task 4.3: 브라우저 가시성 처리
- [x] Task 4.4: 타입 에러 이벤트 추가
- [x] Task 4.5: bridge + space-client socketError 연결
- [x] Task 5.1: ChatInputArea 귓속말 히스토리
- [x] Task 5.2: ChatTabs 폰트 크기 조절
- [x] Task 5.3: ChatMessageList SSOT + 폰트 + URL
- [x] Task 5.4: ChatPanel 통합 배선
- [x] Task 5.5: space-client.tsx 연결
- [x] Task 6.1: 서버 에러 이벤트 세분화
- [x] Task 6.2: 서버 상수 import 적용
- [x] Task 6.3: tsc/lint 검증

## 구현 상세

### Phase 1: 기반 — 상수 추출 + 타입 확장

#### Task 1.1: chat-constants.ts (NEW)
**파일:** `src/features/space/chat/internal/chat-constants.ts`

```ts
export const MAX_MESSAGES = 200;
export const MAX_CONTENT_LENGTH = 500;
export const RATE_LIMIT_MS = 500;
export const DEBOUNCE_MS = 500;
export const CACHE_EXPIRY_DAYS = 7;
export const STORAGE_PREFIX = "flowspace-chat-";
export const DEFAULT_NICKNAME = "Unknown";
export const RECONNECTION_ATTEMPTS = 30;
export const RECONNECTION_DELAY = 500;
export const RECONNECTION_DELAY_MAX = 5000;
export const RECONNECTION_TIMEOUT = 20000;
export const MOVE_THROTTLE_MS = 100;
export type ChatFontSize = "small" | "medium" | "large";
export const FONT_SIZE_PX: Record<ChatFontSize, number>;
export const CHAT_FONT_SIZE_ORDER: ChatFontSize[];
export const FONT_SIZE_STORAGE_KEY = "flowspace-chat-fontSize";
export const ADMIN_COMMAND_ALIASES: Record<string, string>; // 7쌍 한/영
```

#### Task 1.2: chat-types.ts 확장
**파일:** `src/features/space/chat/internal/chat-types.ts`
- `AdminCommandType` 확장: `"ban" | "help" | "proximity"` 추가
- 새 타입: `SpaceRole`, `ChatRestriction`, `ParsedEditorCommand`, `MemberUnmutedData`, `MemberKickedData`, `RoleChangedData`, `SocketError`, `PartyZoneInfo`, `WhisperDirection`
- `ParsedInput.type`에 `"editor_command"` 추가, `editorParams` 필드

### Phase 2: 파서 업그레이드

#### Task 2.1: chat-parser.ts 재작성
**파일:** `src/features/space/chat/internal/chat-parser.ts`
- 파싱 우선순위: 에디터(@+config) → 관리자(@) → 귓속말(/) → 일반
- 한/영 관리자 별칭: `ADMIN_COMMAND_ALIASES` 맵 조회
- 에디터 명령어: `EditorCommandConfig` 옵션 주입 방식 (모듈 경계 유지)
- 헬퍼: `isWhisperFormat()`, `extractTargetNickname()`, `isEditorCommandFormat()`, `getEditorCommandSuggestions()`, `getAdminCommandSuggestions()`

#### Task 2.2: command-hints.ts (NEW)
**파일:** `src/features/space/chat/internal/command-hints.ts`
- `generateHelpText(isAdmin)`: 전체 명령어 도움말 텍스트
- `getNextRotatingHint()`: 5개 힌트 순환
- `getWelcomeMessage(nickname)`: 입장 메시지

### Phase 3: 필터 업그레이드

#### Task 3.1-3.4: chat-filter.ts
**파일:** `src/features/space/chat/internal/chat-filter.ts`

```ts
// URL 정규식: http(s) + www. + 도메인 전용
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+/gi;

export function ensureProtocol(url: string): string;
export function isLinkMessage(message: ChatMessage): boolean; // 시스템/공지 제외
export function calculateUnreadCounts(...); // 크로스탭 귓속말 읽음 처리
export function parseContentWithUrls(content: string): ContentPart[]; // 50자 말줄임
export function getWhisperDirection(message, userId): WhisperDirection;
```

### Phase 4: 소켓 회복력

#### Task 4.1: socket-client.ts
```ts
socket = io(SOCKET_URL, {
  reconnectionAttempts: 30,    // RECONNECTION_ATTEMPTS
  reconnectionDelay: 500,      // RECONNECTION_DELAY
  reconnectionDelayMax: 5000,  // RECONNECTION_DELAY_MAX
  timeout: 20000,              // RECONNECTION_TIMEOUT
});
```

#### Task 4.2-4.3: use-socket.ts
- `reconnect_attempt/reconnect/reconnect_error/reconnect_failed` 이벤트 → `socketError` 상태
- 재연결 시 자동 `join:space` 재발송
- `beforeunload`: `leave:space + disconnect`
- `pagehide`: 모바일 Safari 대응
- `visibilitychange`: 로깅만

#### Task 4.4: ServerToClientEvents 확장
```ts
"chat:error": (data: { code: string; message: string }) => void;
"whisper:error": (data: { code: string; message: string }) => void;
"party:error": (data: { code: string; message: string }) => void;
"admin:error": (data: { code: string; message: string }) => void;
"whisper:messageIdUpdate": (data: { tempId: string; realId: string }) => void;
"whisper:messageFailed": (data: { tempId: string; error: string }) => void;
```

### Phase 5: UI 강화

#### Task 5.1: ChatInputArea
- `↑↓` 키로 이전 귓속말 대상 탐색 (`/` 시작 시)
- 탭별 `focus:ring` 색상: all=blue, whisper=purple, party=green
- 답장 미리보기 30자 제한

#### Task 5.2: ChatTabs
- `A-/A+` 버튼 → `CHAT_FONT_SIZE_ORDER` 순환 (small/medium/large)

#### Task 5.3: ChatMessageList
- `playersMap` prop → `resolveNickname()` SSOT 실시간 해석
- `fontSize` prop → `FONT_SIZE_PX[fontSize]` inline style
- `parseContentWithUrls()` → URL `<a>` 태그 렌더링

#### Task 5.4: ChatPanel
- `fontSize` lazy init from localStorage
- `whisperHistory`: 메시지 역순 탐색 → 중복 제거 닉네임 목록
- `playersMap`: players[] → Map 변환
- `socketError` → 빨간 배너

### Phase 6: 서버 정비

#### Task 6.1: 에러 이벤트 세분화
| 기존 | 변경 |
|------|------|
| `socket.emit("error", ...)` (chat:send) | `socket.emit("chat:error", { code, message })` |
| `socket.emit("error", ...)` (whisper:send) | `socket.emit("whisper:error", { code, message })` |
| `socket.emit("error", ...)` (admin:*) | `socket.emit("admin:error", { code, message })` |
| `socket.emit("error", ...)` (party:message) | `socket.emit("party:error", { code, message })` |

## 변경된 파일
| 파일 | 변경 유형 | Phase |
|------|-----------|-------|
| `chat/internal/chat-constants.ts` | **NEW** | 1 |
| `chat/internal/chat-types.ts` | MOD (74→120줄) | 1 |
| `chat/index.ts` | MOD (19→45줄) | 1 |
| `chat/internal/chat-parser.ts` | MOD (93→200줄) | 2 |
| `chat/internal/command-hints.ts` | **NEW** | 2 |
| `chat/internal/use-chat.ts` | MOD | 2 |
| `chat/internal/use-chat-storage.ts` | MOD (상수 import) | 1 |
| `chat/internal/chat-filter.ts` | MOD (100→130줄) | 3 |
| `socket/internal/types.ts` | MOD (+6 이벤트) | 4 |
| `socket/internal/socket-client.ts` | MOD (재연결 상수) | 4 |
| `socket/internal/use-socket.ts` | MOD (+재연결+가시성) | 4 |
| `bridge/internal/use-socket-bridge.ts` | MOD (+socketError) | 4 |
| `components/space/chat/chat-input-area.tsx` | MOD (96→140줄) | 5 |
| `components/space/chat/chat-tabs.tsx` | MOD (82→125줄) | 5 |
| `components/space/chat/chat-message-list.tsx` | MOD (197→235줄) | 5 |
| `components/space/chat-panel.tsx` | MOD (101→140줄) | 5 |
| `app/space/[id]/space-client.tsx` | MOD (+players, socketError) | 5 |
| `server/handlers/chat.ts` | MOD (에러 세분화, 상수) | 6 |
| `server/handlers/party.ts` | MOD (에러 세분화, 상수) | 6 |

## 검증
- `tsc --noEmit` ✅
- `next lint` ✅
