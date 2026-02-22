# Decision: 픽셀아트 → 치비/SD 스타일 전환

> 날짜: 2026-02-22
> Epic: 치비 캐릭터 스프라이트 파이프라인

## 배경
기존 에셋 파이프라인은 픽셀아트 스타일로 캐릭터 스프라이트를 생성했으나,
사용자가 원하는 스타일이 아니었음. 또한 단일 시트 생성 방식으로는
128x128 프레임 내 캐릭터 위치/크기 일관성 확보가 불가능했음 (64~128px 편차).

## 결정
- 픽셀아트 폐기 → Animagine XL 3.1 기반 치비(2등신) 스타일로 전환
- 단일 시트 → 프레임별 개별 생성 (32프레임) + ControlNet 포즈 + 후처리 합성

## 근거
1. 프롬프트/샘플러 변경만으로는 스프라이트시트 일관성 불가 (분석기 GRADE: WARN)
2. ControlNet + 프레임별 생성이 포즈 제어의 정석
3. 후처리 정규화(normalizeDirectionFrames)로 크기 완전 통일 가능

## 영향
- 모델 3개 추가: Animagine XL 3.1, yuugiri-lyco LoRA, OpenPoseXL2
- 생성 시간 증가: ~30초(단일 시트) → ~8분(32프레임)
- 새 워크플로우 JSON 2개: chibi-frame, chibi-fallback
- pose-manager.ts 신규 (32개 포즈 이미지 관리)
