# Phase 8: 맵 에디터

> Epic: [Map Editor](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
공간 소유자/스태프가 브라우저 내에서 타일 페인팅, 오브젝트 배치/이동/삭제, 포탈 연결을 수행할 수 있는 맵 에디터 구현.

## Task 목록
- [x] Task 8.1: Prisma 스키마 변경 + API 기반
- [x] Task 8.2: 에디터 타입, 스토어, EventBridge 이벤트
- [x] Task 8.3: DB에서 맵 데이터 로딩
- [x] Task 8.4: Phaser 에디터 코어 (EditorSystem)
- [x] Task 8.5: useEditor 훅 + 타일 페인팅 파이프라인
- [x] Task 8.6: 오브젝트 배치 + CRUD
- [x] Task 8.7: 에디터 UI 컴포넌트
- [x] Task 8.8: 실시간 동기화 (Socket)
- [x] Task 8.9: 포탈 링킹

## 구현 상세

### Task 8.1: Prisma 스키마 변경 + API

**스키마 변경:**
```prisma
model Space {
  // ... 기존 필드
  mapData Json?  // 추가
}

model MapObject {
  id         String   @id @default(cuid())
  spaceId    String
  assetId    String?           // optional로 변경
  objectType String            // 추가 (portal, spawn_point, sign 등)
  label      String?           // 추가
  positionX  Float             // Int → Float
  positionY  Float             // Int → Float
  rotation   Int     @default(0)
  width      Int     @default(1)  // 추가
  height     Int     @default(1)  // 추가
  isActive   Boolean @default(true) // 추가
  // ... 나머지 기존 필드
}
```

**API 엔드포인트:**
| Method | Path | 역할 |
|--------|------|------|
| GET | `/api/spaces/[id]/map` | 맵 데이터 + 오브젝트 일괄 조회 |
| PUT | `/api/spaces/[id]/map/tiles` | 타일 레이어 전체 저장 |
| POST | `/api/spaces/[id]/map/objects` | 오브젝트 배치 |
| PATCH | `/api/spaces/[id]/map/objects/[objectId]` | 오브젝트 수정 |
| DELETE | `/api/spaces/[id]/map/objects/[objectId]` | 오브젝트 삭제 |
| POST | `/api/spaces/[id]/map/objects/[objectId]/link` | 포탈 쌍 연결 |

### Task 8.2: 에디터 타입, 스토어, EventBridge

**핵심 타입:**
```typescript
type EditorTool = "paint" | "erase" | "select" | "object-place";
type EditorLayerName = "ground" | "walls" | "furniture" | "furniture_top" | "decorations" | "collision";

interface StoredMapData {
  version: 1;
  layers: Record<string, number[][]>;
}
```

**Zustand editor-store:** 에디터 모드 상태, 활성 도구/레이어, 타일 데이터, 맵 오브젝트, 저장 상태 관리.

**EventBridge 이벤트 13개 추가:** EDITOR_ENTER/EXIT, TOOL_CHANGE, TILE_SELECT/PAINTED/PAINT_REQUEST, LAYER_SELECT/VISIBILITY, OBJECT_PLACED/MOVED/DELETED/SELECTED, MAP_LOADED

### Task 8.3: DB에서 맵 데이터 로딩

- `map-data.ts`: `createEmptyLayer()` export, `createMapLayersFromStored()` 추가
- `tilemap-system.ts`: `externalLayers?` 파라미터 추가
- `main-scene.ts`: registry에서 mapData 읽어 tilemap에 전달
- `game-manager.ts`: `GameOptions.mapData` 추가
- `space-client.tsx`: `/api/spaces/[id]/map` fetch → GameCanvas에 전달

### Task 8.4: Phaser 에디터 코어

- **EditorSystem**: 진입/퇴출, 클릭→타일 페인트, 오브젝트 배치, 자유 카메라 (WASD)
- **GridOverlay**: 40x30 그리드 라인 (흰색 15% 투명도)
- **EditorCursor**: 마우스 위치 타일 하이라이트 (녹색 테두리 + 좌표 표시)
- **InputController**: `editorMode` 플래그 → true일 때 플레이어 이동 비활성화
- **CameraController**: EDITOR_EXIT 시 플레이어 팔로우 복원

### Task 8.5: useEditor 훅

맵 데이터 로드/저장, EventBridge 이벤트 수신, 도구/레이어/타일 선택 → Phaser 전달, PUT /api/spaces/[id]/map/tiles 저장.

### Task 8.6: 오브젝트 배치 + CRUD

- `object-manager.ts`: EDITOR_MAP_LOADED/OBJECT_PLACED/MOVED/DELETED 이벤트 핸들러
- `useEditor`: placeObject/moveObject/deleteObject (API + optimistic)

### Task 8.7: 에디터 UI 컴포넌트

```
SpaceClient
├── SpaceHud (editorSlot → EditorToggleButton)
├── EditorSidebar (에디터 모드일 때만)
│   ├── ToolBar (paint/erase/select/object-place)
│   ├── LayerSelector (6 레이어 + 가시성 토글)
│   ├── TilePalette / ObjectPalette (탭 전환)
│   ├── PropertyPanel (오브젝트 선택 시)
│   └── SaveButton
```

### Task 8.8: 실시간 동기화

**소켓 이벤트:**
| C2S | S2C | 용도 |
|-----|-----|------|
| `editor:tile-update` | `editor:tile-updated` | 타일 변경 브로드캐스트 |
| `editor:object-place` | `editor:object-placed` | 오브젝트 배치 |
| `editor:object-move` | `editor:object-moved` | 오브젝트 이동 |
| `editor:object-delete` | `editor:object-deleted` | 오브젝트 삭제 |

### Task 8.9: 포탈 링킹

- PropertyPanel에 "Link Portal" 버튼
- `useEditor.linkPortal()` → POST /link API

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `prisma/schema.prisma` | 수정 | Space.mapData, MapObject 확장 |
| `src/constants/game-constants.ts` | 수정 | DEPTH.EDITOR_GRID/CURSOR |
| `src/features/space/game/events/types.ts` | 수정 | EDITOR_* 이벤트 13개 + 페이로드 |
| `src/features/space/game/events/index.ts` | 수정 | re-export |
| `src/features/space/game/internal/tilemap/map-data.ts` | 수정 | createMapLayersFromStored, extractDefaultMapData |
| `src/features/space/game/internal/tilemap/tilemap-system.ts` | 수정 | externalLayers 파라미터 |
| `src/features/space/game/internal/scenes/main-scene.ts` | 수정 | EditorSystem 통합 |
| `src/features/space/game/internal/game-manager.ts` | 수정 | mapData 옵션 |
| `src/features/space/game/internal/objects/object-manager.ts` | 수정 | 동적 오브젝트 CRUD |
| `src/features/space/game/internal/player/input-controller.ts` | 수정 | editorMode 플래그 |
| `src/features/space/game/internal/camera/camera-controller.ts` | 수정 | 에디터 복원 + destroy |
| `src/components/space/game-canvas.tsx` | 수정 | mapData prop |
| `src/components/space/space-hud.tsx` | 수정 | editorSlot |
| `src/app/space/[id]/space-client.tsx` | 수정 | 에디터 통합 |
| `src/features/space/socket/internal/types.ts` | 수정 | 에디터 소켓 이벤트 |
| `src/features/space/socket/internal/use-socket.ts` | 수정 | 에디터 이벤트 처리 |
| `src/features/space/bridge/internal/use-socket-bridge.ts` | 수정 | 에디터 브릿지 |
| `server/index.ts` | 수정 | handleEditor 등록 |
| `src/app/api/spaces/[id]/map/route.ts` | 추가 | GET 맵 조회 |
| `src/app/api/spaces/[id]/map/tiles/route.ts` | 추가 | PUT 타일 저장 |
| `src/app/api/spaces/[id]/map/objects/route.ts` | 추가 | POST 오브젝트 배치 |
| `src/app/api/spaces/[id]/map/objects/[objectId]/route.ts` | 추가 | PATCH/DELETE 오브젝트 |
| `src/app/api/spaces/[id]/map/objects/[objectId]/link/route.ts` | 추가 | POST 포탈 연결 |
| `src/features/space/editor/index.ts` | 추가 | Public API |
| `src/features/space/editor/internal/types.ts` | 추가 | 에디터 타입 |
| `src/features/space/editor/internal/tile-palette-data.ts` | 추가 | 타일 팔레트 |
| `src/features/space/editor/internal/object-palette-data.ts` | 추가 | 오브젝트 팔레트 |
| `src/features/space/editor/internal/use-editor.ts` | 추가 | useEditor 훅 |
| `src/features/space/editor/internal/editor-system.ts` | 추가 | EditorSystem |
| `src/features/space/editor/internal/grid-overlay.ts` | 추가 | GridOverlay |
| `src/features/space/editor/internal/editor-cursor.ts` | 추가 | EditorCursor |
| `src/stores/editor-store.ts` | 추가 | Zustand 에디터 스토어 |
| `src/components/space/editor/index.ts` | 추가 | UI export |
| `src/components/space/editor/editor-toggle-button.tsx` | 추가 | 에디터 토글 버튼 |
| `src/components/space/editor/editor-sidebar.tsx` | 추가 | 에디터 사이드바 |
| `src/components/space/editor/tile-palette.tsx` | 추가 | 타일 팔레트 UI |
| `src/components/space/editor/object-palette.tsx` | 추가 | 오브젝트 팔레트 UI |
| `src/components/space/editor/layer-selector.tsx` | 추가 | 레이어 선택기 |
| `src/components/space/editor/tool-bar.tsx` | 추가 | 도구 바 |
| `src/components/space/editor/property-panel.tsx` | 추가 | 속성 패널 |
| `server/handlers/editor.ts` | 추가 | 소켓 에디터 핸들러 |

## 검증
- `tsc --noEmit` ✅
- `npx next lint` ✅
- `npx next build` ⚠️ (prisma generate 후 확인 필요)
