# Asset Pipeline Contract

- **Owner**: Asset Pipeline Agent
- **Version**: 1.0.0
- **Last Updated**: 2026-02-19

## Scope

### In
- ComfyUI REST API 클라이언트
- 워크플로우 템플릿 관리
- 에셋 후처리 (리사이즈, 크로마키, 합성)
- 에셋 메타데이터 생성 (GeneratedAssetMetadata)
- 에셋 유효성 검증
- Mock mode (ComfyUI 미연결 시)

### Out
- 에셋 DB 저장 (Backend)
- 에셋 렌더링 (Game Engine)
- 에셋 생성 UI (Frontend)

## Entities
- 없음 (DB 직접 접근 없음, Backend API 통해 저장)

## API Surface

### Provided Interfaces (내부 모듈)
| Function | Input | Output |
|----------|-------|--------|
| `generateAsset(params)` | `GenerateAssetParams` | `GeneratedAsset` |
| `processAsset(raw)` | `RawAssetData` | `ProcessedAsset` |
| `validateAsset(asset)` | `ProcessedAsset` | `ValidationResult` |
| `getWorkflowTemplate(type)` | `AssetType` | `ComfyUIWorkflow` |

### Events Published
| Event | Payload | Channel |
|-------|---------|---------|
| `ASSET_GENERATED` | `{ assetId, type, metadata }` | EventBridge |
| `ASSET_GENERATION_FAILED` | `{ error, params }` | EventBridge |
| `ASSET_PROCESSING_PROGRESS` | `{ assetId, progress }` | EventBridge |

### Events Consumed
| Event | Source | Handler |
|-------|--------|---------|
| `GENERATE_ASSET_REQUEST` | Frontend | 에셋 생성 시작 |

## Provides to Game Engine
```
Character sprites: PNG, 8x4 grid, 64x64 per frame, transparent BG
Tilesets: PNG, 512x448, 16x14 grid, 32px tiles
Objects: PNG, max 128x128, transparent BG
Map backgrounds: PNG, configurable size
Naming: {type}_{name}_{variant}.png
```

## Data Ownership
| Table | Access |
|-------|--------|
| GeneratedAsset | Read (via Backend API) |
| AssetWorkflow | Read (via Backend API) |

## Invariants
1. 모든 생성 에셋은 `GeneratedAssetMetadata` 포함
2. 스프라이트 포맷은 Game Engine contract 규격 준수
3. ComfyUI 미연결 시 mock mode로 자동 전환
4. 파일명 규칙: `{type}_{name}_{variant}.png`
5. 투명 배경 PNG 필수 (맵 배경 제외)

## Test Plan
- ComfyUI 클라이언트 연결/mock 테스트
- 워크플로우 템플릿 로딩 테스트
- 에셋 후처리 (리사이즈, 투명도) 테스트
- 유효성 검증 테스트

## Dependencies

### Upstream
| Domain | What | How |
|--------|------|-----|
| Backend | 에셋 저장/조회 API | REST API |

### Downstream
| Domain | What | How |
|--------|------|-----|
| Game Engine | 스프라이트/타일셋 에셋 | 파일 시스템 + 메타데이터 |
| Frontend | 생성 상태 알림 | EventBridge |

## Breaking Changes
- v1.0.0: 초기 버전

## Consumer Impact
- 에셋 포맷 변경 시: Game Engine 에셋 로더 업데이트 필요
- 메타데이터 구조 변경 시: Backend API 업데이트 필요
