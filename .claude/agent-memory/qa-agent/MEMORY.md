# QAGuard Memory

## Recurring Issues

### [High] internal/ 직접 import (pre-existing, 미해결)
- `src/components/assets/asset-detail-modal.tsx:7` — `@/features/assets/internal/game-loader`
  - loadAssetToPhaser는 index.ts에서 re-export되므로 barrel import로 교체 가능
- `src/app/api/comfyui/capabilities/route.ts:3` — `@/features/assets/internal/capability-checker`
  - checkComfyUICapabilities는 index.ts에서 re-export되므로 barrel import로 교체 가능
- `src/stores/editor-store.ts:8` — `@/features/space/editor/internal/types`
- `src/features/space/socket/internal/use-socket.ts:12` — `@/features/space/chat/internal/chat-constants`
- `src/features/space/socket/internal/socket-client.ts:8` — `@/features/space/chat/internal/chat-constants`
- `src/features/space/editor/internal/use-editor.ts:13` — `@/features/space/game/internal/tilemap/map-data`
- `src/features/space/editor/internal/editor-system.ts:17` — `@/features/space/game/internal/tilemap/tilemap-system`
- `src/features/space/editor/internal/tile-palette-data.ts:3` — `@/features/space/game/internal/tileset-generator`
- `src/features/space/game/internal/scenes/main-scene.ts:16` — `@/features/space/editor/internal/editor-system`

### [Medium] LocalPlayer.destroy() 리소스 누수 (2026-03-05, 해결됨 2026-03-06)
- `src/features/space/game/internal/player/local-player.ts`
- 해결: destroy()에 sprite.destroy(), nameText.destroy(), shadow.destroy() 모두 포함됨

### [Low] tryCreateAnim 로직 결함 (2026-03-05, 첫 발생)
- `src/features/space/game/internal/remote/remote-player-sprite.ts:201`
- `tryCreateAnim()`이 `scene.anims.exists()` 체크만 하고 실제로 애니메이션을 생성하지 않음
- 조건 `exists(key) || tryCreateAnim(key)`는 항상 `exists(key)` 와 동일 — fallback 의도 미달성

### [Medium] 하드코딩 픽셀 수치 — avatar-editor-modal.tsx (2026-03-06, 첫 발생)
- `src/components/space/avatar-editor-modal.tsx:165-166` — `const fw = 96; const fh = 128;`
- PLAYER_WIDTH/PLAYER_HEIGHT가 game-constants.ts에 정의됨에도 직접 숫자 삽입
- 해결: @/features/space/avatar barrel에 PLAYER_WIDTH/PLAYER_HEIGHT re-export 추가 또는 공용 상수 분리

### [Medium] AbortController 비기능적 타임아웃 (2026-03-09, 첫 발생)
- `src/app/api/livekit/token/route.ts:52-61`
- `AbortController.abort()`를 `listParticipants`에 전달하지 않아 실제 취소 불가
- 코드 주석에 인식됨. `Promise.race` 패턴으로 교체 필요

### [Low] 존재하지 않는 ESLint 규칙 비활성화 (2026-03-09, 첫 발생)
- `src/features/space/livekit/internal/LiveKitMediaContext.tsx:577,609`
- `react-hooks/refs`는 존재하지 않는 규칙 — 주석 제거 또는 실제 규칙명으로 교체

### [Critical] accessType 미체크 자동 멤버십 생성 (2026-04-10, 해결됨 2026-04-10)
- `src/app/space/[id]/page.tsx` — accessType === "PUBLIC" 조건 추가, PRIVATE/PASSWORD는 `/my-spaces` redirect
- isOwner 체크를 `space.ownerId === session.user.id`로 변경 (별도 DB 쿼리 제거)
- tsc PASS, lint PASS, 보안 PASS 확인됨

### Notes
- TypeScript strict mode on. No Bash available — cannot run tsc/lint directly.
- Phaser SSR: game-manager.ts uses dynamic `await import("phaser")` — PASS
- Security: API routes use session.user.id for auth — PASS
- constants.ts에 하드코딩된 파일명 (`yuugiri-lyco-nochekaiser.safetensors`) — internal only, not exposed
- PLAYER_SPEED (game-constants.ts:13): 그리드 이동 전환 후 미사용 — 정리 대상
- COLLISION_LAYER_NAMES: tilemap-system.ts가 re-export하므로 main-scene.ts는 map-data 직접 import 대신 tilemap-system import 권장 (intra-module이므로 High 아님)
- chibi-characters.ts: index.ts에서 정상 re-export, 모든 외부 파일이 barrel 경유 확인됨 (2026-03-06)
- connectionError 흐름 (LiveKitRoomProvider → LiveKitMediaContext → SpaceMediaLayer) 검증 완료 (2026-03-09)
- src/app/space/[id]/page.tsx: Server Component에서 Prisma 직접 사용은 기존 dashboard 패턴과 동일 (pre-existing)
- 멤버십 자동 생성 로직: space.findUnique에 ownerId/accessType 포함하여 쿼리 1회로 통합됨 (해결 2026-04-10)
