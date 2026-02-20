---
paths:
  - "src/features/assets/**"
  - "src/lib/comfyui/**"
  - "comfyui-workflows/**"
---

# Asset Pipeline Domain

ComfyUI 기반 AI 에셋 생성 — 워크플로우 실행, 후처리, 유효성 검증

## Invariants

1. **3-모드**: `COMFYUI_MODE` env → `auto` (자동감지) / `mock` (테스트용) / `real` (실제 연결)
2. **스프라이트 규격**: Character 8x4 grid (512x256), Tileset 16x14 grid (512x448), Object <128x128
3. **파일명 규칙**: `{type}_{name}_{variant}.png` (예: `character_warrior_v1.png`)
4. **투명 배경 PNG**: Character/Object 에셋은 반드시 alpha channel 포함
5. **GeneratedAssetMetadata 필수**: 모든 생성 에셋에 메타데이터 첨부
6. **저장 경로 이중화**: DB `/assets/...` ↔ 파일시스템 `public/assets/...` (이중 public 방지)
7. **Mock fallback**: ComfyUI 미연결 시 프로시저럴 placeholder 생성
