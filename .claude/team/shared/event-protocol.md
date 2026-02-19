# Event Protocol

## Overview
FlowSpace는 두 가지 이벤트 채널을 사용합니다:
1. **EventBridge**: React ↔ Phaser 브라우저 내 통신
2. **Socket.io**: Client ↔ Server 실시간 네트워크 통신

## EventBridge Events

### Player Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `PLAYER_MOVED` | Phaser → React | `{ x: number, y: number, direction: string, isMoving: boolean }` |
| `PLAYER_JUMPED` | Phaser → React | `{ x: number, y: number }` |
| `REMOTE_PLAYER_MOVED` | React → Phaser | `{ userId: string, x: number, y: number, direction: string }` |
| `REMOTE_PLAYER_JOINED` | React → Phaser | `{ userId: string, nickname: string, avatar: string, x: number, y: number }` |
| `REMOTE_PLAYER_LEFT` | React → Phaser | `{ userId: string }` |

### Game State Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `SCENE_READY` | Phaser → React | `{ sceneKey: string }` |
| `SCENE_ERROR` | Phaser → React | `{ error: string }` |

### UI Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `CHAT_FOCUS` | React → Phaser | `{ focused: boolean }` |
| `UI_OVERLAY_TOGGLE` | React → Phaser | `{ visible: boolean }` |

### Asset Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `ASSET_REGISTERED` | React → Phaser | `{ assetId: string, type: string, metadata: AssetMetadata }` |
| `ASSET_LOAD_ERROR` | Phaser → React | `{ assetKey: string, error: string }` |
| `ASSET_GENERATED` | System → React | `{ assetId: string, type: string, metadata: GeneratedAssetMetadata }` |
| `ASSET_GENERATION_FAILED` | System → React | `{ error: string, params: GenerateAssetParams }` |
| `ASSET_PROCESSING_PROGRESS` | System → React | `{ assetId: string, progress: number }` |
| `GENERATE_ASSET_REQUEST` | React → System | `{ type: AssetType, prompt: string, params: Record<string, unknown> }` |

### Object Interaction Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `OBJECT_INTERACT` | Phaser → React | `{ objectId: string, type: string }` |
| `OBJECT_PLACED` | React → Phaser | `{ objectId: string, x: number, y: number, assetKey: string }` |

## Socket.io Events

### Connection
| Event | Direction | Payload |
|-------|-----------|---------|
| `join:space` | Client → Server | `{ spaceId: string, userId: string, avatar: string }` |
| `leave:space` | Client → Server | `{ spaceId: string }` |

### Movement
| Event | Direction | Payload |
|-------|-----------|---------|
| `move` | Client → Server | `{ x: number, y: number, direction: string }` |
| `player:moved` | Server → Client | `{ userId: string, x: number, y: number, direction: string }` |

### Presence
| Event | Direction | Payload |
|-------|-----------|---------|
| `player:joined` | Server → Client | `{ userId: string, nickname: string, avatar: string, position: { x, y } }` |
| `player:left` | Server → Client | `{ userId: string }` |

### Chat
| Event | Direction | Payload |
|-------|-----------|---------|
| `chat:send` | Client → Server | `{ content: string, type: 'group' \| 'whisper' \| 'party', targetId?: string }` |
| `chat:message` | Server → Client | `{ userId: string, content: string, type: string, timestamp: string }` |

### Party Zone
| Event | Direction | Payload |
|-------|-----------|---------|
| `party:join` | Client → Server | `{ zoneId: string }` |
| `party:leave` | Client → Server | `{ zoneId: string }` |
| `party:updated` | Server → Client | `{ zoneId: string, members: string[] }` |

## Type Safety
모든 이벤트 페이로드는 TypeScript 인터페이스로 정의되어야 합니다.
위치: `src/features/space/game/events/types.ts`
