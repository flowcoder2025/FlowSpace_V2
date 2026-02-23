# Epic: 치비 LoRA 학습

> 상태: **Phase 5 검증 진행 중 → 파이프라인 리팩토링 전환** | 시작: 2026-02-22

## 목표
게임 스프라이트 전용 치비 스타일 LoRA를 학습하여 32프레임 생성 시 프레임 간 시각적 일관성을 확보한다.

## 배경
- 기존 yuugiri LoRA + IP-Adapter + ControlNet으로도 프레임 간 외형 불일치 해결 불가
- GRADE: PASS는 크기/정렬만 측정 — 시각적 identity는 미측정

## Phase 구성
| Phase | 상태 | 내용 |
|-------|------|------|
| Phase 1 | ✅ 완료 | kohya_ss 설치 (sd-scripts + torch cu124) |
| Phase 2 | ✅ 완료 | 학습 데이터 35장 + 정규화 140장 준비 |
| Phase 3 | ✅ 완료 | LoRA 학습 (2100 steps, 16시간, loss=0.055) |
| Phase 4 | ✅ 완료 | FlowSpace 파이프라인 코드 통합 (6파일) |
| Phase 5 | 🔄 진행중 | 검증 + 파이프라인 리팩토링 결정 |

## 핵심 결정
- **kohya_ss** 선택 (sd-scripts 기반, RTX 4070 12GB 호환)
- **yuugiri 대체, fallback 유지** — `CHIBI_LORA_PRIORITY` 상수로 자동 선택
- **트리거 워드**: `flowspace_chibi`
- **하이퍼파라미터**: dim=32, alpha=16, AdamW8bit, LR=5e-5, 12 epochs
- **epoch 8 채택**: `flowspace-chibi-v1-000008.safetensors` (325MB)
- **ControlNet 제거 결정 (2026-02-23)**: OpenPose 좌/우 구분 불가, 치비에 효과 미미
- **right = left mirror (2026-02-23)**: sharp.flop() 좌우반전
- **단일 워크플로우 전환 결정 (2026-02-23)**: Rembg + SpriteSheetMaker + batch 생성

## 학습 결과
| 체크포인트 | 에포크 | 파일 |
|-----------|--------|------|
| flowspace-chibi-v1-000002.safetensors | 2 | 325MB |
| flowspace-chibi-v1-000004.safetensors | 4 | 325MB |
| flowspace-chibi-v1-000006.safetensors | 6 | 325MB |
| **flowspace-chibi-v1-000008.safetensors** | **8 (채택)** | **325MB** |
| flowspace-chibi-v1-000010.safetensors | 10 | 325MB |
| flowspace-chibi-v1.safetensors | 12 (최종) | 325MB |
