---
paths:
  - "src/features/space/game/**"
  - "src/features/space/avatar/**"
  - "src/features/space/bridge/**"
  - "src/features/space/editor/**"
---

# Game Engine Domain

Phaser 3 게임 엔진 — 씬 렌더링, 캐릭터/타일맵/오브젝트, EventBridge 통신

## Invariants

1. **SSR 회피**: `await import("phaser")` — 서버에서 Phaser import 금지
2. **EventBridge only**: Phaser ↔ React 통신은 반드시 EventBridge 경유 (직접 호출 금지)
3. **타일 32px 고정**: 모든 타일맵은 32x32px 타일 기준
4. **스프라이트 캐스트**: `textures.addSpriteSheet(key, canvas)` → `as unknown as HTMLImageElement`
5. **AssetRegistry 필수**: 에셋 로드 시 AssetRegistry 메타데이터 참조
6. **아바타 4x4 grid**: Classic = 프로시저럴 (24x32/frame), Custom = AI 생성 (64x64/frame, 8x4)
7. **Tween 보간**: 원격 플레이어 위치 보간 150ms
8. **registry.set()**: 씬에 옵션 전달 시 Phaser registry 사용

이벤트 타입은 `src/features/space/game/events/types.ts` 참조
