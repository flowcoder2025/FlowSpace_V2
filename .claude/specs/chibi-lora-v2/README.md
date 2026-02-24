# Epic: 치비 LoRA v2 재학습

> 상태: 진행중 | 시작: 2026-02-23 | 업데이트: 2026-02-24

## 목표
방향 간 캐릭터 불일치 근본 해결을 위한 스타일 LoRA v2 학습.
- 11종 다양한 캐릭터 (테마 혼합) × 3방향 학습 데이터
- 스타일만 학습, 캐릭터 디테일은 IP-Adapter에 위임

## Phase 구성
| Phase | 설명 | 상태 |
|-------|------|------|
| 1 | 학습 데이터 생성 (ComfyUI) | 완료 |
| 2 | 데이터 큐레이션 + 캡셔닝 | 완료 |
| 3 | 정규화 이미지 50장 | 완료 |
| 4 | LoRA 학습 실행 | 완료 (12h) |
| 5 | 검증 | **진행중 — 문제 발견** |
| 6 | 파이프라인 통합 | 미착수 |

## 핵심 문제 (Phase 5)
epoch 8 LoRA(strength=1.0) 테스트 결과:
- 기사(knight): 정상 (밝은 갑옷 학습 데이터 효과)
- 오피스/캐주얼: **실루엣/어두운 스타일** — LoRA가 학습 데이터의 어두운 이미지도 학습
- 원인 추정: c01-c07 원본 후면이 어두웠고, 일부 정면도 대비가 강했음
- 다음 시도: strength 0.5~0.7 + `anime coloring` 프롬프트로 보정 가능한지 테스트

## 주요 파일
| 파일 | 용도 |
|------|------|
| `sd-scripts/train_data/chibi_v2/` | 학습 데이터 45장 |
| `sd-scripts/output/flowspace-chibi-v2*.safetensors` | 체크포인트 4개 |
| `sd-scripts/train_config.toml` | 학습 설정 |
| `sd-scripts/train_lora.sh` | 학습 스크립트 |
| `ComfyUI/output/chibi_v2/` | 원본 생성 이미지 126장 |
| `ComfyUI/output/test_v2/` | epoch 8 테스트 결과 9장 |
