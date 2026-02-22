# Phase 8: IP-Adapter 캐릭터 Identity 유지

> Epic: [치비 캐릭터 스프라이트 파이프라인](./README.md)
> 상태: 완료 | 업데이트: 2026-02-22

## 목표
ControlNet만으로는 포즈만 가이드할 뿐 캐릭터 외형(갑옷, 색상, 체형)이 프레임 간 불일치.
IP-Adapter로 레퍼런스 이미지 기반 캐릭터 identity를 유지하여 32프레임 일관성 확보.

## Task 목록
- [x] Task 8.1: workflow-loader.ts 워크플로우 등록
- [x] Task 8.2: capability-checker.ts IP-Adapter 검출
- [x] Task 8.3: constants.ts + types.ts 상수/타입 추가
- [x] Task 8.4: processor.ts 2-Phase 생성 로직 (핵심)
- [x] Task 8.5: route.ts + index.ts API 연결
- [x] Task 8.6: 워크플로우 JSON 수정 (노드명/스키마)
- [x] Task 8.7: 검증 (tsc + vitest + 실제 생성 + 분석기)

## 구현 상세

### Task 8.1: 워크플로우 등록
**파일:** `src/features/assets/internal/workflow-loader.ts`
- WORKFLOW_FILES에 `"character-chibi-ipadapter": "character-chibi-ipadapter.json"` 추가

### Task 8.2: IP-Adapter 검출
**파일:** `src/features/assets/internal/capability-checker.ts`
- ComfyUICapabilities에 4필드 추가: hasIPAdapter, hasIPAdapterPlus, hasCLIPVision, ipAdapterModels
- IPAdapterModelLoader/IPAdapterAdvanced 노드 존재 확인
- IPAdapterModelLoader.input.required.ipadapter_file에서 모델 목록 추출
- CLIPVisionLoader.input.required.clip_name에서 CLIP 모델 확인

### Task 8.3: 상수/타입
**파일:** `src/features/assets/internal/constants.ts`, `types.ts`
- IPADAPTER_DEFAULTS: weight=0.8, weightType="linear", startAt=0.0, endAt=1.0
- CreateAssetParams에 ipAdapterWeight?: number 추가

### Task 8.4: 2-Phase 생성 로직 (핵심)
**파일:** `src/features/assets/internal/processor.ts`
- Phase A: down_0 레퍼런스 프레임 1장 생성 → removeBackground → client.uploadImage
- Phase B: chibi-ipadapter 워크플로우로 32프레임 생성, reference_image + ipadapter_weight 주입
- Fallback: IP-Adapter 미설치 → 기존 chibi-frame/chibi-fallback 워크플로우 자동 사용

### Task 8.5: API 연결
**파일:** `src/app/api/assets/generate/route.ts`, `src/features/assets/index.ts`
- ipAdapterWeight 파라미터 전달, IPADAPTER_DEFAULTS export

### Task 8.6: 워크플로우 JSON 수정
**파일:** `comfyui-workflows/character-chibi-ipadapter.json`
- IPAdapterApply → IPAdapterAdvanced (실제 노드명)
- clip_vision 입력 유지 (Advanced는 optional로 수용)
- weight_type: "linear", combine_embeds: "concat", embeds_scaling: "V only" 추가

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/features/assets/internal/workflow-loader.ts` | 수정 | chibi-ipadapter 워크플로우 등록 |
| `src/features/assets/internal/capability-checker.ts` | 수정 | IP-Adapter 검출 4필드 + 로직 |
| `src/features/assets/internal/constants.ts` | 수정 | IPADAPTER_DEFAULTS 추가 |
| `src/features/assets/internal/types.ts` | 수정 | ipAdapterWeight 필드 |
| `src/features/assets/internal/processor.ts` | 수정 | 2-Phase 생성 로직 |
| `src/app/api/assets/generate/route.ts` | 수정 | ipAdapterWeight 전달 |
| `src/features/assets/index.ts` | 수정 | IPADAPTER_DEFAULTS export |
| `comfyui-workflows/character-chibi-ipadapter.json` | 수정 | 노드명/스키마 수정 |
| `.env` | 수정 | COMFYUI_URL 포트 8001→8000 |

## 검증 결과
- tsc --noEmit: 통과
- vitest 52/52: 통과
- 분석기 GRADE: **PASS** (stddev=0px, range=0px)
- 생성 시간: ~19분 (Phase A 15초 + Phase B 32프레임)

## 아키텍처 메모
- IPAdapter Simple 노드는 clip_vision을 직접 받지 않음 → IPAdapterAdvanced 사용 필수
- IPAdapterModelLoader는 raw model만 반환, CLIPVision은 별도 로더 필요
- IPAdapterAdvanced는 clip_vision을 optional로 받아 raw ipadapter model과 결합
