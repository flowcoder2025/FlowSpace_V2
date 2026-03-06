# Decision: Hunyuan3D 3D 복원으로 front→back 시점 전환

- **Date**: 2026-03-03
- **Status**: 진행중 (형상 확인, 텍스처 미완)

## Context
오브젝트 front→back 시점 전환에서 2D 모델(Klein ReferenceLatent, SV3D)은 깊이 모순 발생.
앞면이 오목(다리 사이 공간)이면 뒷면도 오목으로 생성 — 물리적으로 불가능한 결과.

## 테스트한 접근법
| 접근법 | 깊이 일관성 | 텍스처 | 판정 |
|--------|------------|--------|------|
| Klein 프롬프트-only | 모순 | 있음 | 깊이 불일치 |
| Klein ReferenceLatent | 시점 전환 자체 불가 | - | 실패 |
| SV3D | 모순 | 있음 (흐릿) | 깊이 불일치 |
| Hunyuan3D v2 native | 일관 | 없음 | 형상만 |
| **Kijai Hunyuan3D** | **일관** | 없음 | **형상 우수** |

## Decision
**Hunyuan3D 3D 복원 → back view 렌더 경로 채택**
- 깊이 일관성을 보장하는 유일한 접근
- 텍스처 추가가 남은 과제:
  - Option A: Hunyuan3D paint 모델 (자동 다운로드)
  - Option B: 3D 렌더(depth/normal)를 Klein의 가이드로 2-pass 생성

## 설치된 도구
- Kijai ComfyUI-Hunyuan3DWrapper: `custom_nodes/ComfyUI-Hunyuan3DWrapper/`
- Open3D 렌더 스크립트: `scripts/render-back-view.py`
- 모델: `diffusion_models/hy3dgen/hunyuan3d-dit-v2-0-fp16.safetensors`

## 미해결
- custom_rasterizer DLL 호환성 (torch 2.10 + CUDA 13.0)
- nvdiffrast 빌드 실패
- paint 모델 다운로드 + 텍스처 파이프라인 테스트
