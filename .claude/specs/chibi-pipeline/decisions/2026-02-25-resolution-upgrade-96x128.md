# Decision: 스프라이트 해상도 96x128 + scale 0.5

> Date: 2026-02-25
> Epic: chibi-pipeline / Phase 12
> Status: 채택

## 결정
게임 내 스프라이트 텍스처를 32x48 → 96x128로 업그레이드.
Phaser scale 0.5 적용하여 화면 표시는 48x64.

## 근거
1. 32x48은 AI 원본(1024x1024) 축소 시 도트 느낌 (ZEP 수준에 미달)
2. 96x128 텍스처 + scale 0.5 = 깨끗한 표시 + 합리적 성능

## 영향 파일
- `game-constants.ts`: PLAYER_WIDTH=96, HEIGHT=128, SCALE=0.5
- `sprite-generator.ts`: 32x48 tempCanvas → 96x128 스케일업
- `parts-compositor.ts`: 동일 패턴
- `local-player.ts`: setScale(0.5), physics body 조정
- `remote-player-sprite.ts`: setScale(0.5)
- `generate-walking-frames.py`: GAME_FRAME_W/H = 96x128
