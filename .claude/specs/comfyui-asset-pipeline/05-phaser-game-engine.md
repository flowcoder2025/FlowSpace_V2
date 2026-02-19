# Phase 5: Phaser Game Engine

> Epic: [ComfyUI Asset Pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
Phaser 3 게임 엔진을 통합하여 2D 메타버스 공간을 구현. flow_metaverse의 MainScene.ts(1661줄)를 모듈화하여 포팅.

## Task 목록
- [x] Task 5.1: Phaser 초기화 (4파일)
- [x] Task 5.2: MainScene + Tilemap (5파일)
- [x] Task 5.3: 아바타 시스템 + 이동 (6파일)
- [x] Task 5.4: 원격 플레이어 + Socket 브릿지 (4파일)
- [x] Task 5.5: 충돌 시스템 (기존 파일에 통합)
- [x] Task 5.6: 카메라 팔로우 (1파일)
- [x] Task 5.7: 오브젝트 상호작용 (2파일)
- [x] Task 5.8: 공간 진입 페이지 (6파일 + 1 수정)

## 구현 상세

### Task 5.1: Phaser 초기화

**`src/constants/game-constants.ts`** - 게임 상수
```typescript
export const TILE_SIZE = 32;
export const MAP_COLS = 40;
export const MAP_ROWS = 30;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;  // 1280
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE; // 960
export const PLAYER_SPEED = 160;
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 32;
export const DIAGONAL_FACTOR = 0.707;
export const DEPTH = { GROUND: 0, WALLS: 10, FURNITURE: 20, ... UI: 50 };
export const SCENE_KEYS = { BOOT: "BootScene", MAIN: "MainScene" };
```

**`game/internal/phaser-config.ts`** - GameConfig 팩토리
```typescript
export function createPhaserConfig(options: PhaserConfigOptions): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    pixelArt: true,
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // ...
  };
}
```

**`game/internal/game-manager.ts`** - Phaser.Game 라이프사이클
```typescript
export async function createGame(parent: HTMLElement, options: GameOptions): Promise<Phaser.Game> {
  const Phaser = await import("phaser"); // SSR 회피
  const { BootScene } = await import("./scenes/boot-scene");
  const { MainScene } = await import("./scenes/main-scene");
  // registry.set()으로 씬에 옵션 전달
  gameInstance.registry.set("spaceId", options.spaceId);
  // ...
}
export function destroyGame(): void { ... }
```

**`stores/game-store.ts`** - Zustand 게임 상태
```typescript
interface GameStore {
  isLoading: boolean;
  isSceneReady: boolean;
  loadingProgress: number;
  error: string | null;
  // setters + reset
}
```

### Task 5.2: MainScene + Tilemap

**`tilemap/tileset-generator.ts`** - Canvas API 프로시저럴 타일셋 (512x448)
- 10행의 타일 정의 (Ground, Walls, Furniture, FurnitureTop, Decorations, Interactive)
- `generateTileset(scene)` → `textures.addCanvas(TILESET_KEY, canvas)`
- `TILE_INDEX` 상수로 타일 번호 참조

**`tilemap/map-data.ts`** - 40x30 그리드 6개 레이어
```typescript
export const LAYER_NAMES = {
  GROUND: "ground", WALLS: "walls", FURNITURE: "furniture",
  FURNITURE_TOP: "furniture_top", DECORATIONS: "decorations", COLLISION: "collision"
};
export function createMapLayers(): MapLayerDefinition[] { ... }
```
- 건물 (8,5 ~ 32,25), 입구 (18-21, 25), 내부 파티션, 외부 정원

**`tilemap/tilemap-system.ts`** - Tilemap 생성 + 충돌 설정
```typescript
export function createTilemapSystem(scene: Phaser.Scene): TilemapResult {
  generateTileset(scene);
  const tilemap = scene.make.tilemap({ ... });
  // 레이어 생성 + setCollisionByExclusion([-1])
  return { tilemap, layers, collisionLayers };
}
```

**`scenes/boot-scene.ts`** - 프리로드 + 로딩바 + API 에셋 로드
**`scenes/main-scene.ts`** - 씬 오케스트레이터
```typescript
export class MainScene extends Phaser.Scene {
  create(): void {
    this.initWorld();     // physics.world.setBounds
    this.initTilemap();   // createTilemapSystem
    this.initPlayer();    // LocalPlayer + InputController
    this.initRemotePlayers(); // RemotePlayerManager
    this.initCamera();    // CameraController
    this.initObjects();   // ObjectManager
    this.initCollisions(); // physics.add.collider
    this.notifyReady();   // SCENE_READY emit
  }
  update(): void {
    input → localPlayer.update → remotePlayerManager.update → objectManager.checkProximity
  }
}
```

### Task 5.3: 아바타 시스템 + 이동

**`avatar/internal/avatar-types.ts`** - ClassicAvatarConfig, CustomAvatarConfig 타입
- DIRECTION_FRAMES: down(0-3), left(4-7), right(8-11), up(12-15)

**`avatar/internal/avatar-config.ts`** - 8색 팔레트, parseAvatarString()
- 형식: `"classic:skin,hair,shirt,pants"` 또는 `"custom:textureKey"` 또는 userId 해시

**`avatar/internal/sprite-generator.ts`** - Canvas 프로시저럴 캐릭터 (4x4 grid, 24x32)
```typescript
export function generateAvatarSprite(scene: Phaser.Scene, config: ClassicAvatarConfig): string {
  // 4행(방향) x 4열(프레임) 스프라이트시트 생성
  scene.textures.addSpriteSheet(key, canvas, { frameWidth: 24, frameHeight: 32 });
  return key;
}
```

**`player/input-controller.ts`** - WASD/Arrow 입력
- 대각선 0.707 정규화
- CHAT_FOCUS 이벤트 수신 시 입력 비활성

**`player/local-player.ts`** - Physics.Arcade.Sprite 기반
- 걷기 애니메이션 (8fps, 4프레임)
- PLAYER_MOVED 이벤트 발행 (100ms 쓰로틀)

### Task 5.4: 원격 플레이어 + Socket 브릿지

**`remote/remote-player-sprite.ts`** - Tween 보간 이동 (150ms)
**`remote/remote-player-manager.ts`** - Map<userId> + pending 큐

**데이터 플로우:**
```
Phaser PLAYER_MOVED → EventBridge → useSocketBridge → sock.emit("move")
sock.on("player:moved") → useSocketBridge → EventBridge REMOTE_PLAYER_MOVED → RemotePlayerManager
```

**`bridge/internal/use-socket-bridge.ts`**
- useSocket 훅 래핑
- players 배열 diff → REMOTE_PLAYER_JOINED / MOVED / LEFT 이벤트 발행

### Task 5.5: 충돌 시스템
- `tilemap-system.ts`: walls, furniture, collision 레이어에 `setCollisionByExclusion([-1])`
- `main-scene.ts`: `physics.add.collider(player.sprite, collisionLayers)` 루프

### Task 5.6: 카메라 팔로우
- `camera-controller.ts`: setBounds, startFollow(0.1 lerp), setDeadzone(100, 80)

### Task 5.7: 오브젝트 상호작용
- `interactive-object.ts`: 타입별 색상, 글로우 Tween, [E] 인디케이터
- `object-manager.ts`: 근접 체크(48px), [E] 키 → OBJECT_INTERACT emit

### Task 5.8: 공간 진입 페이지
- `page.tsx` (Server): auth + space fetch + redirect
- `space-client.tsx` (Client): Bridge + Canvas + HUD 오케스트레이터
- `game-canvas.tsx`: useRef + dynamic import createGame
- `loading-screen.tsx`: 공간명 + 프로그레스바
- `player-list.tsx`: 접속자 목록 토글 패널
- `space-hud.tsx`: 공간명, 연결상태, 온라인 수
- `game/index.ts`: createGame, destroyGame export 추가

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/constants/game-constants.ts` | 추가 | 타일/맵/플레이어/깊이 상수 |
| `src/features/space/game/internal/phaser-config.ts` | 추가 | GameConfig 팩토리 |
| `src/features/space/game/internal/game-manager.ts` | 추가 | Phaser.Game 라이프사이클 |
| `src/stores/game-store.ts` | 추가 | 게임 상태 Zustand |
| `src/features/space/game/internal/tilemap/tileset-generator.ts` | 추가 | 프로시저럴 타일셋 |
| `src/features/space/game/internal/tilemap/map-data.ts` | 추가 | 40x30 레이어 데이터 |
| `src/features/space/game/internal/tilemap/tilemap-system.ts` | 추가 | Tilemap + 충돌 |
| `src/features/space/game/internal/scenes/boot-scene.ts` | 추가 | 에셋 프리로드 |
| `src/features/space/game/internal/scenes/main-scene.ts` | 추가 | 씬 오케스트레이터 |
| `src/features/space/avatar/internal/avatar-types.ts` | 추가 | 아바타 타입 |
| `src/features/space/avatar/internal/avatar-config.ts` | 추가 | 아바타 설정/파싱 |
| `src/features/space/avatar/internal/sprite-generator.ts` | 추가 | 프로시저럴 스프라이트 |
| `src/features/space/avatar/index.ts` | 추가 | Avatar Public API |
| `src/features/space/game/internal/player/input-controller.ts` | 추가 | WASD/Arrow 입력 |
| `src/features/space/game/internal/player/local-player.ts` | 추가 | 로컬 플레이어 |
| `src/features/space/game/internal/remote/remote-player-sprite.ts` | 추가 | 원격 플레이어 렌더링 |
| `src/features/space/game/internal/remote/remote-player-manager.ts` | 추가 | 원격 플레이어 관리 |
| `src/features/space/bridge/internal/use-socket-bridge.ts` | 추가 | Socket↔EventBridge 브릿지 |
| `src/features/space/bridge/index.ts` | 추가 | Bridge Public API |
| `src/features/space/game/internal/camera/camera-controller.ts` | 추가 | 카메라 팔로우 |
| `src/features/space/game/internal/objects/interactive-object.ts` | 추가 | 인터랙티브 오브젝트 |
| `src/features/space/game/internal/objects/object-manager.ts` | 추가 | 오브젝트 관리 |
| `src/app/space/[id]/page.tsx` | 추가 | Server 공간 페이지 |
| `src/app/space/[id]/space-client.tsx` | 추가 | Client 오케스트레이터 |
| `src/components/space/game-canvas.tsx` | 추가 | Phaser 캔버스 마운트 |
| `src/components/space/loading-screen.tsx` | 추가 | 로딩 오버레이 |
| `src/components/space/player-list.tsx` | 추가 | 접속자 목록 |
| `src/components/space/space-hud.tsx` | 추가 | HUD |
| `src/features/space/game/index.ts` | 수정 | createGame, destroyGame export 추가 |

## 컨트랙트 준수 사항
- EventBridge만 사용 (React ↔ Phaser 직접 호출 금지) ✅
- DB 접근 금지 (API/EventBridge로만 데이터 수신) ✅
- Published: PLAYER_MOVED, OBJECT_INTERACT, SCENE_READY, ASSET_LOAD_ERROR ✅
- Consumed: REMOTE_PLAYER_MOVED/JOINED/LEFT, CHAT_FOCUS ✅
- 모듈 구조: index.ts(Public) + internal/(Private) ✅
- 32px 타일 고정 ✅

## 검증 결과
- `tsc --noEmit` ✅ (0 errors)
- `next lint` ✅ (0 warnings, 0 errors)
- `npm run build` ✅ (28 routes, /space/[id] = 17.1kB)
