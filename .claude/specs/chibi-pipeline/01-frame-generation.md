# Phase 1~7: 프레임별 생성 + 후처리 파이프라인

> Epic: [치비 캐릭터 스프라이트 파이프라인](./README.md)
> 상태: 완료 | 업데이트: 2026-02-22

## 목표
32프레임(4방향×8걸음) 치비 캐릭터 스프라이트시트를 프레임별 생성+합성 방식으로 구현

## 완료 Task 목록
- [x] 포즈 스켈레톤 32개 생성 (scripts/generate-pose-skeletons.ts)
- [x] ComfyUI uploadImage() 메서드 추가 (client.ts)
- [x] pose-manager.ts: 포즈 업로드/참조 관리
- [x] character-chibi-frame.json: ControlNet+LoRA 워크플로우
- [x] character-chibi-fallback.json: ControlNet 없는 폴백
- [x] CHIBI_* 상수 + CreateAssetParams 타입 확장
- [x] resizeFrame(): bbox 크롭 → 표준 높이 스케일 → 바닥선 앵커
- [x] composeSpriteSheet(): 프레임 배열 → 그리드 합성
- [x] normalizeDirectionFrames(): 방향별 폭 통일 (median bbox + fit:fill + equalization)
- [x] processChibiCharacterGeneration(): 2-phase 분기 (processor.ts)
- [x] capability-checker.ts: Animagine/LoRA/OpenPose 모델 검출
- [x] 분석기 GRADE: PASS (폭 stddev=7.3px, 높이 stddev=0px)

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `scripts/generate-pose-skeletons.ts` | 추가 | 32개 OpenPose 스켈레톤 SVG→PNG |
| `scripts/analyze-spritesheet.ts` | 추가 | 품질 분석기 |
| `scripts/quick-chibi-test.ts` | 추가 | 파이프라인 직접 테스트 |
| `scripts/test-chibi-generation.ts` | 추가 | API E2E 테스트 |
| `comfyui-workflows/character-chibi-frame.json` | 추가 | ControlNet+LoRA 워크플로우 |
| `comfyui-workflows/character-chibi-fallback.json` | 추가 | 폴백 워크플로우 |
| `comfyui-workflows/poses/*.png` | 추가 | 32개 포즈 이미지 |
| `src/features/assets/internal/pose-manager.ts` | 추가 | 포즈 업로드 관리 |
| `src/features/assets/internal/post-processor.ts` | 수정 | +resizeFrame, composeSpriteSheet, normalizeDirectionFrames |
| `src/features/assets/internal/processor.ts` | 수정 | +processChibiCharacterGeneration |
| `src/features/assets/internal/constants.ts` | 수정 | +CHIBI_* 상수 |
| `src/features/assets/internal/types.ts` | 수정 | +useChibiStyle, loraStrength 등 |
| `src/features/assets/internal/capability-checker.ts` | 수정 | +hasChibiLoRA, hasAnimagineXL 등 |
| `src/features/assets/internal/workflow-loader.ts` | 수정 | +chibi-frame, chibi-fallback 등록 |
| `src/features/assets/index.ts` | 수정 | 신규 export 추가 |
| `src/app/api/assets/generate/route.ts` | 수정 | useChibiStyle 파라미터 전달 |
| `src/lib/comfyui/client.ts` | 수정 | +uploadImage() |

## 다음 Phase로 넘기는 것
- 프레임 간 캐릭터 외형 불일치 → Phase 8 (IP-Adapter) 에서 해결
- 에셋 생성 UI (갤러리에서 직접 생성) → 별도 작업
