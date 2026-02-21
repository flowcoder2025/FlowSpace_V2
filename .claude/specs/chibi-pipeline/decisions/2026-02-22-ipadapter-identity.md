# Decision: IP-Adapter로 캐릭터 identity 유지

> 날짜: 2026-02-22
> Epic: 치비 캐릭터 스프라이트 파이프라인

## 배경
32프레임 독립 생성 시 ControlNet은 포즈만 가이드하고 캐릭터 외형(갑옷, 색상, 체형)은 유지하지 못함.
같은 seed+같은 프롬프트라도 ControlNet 포즈가 다르면 다른 캐릭터가 생성됨.

## 결정
IP-Adapter Plus SDXL (`ip-adapter-plus_sdxl_vit-h`) 도입.
- 1장의 레퍼런스를 자동 생성(down_0) → 나머지 31프레임에 identity 주입
- IP-Adapter는 MODEL 수정, ControlNet은 CONDITIONING 수정 → 독립 공존

## 대안 검토
| 방안 | 장점 | 단점 | 채택 |
|------|------|------|------|
| IP-Adapter | 가장 표준적, 강력한 identity 유지 | 추가 모델 ~2.6GB, VRAM +2~3GB | **채택** |
| img2img | 구현 간단 | 포즈 변경 폭 제한, denoise 조절 어려움 | 기각 |
| 같은 seed만 | 코드 변경 최소 | 외형 일관성 불충분 (이미 확인) | 기각 |

## 영향
- 추가 모델 2개 수동 다운로드 필요 (CLIP-ViT-H + IP-Adapter Plus)
- ComfyUI_IPAdapter_plus 커스텀 노드 설치 필요
- VRAM 사용량 증가: ~12GB → ~14GB (12GB GPU에서 타이트)
- 미설치 시 기존 방식으로 자동 폴백
