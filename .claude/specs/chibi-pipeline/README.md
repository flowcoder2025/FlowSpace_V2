# Epic: 치비 캐릭터 스프라이트 파이프라인

> 상태: **완료** | 시작: 2026-02-22 | 완료: 2026-02-23

## 목표
픽셀아트 → 치비/SD 스타일 캐릭터 스프라이트 생성 파이프라인 구현.
batch 생성 + Rembg AI 배경 제거 + LoRA 기반 스타일 통일.

## 모델 스택 (v3 - hybrid)
| 모델 | 용도 | 비고 |
|------|------|------|
| Animagine XL 3.1 | 베이스 체크포인트 | |
| flowspace-chibi LoRA | 치비 스타일 (커스텀) | epoch 8, strength 0.9 |
| OpenPoseXL2 (ControlNet) | 방향 가이드 | strength 0.85, Up은 0 |
| IP-Adapter Plus SDXL | 캐릭터 identity | style and composition, 0.8/endAt 0.5 |
| CLIP Vision (clip-ViT-H) | IP-Adapter 인코딩 | |
| Inspyrenet Rembg | AI 배경 제거 | ComfyUI 노드 |

## Phase 목록
| Phase | 설명 | 상태 |
|-------|------|------|
| 1 | 포즈 레퍼런스 시스템 | 완료 (v2에서 미사용) |
| 2 | 워크플로우 JSON | 완료 |
| 3 | 상수/타입 업데이트 | 완료 |
| 4 | 후처리 함수 (resize, compose, normalize) | 완료 |
| 5 | 프로세서 리팩토링 (32프레임 루프) | 완료 |
| 6 | API/모듈 연결 | 완료 |
| 7 | 검증 + 폭 정규화 | 완료 (GRADE: PASS) |
| 8 | IP-Adapter 캐릭터 identity 유지 | 완료 (v3에서 재도입) |
| 9 | LoRA 학습 (flowspace-chibi) | 완료 (epoch 8 채택) |
| 10 | **batch 리팩토링 (v2)** | **완료** (GRADE: PASS, 77% 속도 향상) |
| 11 | **IP-Adapter 일관성 최적화 (v3)** | **완료** (근본 해결 보류) |

## 핵심 결과 (v3 - hybrid)
- 32프레임 생성 시간: **~67초** (ComfyUI 4회: ref + down + left + up)
- right = left mirror (sharp.flop)
- 파이프라인: txt2img + IP-Adapter "style and composition" + ControlNet 방향 가이드
- `resizeFrame()` → `generateWalkFrames()` 순서 (normalizeDirectionFrames 스킵)
- Rembg AI 배경 제거 (워크플로우 내)
- **남은 문제**: 방향 간 캐릭터 디자인 불일치 = LoRA 학습 데이터 근본 원인
