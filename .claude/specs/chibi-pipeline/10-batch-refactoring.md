# Phase 10: batch 리팩토링 (v2)

> Epic: [치비 캐릭터 스프라이트 파이프라인](./README.md)
> 상태: 완료 | 업데이트: 2026-02-23

## 목표
프레임별 24회 ComfyUI 호출을 방향당 1회 batch 호출(3회)로 전환.
Rembg AI 배경 제거 도입, ControlNet/IP-Adapter 제거.

## Task 목록
- [x] Task 10.1: ComfyUI 커스텀 노드 설치
- [x] Task 10.2: batch 워크플로우 JSON 설계
- [x] Task 10.3: processor.ts 리팩토링
- [x] Task 10.4: capability-checker Rembg 감지 추가
- [x] Task 10.5: 빌드/테스트 검증
- [x] Task 10.6: 실제 생성 테스트 + 분석

## 구현 상세

### Task 10.1: ComfyUI 커스텀 노드 설치
- `ComfyUI-Inspyrenet-Rembg`: AI 배경 제거 (transparent-background 패키지)
- `ComfyUI-SpriteSheetMaker`: 폴더 기반이라 실제 미사용 (composeSpriteSheet 코드 유지)

### Task 10.2: batch 워크플로우
**파일:** `comfyui-workflows/character-chibi-batch.json`
**노드 체인:** Checkpoint → LoRA → EmptyLatent(batch=8) → KSampler → VAEDecode → Rembg → SaveImage
**파라미터:** prompt, negative_prompt, seed, steps, cfg, sampler_name, scheduler, lora_strength, lora_name, batch_size

### Task 10.3: processor.ts 리팩토링
**변경사항:**
- 24회 프레임별 루프 → 3회 batch 호출 (down/left/up)
- ControlNet/IP-Adapter 코드 완전 제거
- pose-manager 의존성 제거
- Rembg 미설치 시 JS removeBackground 폴백 유지

### Task 10.4: capability-checker
`hasRembg` 필드 추가 → `InspyrenetRembg` 노드 존재 여부 확인

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `comfyui-workflows/character-chibi-batch.json` | 추가 | batch + Rembg 워크플로우 |
| `src/features/assets/internal/processor.ts` | 수정 | batch 전환, ControlNet/IP-Adapter 제거 |
| `src/features/assets/internal/capability-checker.ts` | 수정 | hasRembg 추가 |
| `src/features/assets/internal/workflow-loader.ts` | 수정 | chibi-batch variant 등록 |
| `scripts/quick-chibi-test.ts` | 수정 | v2 테스트 스크립트 |

## 테스트 결과
```
GRADE: PASS
32/32 frames, 0 empty
Height stddev: 0px
Per-row width range: 0px (모든 방향)
소요: 265초 (기존 1161초 대비 77% 단축)
```
