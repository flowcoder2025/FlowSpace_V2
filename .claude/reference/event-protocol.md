# Event Protocol

두 가지 이벤트 채널이 존재하며, 모든 페이로드는 TypeScript 인터페이스로 정의됨.

## 1. EventBridge (React ↔ Phaser)

> 소스: `src/features/space/game/events/types.ts` (33개 이벤트)

### Player
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| PLAYER_MOVED | `player:moved` | Phaser → React | `PlayerPosition { id, x, y, direction, isMoving }` |
| PLAYER_JOINED | `player:joined` | Phaser → React | `PlayerPosition` |
| PLAYER_LEFT | `player:left` | Phaser → React | `PlayerPosition` |
| PLAYER_JUMPED | `player:jumped` | Phaser → React | `PlayerPosition` |

### Remote Player
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| REMOTE_PLAYER_MOVED | `remote:player:moved` | React → Phaser | `RemotePlayerData { userId, x, y, direction, nickname?, avatar? }` |
| REMOTE_PLAYER_JOINED | `remote:player:joined` | React → Phaser | `RemotePlayerData` |
| REMOTE_PLAYER_LEFT | `remote:player:left` | React → Phaser | `{ userId: string }` |

### Scene
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| SCENE_READY | `scene:ready` | Phaser → React | `{ sceneKey: string }` |
| SCENE_ERROR | `scene:error` | Phaser → React | `{ error: string }` |

### UI
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| CHAT_FOCUS | `chat:focus` | React → Phaser | `{ focused: boolean }` |
| UI_OVERLAY_TOGGLE | `ui:overlay:toggle` | React → Phaser | `{ visible: boolean }` |

### Asset
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| ASSET_REGISTERED | `asset:registered` | React → Phaser | `{ assetId, type, metadata }` |
| ASSET_LOAD_ERROR | `asset:load:error` | Phaser → React | `{ assetKey, error }` |
| ASSET_GENERATED | `asset:generated` | Pipeline → React | `{ assetId, type, metadata }` |
| ASSET_GENERATION_FAILED | `asset:generation:failed` | Pipeline → React | `{ error, params }` |
| ASSET_PROCESSING_PROGRESS | `asset:processing:progress` | Pipeline → React | `{ assetId, progress }` |
| GENERATE_ASSET_REQUEST | `asset:generate:request` | React → Pipeline | `{ type, prompt, params }` |

### Object
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| OBJECT_INTERACT | `object:interact` | Phaser → React | `{ objectId, type }` |
| OBJECT_PLACED | `object:placed` | Phaser → React | `{ objectId, x, y, assetKey }` |

### Party Zone
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| PARTY_ZONES_LOADED | `partyZone:loaded` | React → Phaser | `{ zones: PartyZoneData[] }` |
| PARTY_ZONE_CHANGED | `partyZone:changed` | Phaser → React | `{ currentZone: PartyZoneData \| null }` |

### Editor (13개)
| 이벤트 | 값 | 방향 | 페이로드 |
|--------|-----|------|----------|
| EDITOR_ENTER | `editor:enter` | React → Phaser | `{ enabled: boolean }` |
| EDITOR_EXIT | `editor:exit` | React → Phaser | — |
| EDITOR_TOOL_CHANGE | `editor:tool:change` | React → Phaser | `{ tool: string }` |
| EDITOR_TILE_SELECT | `editor:tile:select` | React → Phaser | `{ tileIndex: number }` |
| EDITOR_LAYER_SELECT | `editor:layer:select` | React → Phaser | `{ layer: string }` |
| EDITOR_LAYER_VISIBILITY | `editor:layer:visibility` | React → Phaser | `{ layer, visible }` |
| EDITOR_TILE_PAINTED | `editor:tile:painted` | Phaser → React | `{ layer, col, row, tileIndex }` |
| EDITOR_TILE_PAINT_REQUEST | `editor:tile:paintRequest` | React → Phaser | `{ layer, col, row, tileIndex }` |
| EDITOR_OBJECT_PLACED | `editor:object:placed` | Phaser → React | `{ id, tempId?, objectType, positionX, positionY, label?, width?, height? }` |
| EDITOR_OBJECT_MOVED | `editor:object:moved` | Phaser → React | `{ id, positionX, positionY }` |
| EDITOR_OBJECT_DELETED | `editor:object:deleted` | Phaser → React | `{ id }` |
| EDITOR_OBJECT_SELECTED | `editor:object:selected` | Phaser → React | `{ id: string \| null }` |
| EDITOR_MAP_LOADED | `editor:map:loaded` | React → Phaser | `{ layers, objects[] }` |

---

## 2. Socket.io (Client ↔ Server)

> 소스: `src/features/space/socket/internal/types.ts`

### 공통 타입
- `PlayerData { userId, nickname, avatar, position: { x, y } }`
- `MovementData { x, y, direction }`
- `SocketData { userId, name, spaceId, partyId?, partyName?, role?, restriction?, memberId? }`

### Room / Presence
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `join:space` | C→S | `{ spaceId, userId, nickname, avatar }` |
| `leave:space` | C→S | `{ spaceId }` |
| `player:joined` | S→C | `PlayerData` |
| `player:left` | S→C | `{ userId }` |
| `players:list` | S→C | `{ players: PlayerData[] }` |

### Movement
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `move` | C→S | `MovementData` |
| `player:moved` | S→C | `{ userId } & MovementData` |

### Chat
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `chat:send` | C→S | `{ content, type: group\|whisper\|party, targetId?, replyTo? }` |
| `chat:message` | S→C | `{ id?, tempId?, userId, nickname, content, type, timestamp, replyTo?, partyId?, partyName? }` |
| `chat:messageIdUpdate` | S→C | `{ tempId, realId }` |
| `chat:messageFailed` | S→C | `{ tempId, error }` |
| `chat:delete` | C→S | `{ messageId }` |
| `chat:messageDeleted` | S→C | `{ messageId, deletedBy }` |

### Whisper
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `whisper:send` | C→S | `{ targetNickname, content }` |
| `whisper:receive` | S→C | `{ id?, senderId, senderNickname, content, timestamp }` |
| `whisper:sent` | S→C | `{ id?, targetNickname, content, timestamp }` |
| `whisper:messageIdUpdate` | S→C | `{ tempId, realId }` |
| `whisper:messageFailed` | S→C | `{ tempId, error }` |

### Party Zone
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `party:join` | C→S | `{ zoneId }` |
| `party:leave` | C→S | `{ zoneId }` |
| `party:message` | C→S | `{ content }` |
| `party:message` | S→C | `{ userId, nickname, content, partyId, partyName, timestamp }` |
| `party:updated` | S→C | `{ zoneId, members[] }` |

### Reaction
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `reaction:toggle` | C→S | `{ messageId, reactionType: thumbsup\|heart\|check }` |
| `reaction:updated` | S→C | `{ messageId, reactions: [{ type, userId, userNickname }] }` |

### Admin
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `admin:mute` | C→S | `{ targetNickname, duration? }` |
| `admin:unmute` | C→S | `{ targetNickname }` |
| `admin:kick` | C→S | `{ targetNickname }` |
| `admin:announce` | C→S | `{ content }` |
| `member:muted` | S→C | `{ memberId, nickname, mutedBy, duration? }` |
| `member:unmuted` | S→C | `{ memberId, nickname, unmutedBy }` |
| `member:kicked` | S→C | `{ memberId, nickname, kickedBy }` |
| `space:announcement` | S→C | `{ content, announcer, timestamp }` |

### Editor (실시간 동기화)
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `editor:tile-update` | C→S | `{ layer, col, row, tileIndex }` |
| `editor:tile-updated` | S→C | `{ userId, layer, col, row, tileIndex }` |
| `editor:object-place` | C→S | `{ id, objectType, positionX, positionY, label? }` |
| `editor:object-placed` | S→C | `{ userId, id, objectType, positionX, positionY, label? }` |
| `editor:object-move` | C→S | `{ id, positionX, positionY }` |
| `editor:object-moved` | S→C | `{ userId, id, positionX, positionY }` |
| `editor:object-delete` | C→S | `{ id }` |
| `editor:object-deleted` | S→C | `{ userId, id }` |

### Error (세분화)
| 이벤트 | 방향 | 페이로드 |
|--------|------|----------|
| `chat:error` | S→C | `{ code, message }` |
| `whisper:error` | S→C | `{ code, message }` |
| `party:error` | S→C | `{ code, message }` |
| `admin:error` | S→C | `{ code, message }` |
| `error` | S→C | `{ message }` |

---

## 총계
- **EventBridge**: 33개 이벤트 (Player 4, Remote 3, Scene 2, UI 2, Asset 6, Object 2, Party 2, Editor 13)
- **Socket.io C→S**: 16개 이벤트
- **Socket.io S→C**: 24개 이벤트 (에러 5개 포함)
