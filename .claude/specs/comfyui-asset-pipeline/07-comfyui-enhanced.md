# Phase 7 보완: ComfyUI 에셋 스튜디오 + DB기록 + 배치생성

> Epic: [comfyui-asset-pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
Phase 7 원래 plan 대비 누락된 기능 구현: 에셋 스튜디오 UI, DB 기록, 배치 생성, 게임 적용, 워크플로우 커스터마이징.

## Task 목록
- [x] B1: 에셋 DB 기록 (이미 generate route에 구현됨)
- [x] B2: 에셋 히스토리 API 강화 (이미 DB 기반으로 구현됨)
- [x] B3: 생성 진행률 표시 (`GenerationProgress` 컴포넌트)
- [x] B4: 에셋 스튜디오 UI (`/assets/studio`, AssetStudio, PromptEditor, AssetPreview)
- [x] B5: 에셋 → 게임 적용 (`game-loader.ts`)
- [x] B6: 배치 생성 (`/api/assets/batch` POST/GET)
- [x] B7: 워크플로우 커스터마이징 UI (드롭다운 선택)
- [x] B8: 네비게이션 업데이트 (ASSETS_STUDIO 추가)

## 구현 상세

### B3: GenerationProgress
**파일:** `src/components/assets/generation-progress.tsx`
- `/api/assets/[id]` 폴링 (2초 간격)
- 상태별 프로그레스 바 (PENDING 25% → PROCESSING 50% → COMPLETED 100%)

### B4: 에셋 스튜디오
**파일:** `src/app/assets/studio/page.tsx` - 스튜디오 라우트
**파일:** `src/components/assets/asset-studio.tsx` - 2-column (에디터 + 미리보기) + 히스토리 그리드
**파일:** `src/components/assets/prompt-editor.tsx` - 타입 선택, 프리셋 프롬프트, seed/width/height 파라미터
**파일:** `src/components/assets/asset-preview.tsx` - 줌/패닝, 다운로드

### B5: 게임 로더
**파일:** `src/features/assets/internal/game-loader.ts`
- `loadAssetToPhaser(assetId)`: API → EventBridge ASSET_GENERATED
- `loadAssetsToPhaser(assetIds[])`: 병렬 로드

### B6: 배치 생성 API
**파일:** `src/app/api/assets/batch/route.ts`
- POST: 최대 10개 아이템, 순차 큐잉, batchId로 그룹
- GET: batchId별 상태 조회 (completed/failed/pending 카운트)

### B7: 워크플로우 UI
**파일:** `src/components/assets/asset-generate-form.tsx` (수정)
- `/api/assets/workflows` 에서 목록 로드
- 타입별 필터된 워크플로우 드롭다운
- "Add to Batch" 버튼 + 배치 큐 표시

### B8: 네비게이션
**파일:** `src/constants/navigation.ts`
- `ASSETS_STUDIO: "/assets/studio"` 추가
- NAV_ITEMS에 Studio 링크 추가

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/app/api/assets/[id]/route.ts` | 추가 | 에셋 상세 + 진행률 API |
| `src/components/assets/generation-progress.tsx` | 추가 | 폴링 진행률 |
| `src/components/assets/asset-preview.tsx` | 추가 | 줌/다운로드 미리보기 |
| `src/components/assets/prompt-editor.tsx` | 추가 | 프롬프트 에디터 |
| `src/components/assets/asset-studio.tsx` | 추가 | 스튜디오 메인 |
| `src/app/assets/studio/page.tsx` | 추가 | 스튜디오 라우트 |
| `src/features/assets/internal/game-loader.ts` | 추가 | 게임 에셋 로더 |
| `src/app/api/assets/batch/route.ts` | 추가 | 배치 생성 API |
| `src/components/assets/asset-generate-form.tsx` | 수정 | 워크플로우 선택 + 배치 |
| `src/app/assets/generate/page.tsx` | 수정 | Studio 링크 추가 |
| `src/constants/navigation.ts` | 수정 | ASSETS_STUDIO 추가 |
| `src/features/assets/index.ts` | 수정 | game-loader export |
