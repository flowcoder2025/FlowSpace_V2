# Phase 1: Core Engine

> Epic: [파츠 조합 캐릭터 시스템](./README.md)
> 상태: ✅ 완료 | 업데이트: 2026-02-21

## 목표
32x48 해상도 업그레이드 + 파츠 타입 시스템 + Canvas 합성 엔진 구축

## Task 목록
- [x] Task 1.1: 해상도 업그레이드 (24x32 → 32x48)
- [x] Task 1.2: 파츠 타입 시스템 + 문자열 파싱
- [x] Task 1.3: 컴포지터 + body/eyes 드로어
- [x] Task 1.4: 나머지 드로어 (hair/top/bottom/accessory) + 통합

## 구현 상세

### Task 1.1: 해상도 업그레이드
**파일:** `game-constants.ts`, `sprite-generator.ts`, `local-player.ts`, `remote-player-sprite.ts`
- PLAYER_WIDTH 24→32, PLAYER_HEIGHT 32→48
- 스프라이트시트: 128x192 (4방향×4프레임)
- nameText y 오프셋: -20 → -28
- setOffset(2, 4), setSize(28, 44)

### Task 1.2: 파츠 타입 시스템
**파일:** `parts-types.ts`, `parts-string.ts`, `parts-registry.ts`, `avatar-types.ts`, `avatar-config.ts`
- PartCategory: body, hair, eyes, top, bottom, accessory
- LAYER_ORDER 렌더링 순서 정의
- `"parts:body_01:FFC0A0|hair_03:FF0000|..."` 포맷 파싱
- PartsAvatarConfig 유니온 타입 추가

### Task 1.3: 컴포지터 + 기본 드로어
**파일:** `parts-compositor.ts`, `drawer-utils.ts`, `body-drawer.ts`, `eyes-drawer.ts`
- Canvas 레이어 합성 엔진
- body 3종 (standard, slim, broad) + eyes 4종 (round, narrow, wide, dot)
- `renderPartsPreview()` — Phaser 불필요 독립 렌더

### Task 1.4: 나머지 드로어 + 통합
**파일:** `hair-drawer.ts`, `top-drawer.ts`, `bottom-drawer.ts`, `accessory-drawer.ts`, `avatar/index.ts`
- hair 6종, top 6종, bottom 4종, accessory 5종 (none 포함)
- `generateAvatarSpriteFromConfig()` — 3종 아바타 통합 진입점
- Public API export 확장

## 변경된 파일
| 파일 | 유형 | 설명 |
|------|------|------|
| `src/constants/game-constants.ts` | 수정 | 32x48 해상도 |
| `src/features/space/avatar/internal/parts/*.ts` | 추가 | 타입/파싱/레지스트리/컴포지터 |
| `src/features/space/avatar/internal/parts/drawers/*.ts` | 추가 | 6 드로어 + utils |
| `src/features/space/avatar/internal/avatar-types.ts` | 수정 | PartsAvatarConfig |
| `src/features/space/avatar/internal/avatar-config.ts` | 수정 | parts: 파싱 |
| `src/features/space/avatar/internal/sprite-generator.ts` | 수정 | 32x48 + 통합 |
| `src/features/space/avatar/index.ts` | 수정 | Public API |
