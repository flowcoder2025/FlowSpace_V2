# Phase 1: 연동 누락 수정

> Epic: [에셋-게임 연동](./README.md)
> 상태: 완료 | 업데이트: 2026-02-22

## 목표
생성된 에셋이 게임 런타임, 맵 에디터, 아바타 시스템에 실제로 반영되도록 연동

## Task 목록
- [x] Task 2: 에셋 생성 → Phaser 런타임 로드 연동
- [x] Task 3: 맵 에디터에서 생성된 에셋 사용
- [x] Task 4: 생성된 캐릭터 → 아바타 적용
- [x] 추가: 전체 에셋 UI 한글화 + 상세 툴팁
- [x] 추가: ControlNet 설치 (노드 + 모델)

## 구현 상세

### Task 2: 에셋 생성 → Phaser 런타임 로드
**파일:**
- `src/features/space/game/internal/scenes/main-scene.ts`
- `src/components/assets/asset-studio.tsx`

**변경사항:**
- MainScene에 `ASSET_GENERATED` 이벤트 리스너 추가
- 핸들러: `createLoadableAssets()` → `loadAssetsInScene()` → `scene.load.start()` 런타임 동적 로드
- `shutdown()`에서 리스너 해제
- AssetStudio `handleComplete()`에서 `loadAssetToPhaser(asset.id)` 호출 추가

### Task 3: 맵 에디터에서 생성된 에셋 사용
**파일:**
- `src/stores/editor-store.ts` — `paletteTab` 타입에 `"assets"` 추가, `selectedAssetId` 상태
- `src/components/space/editor/asset-palette.tsx` — NEW: 완료된 에셋 목록, 타입 필터, 썸네일 그리드
- `src/components/space/editor/editor-sidebar.tsx` — "에셋" 3번째 탭 추가
- `src/features/space/editor/internal/use-editor.ts` — `setAssetSelection()`, `placeObject()`에 `assetId` 포함
- `src/app/space/[id]/space-client.tsx` — 새 props 전달

### Task 4: 생성된 캐릭터 → 아바타 적용
**파일:**
- `src/components/space/avatar-editor-modal.tsx` — [파츠 조합 | AI 캐릭터] 탭 추가
- `src/features/space/avatar/internal/sprite-generator.ts` — custom 타입 동적 로드 + 스케일

**변환 로직:**
- custom textureKey가 Phaser에 없으면 비동기 로드 시작 + 기본 파츠 아바타 fallback
- `/api/assets/{id}`로 filePath 조회 → Canvas로 이미지 로드
- 원본 프레임(128x128)을 게임 프레임(32x48)으로 스케일 다운
- Phaser `addSpriteSheet` 등록 후 EventBridge로 아바타 재적용 트리거

### 추가: 전체 UI 한글화 + 툴팁
**13개 파일** 한글화:
- prompt-editor.tsx, asset-generate-form.tsx, asset-studio.tsx, asset-preview.tsx
- asset-list.tsx, asset-palette.tsx, editor-sidebar.tsx, object-palette.tsx
- avatar-editor-modal.tsx, color-picker.tsx
- assets/page.tsx, assets/studio/page.tsx, assets/generate/page.tsx

**상세 툴팁** (title 속성):
- 에셋 유형별 설명, 프롬프트 입력 가이드
- 품질/스텝/CFG/시드/샘플러/스케줄러 상세 설명
- 배경 제거, 심리스 타일링, ControlNet 사용법

### 추가: ControlNet 설치
- `comfyui_controlnet_aux` 노드 설치 (custom_nodes/)
- `control_v11p_sd15_openpose.pth` 모델 다운로드 (1.38GB)
- Python 의존성 설치 (scipy, einops, fvcore 등)
- UI 문구: `(미설치)` → `(설정 필요)` (재시작 후 자동 감지)

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `main-scene.ts` | 수정 | ASSET_GENERATED 리스너 |
| `asset-studio.tsx` | 수정 | loadAssetToPhaser 호출 + 한글화 |
| `editor-store.ts` | 수정 | paletteTab/selectedAssetId 확장 |
| `asset-palette.tsx` | 추가 | 에셋 팔레트 컴포넌트 |
| `editor-sidebar.tsx` | 수정 | 에셋 탭 + 한글화 |
| `use-editor.ts` | 수정 | setAssetSelection + placeObject assetId |
| `space-client.tsx` | 수정 | 새 props 전달 |
| `avatar-editor-modal.tsx` | 수정 | AI 캐릭터 탭 + 한글화 |
| `sprite-generator.ts` | 수정 | custom 타입 동적 로드 |
| `prompt-editor.tsx` | 수정 | 전체 한글화 + 툴팁 |
| `asset-generate-form.tsx` | 수정 | 전체 한글화 + 툴팁 |
| `asset-preview.tsx` | 수정 | 한글화 |
| `asset-list.tsx` | 수정 | 한글화 |
| `object-palette.tsx` | 수정 | 카테고리 한글화 |
| `color-picker.tsx` | 수정 | 한글화 |
| `assets/page.tsx` | 수정 | 한글화 |
| `assets/studio/page.tsx` | 수정 | 한글화 |
| `assets/generate/page.tsx` | 수정 | 한글화 |

## 검증
- tsc --noEmit ✅
- eslint ✅
- next build ✅
