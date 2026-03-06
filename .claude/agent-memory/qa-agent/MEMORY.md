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

### [Medium] LocalPlayer.destroy() 리소스 누수 (2026-03-05, 첫 발생)
- `src/features/space/game/internal/player/local-player.ts:220`
- `destroy()`가 `this.shadow`만 정리. `this.sprite`와 `this.nameText`는 destroy() 누락

### [Low] tryCreateAnim 로직 결함 (2026-03-05, 첫 발생)
- `src/features/space/game/internal/remote/remote-player-sprite.ts:201`
- `tryCreateAnim()`이 `scene.anims.exists()` 체크만 하고 실제로 애니메이션을 생성하지 않음
- 조건 `exists(key) || tryCreateAnim(key)`는 항상 `exists(key)` 와 동일 — fallback 의도 미달성

### Notes
- TypeScript strict mode on. No Bash available — cannot run tsc/lint directly.
- Phaser SSR: game-manager.ts uses dynamic `await import("phaser")` — PASS
- Security: API routes use session.user.id for auth — PASS
- constants.ts에 하드코딩된 파일명 (`yuugiri-lyco-nochekaiser.safetensors`) — internal only, not exposed
- PLAYER_SPEED (game-constants.ts:13): 그리드 이동 전환 후 미사용 — 정리 대상
- COLLISION_LAYER_NAMES: tilemap-system.ts가 re-export하므로 main-scene.ts는 map-data 직접 import 대신 tilemap-system import 권장 (intra-module이므로 High 아님)
