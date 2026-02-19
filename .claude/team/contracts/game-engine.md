# Game Engine Contract

- **Owner**: Game Engine Agent
- **Version**: 1.0.0
- **Last Updated**: 2026-02-19

## Scope

### In
- Phaser 3 씬 lifecycle 관리
- 캐릭터/아바타 스프라이트 렌더링
- 타일맵 로딩/렌더링 (32px grid)
- 오브젝트 배치 및 인터랙션
- EventBridge (React ↔ Phaser)
- 게임 루프 및 물리 처리
- 에셋 로딩 (Phaser.load)

### Out
- UI 오버레이 (Frontend)
- API 호출 (Backend)
- Socket 메시지 송수신 (Communication)
- 에셋 생성/처리 (Asset Pipeline)

## Entities
- 없음 (DB 직접 접근 없음)

## API Surface

### Endpoints
없음 (게임 엔진은 API를 제공하지 않음)

### Events Published (via EventBridge)
| Event | Payload | Description |
|-------|---------|-------------|
| `PLAYER_MOVED` | `{ x, y, direction, isMoving }` | 로컬 플레이어 이동 |
| `PLAYER_JUMPED` | `{ x, y }` | 로컬 플레이어 점프 |
| `OBJECT_INTERACT` | `{ objectId, type }` | 오브젝트 인터랙션 |
| `SCENE_READY` | `{ sceneKey }` | 씬 로딩 완료 |
| `ASSET_LOAD_ERROR` | `{ assetKey, error }` | 에셋 로딩 실패 |

### Events Consumed (via EventBridge)
| Event | Source | Handler |
|-------|--------|---------|
| `REMOTE_PLAYER_MOVED` | Communication | 원격 플레이어 위치 업데이트 |
| `REMOTE_PLAYER_JOINED` | Communication | 원격 플레이어 생성 |
| `REMOTE_PLAYER_LEFT` | Communication | 원격 플레이어 제거 |
| `CHAT_FOCUS` | Frontend | 채팅 입력 시 게임 입력 비활성화 |
| `ASSET_REGISTERED` | Asset Pipeline | 새 에셋 등록 알림 |

## Data Ownership
| Table | Access |
|-------|--------|
| 없음 | DB 직접 접근 없음 |

## Invariants
1. Phaser 씬은 React lifecycle과 독립적으로 관리
2. 모든 React ↔ Phaser 통신은 EventBridge를 통해서만 수행
3. 에셋 로딩은 AssetRegistry 메타데이터 필수
4. 타일 크기는 32px 고정
5. 스프라이트시트는 contract에 정의된 프레임 규격 준수

## Test Plan
- 씬 초기화/정리 lifecycle 테스트
- EventBridge 이벤트 발행/구독 테스트
- 에셋 로딩 (정상/실패/mock) 테스트
- 타일맵 렌더링 테스트

## Dependencies

### Upstream
| Domain | What | How |
|--------|------|-----|
| Asset Pipeline | 스프라이트/타일셋 에셋 | AssetRegistry + 파일 시스템 |
| Communication | 원격 플레이어 이벤트 | EventBridge |
| Backend | 에셋 메타데이터 | REST API |

### Downstream
| Domain | What | How |
|--------|------|-----|
| Frontend | 게임 이벤트 | EventBridge |
| Communication | 로컬 플레이어 이동 | EventBridge → Socket |

## Breaking Changes
- v1.0.0: 초기 버전

## Consumer Impact
- EventBridge 이벤트 타입 변경 시: Communication, Frontend 영향
- 에셋 로딩 규격 변경 시: Asset Pipeline 영향
