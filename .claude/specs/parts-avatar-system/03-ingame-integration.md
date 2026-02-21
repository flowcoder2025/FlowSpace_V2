# Phase 3: In-game Integration

> Epic: [파츠 조합 캐릭터 시스템](./README.md)
> 상태: ✅ 완료 | 업데이트: 2026-02-21

## 목표
런타임 아바타 스왑 + 소켓 브로드캐스트 + 인게임 에디터 모달

## Task 목록
- [x] Task 3.1: 런타임 아바타 스왑 (updateAvatar 메서드)
- [x] Task 3.2: 소켓 아바타 업데이트 브로드캐스트
- [x] Task 3.3: 인게임 아바타 에디터 모달

## 구현 상세

### Task 3.1: 런타임 스왑
**파일:** `local-player.ts`, `remote-player-sprite.ts`
- `updateAvatar(avatarString)` — 기존 texture/animation 정리 → 새 texture 생성 → animation 재등록
- `parseAvatarString()` + `generateAvatarSpriteFromConfig()` 재사용

### Task 3.2: 소켓 브로드캐스트
**이벤트 체인:** Client `avatar:update` → Server `player:avatar-updated` → EventBridge → Phaser
- `use-socket.ts` — sendAvatarUpdate + avatar-updated 리스너
- `use-socket-bridge.ts` — avatar diff 감지 + REMOTE_PLAYER_AVATAR_UPDATED emit
- `remote-player-manager.ts` — avatarUpdated pending event 처리
- `server/handlers/avatar.ts` — spacePlayersMap 업데이트 + 브로드캐스트

### Task 3.3: 인게임 에디터 모달
**파일:** `avatar-editor-modal.tsx`, `space-client.tsx`
- AvatarEditorModal: CharacterEditor + PATCH `/api/users/me` + onSave
- space-client: "Edit Avatar" HUD 버튼 + 모달 toggle
- 저장 시: sendAvatarUpdate(소켓) + eventBridge.emit(PLAYER_AVATAR_UPDATED)

## 변경된 파일
| 파일 | 유형 | 설명 |
|------|------|------|
| `src/features/space/game/internal/player/local-player.ts` | 수정 | updateAvatar() |
| `src/features/space/game/internal/remote/remote-player-sprite.ts` | 수정 | updateAvatar() |
| `src/features/space/game/internal/remote/remote-player-manager.ts` | 수정 | avatarUpdated |
| `src/features/space/game/internal/scenes/main-scene.ts` | 수정 | PLAYER_AVATAR_UPDATED |
| `src/features/space/game/events/types.ts` | 수정 | 2 이벤트 추가 |
| `src/features/space/socket/internal/types.ts` | 수정 | 소켓 이벤트 타입 |
| `src/features/space/socket/internal/use-socket.ts` | 수정 | sendAvatarUpdate |
| `src/features/space/bridge/internal/use-socket-bridge.ts` | 수정 | avatar diff |
| `server/handlers/avatar.ts` | 추가 | 서버 핸들러 |
| `server/index.ts` | 수정 | handleAvatar 등록 |
| `src/components/space/avatar-editor-modal.tsx` | 추가 | 에디터 모달 |
| `src/app/space/[id]/space-client.tsx` | 수정 | HUD + 모달 |
