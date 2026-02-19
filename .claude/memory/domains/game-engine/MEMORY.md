# Game Engine Domain Memory

## Status: Phase 5 완료
- Last Updated: 2026-02-19

## Key Decisions
- Phaser 3.90 사용 (flow_metaverse와 동일)
- EventBridge 패턴 포팅 (42개 이벤트 타입)
- 타일 크기: 32px 고정
- 아바타: 4x4 grid, 24x32 per frame (Classic = 프로시저럴, Custom = AI 생성)
- dynamic import로 SSR 회피 (`await import("phaser")`)
- registry.set()으로 씬에 옵션 전달
- Tween 기반 원격 플레이어 보간 (150ms)

## Module Structure
```
src/features/space/game/
├── index.ts                    # Public API
├── events/                     # EventBridge + 타입
└── internal/
    ├── phaser-config.ts        # GameConfig 팩토리
    ├── game-manager.ts         # Phaser.Game 라이프사이클
    ├── asset-loader.ts         # AssetRegistry → Phaser 로더
    ├── scenes/
    │   ├── boot-scene.ts       # 프리로드 + 로딩바
    │   └── main-scene.ts       # 씬 오케스트레이터
    ├── player/
    │   ├── local-player.ts     # Physics.Arcade.Sprite
    │   └── input-controller.ts # WASD/Arrow
    ├── remote/
    │   ├── remote-player-sprite.ts   # Tween 보간
    │   └── remote-player-manager.ts  # Map + pending 큐
    ├── tilemap/
    │   ├── tileset-generator.ts # 프로시저럴 타일셋
    │   ├── map-data.ts          # 40x30 레이어 데이터
    │   └── tilemap-system.ts    # Tilemap + 충돌
    ├── camera/
    │   └── camera-controller.ts # 팔로우 + 데드존
    └── objects/
        ├── interactive-object.ts # 글로우 + [E]
        └── object-manager.ts     # 근접 체크 + OBJECT_INTERACT

src/features/space/avatar/
├── index.ts
└── internal/
    ├── avatar-types.ts
    ├── avatar-config.ts         # 8색 팔레트, parseAvatarString()
    └── sprite-generator.ts      # Canvas API 프로시저럴 스프라이트

src/features/space/bridge/
├── index.ts
└── internal/
    └── use-socket-bridge.ts     # Socket ↔ EventBridge 양방향
```

## Completed Tasks
- [x] Phaser 씬 기본 구조 생성
- [x] EventBridge 포팅 (Phase 1에서 완료)
- [x] 에셋 로더 통합 (Phase 1에서 완료)
- [x] 프로시저럴 타일셋 + 맵 데이터
- [x] 아바타 시스템 (Classic 프로시저럴)
- [x] 이동 + 충돌 + 카메라
- [x] 원격 플레이어 + Socket 브릿지
- [x] 인터랙티브 오브젝트
- [x] 공간 진입 페이지 (/space/[id])

## Known Issues / Future Work
- Custom 아바타 (AI 생성): textureKey 기반이나 아직 생성 파이프라인 미연결 (Phase 7)
- 맵 에디터: 하드코딩된 map-data.ts → 에디터로 동적 생성 필요 (Phase 8)
- 파티존: 이벤트 타입 정의됨 (PARTY_ZONES_LOADED, PARTY_ZONE_CHANGED) 이나 구현 대기
