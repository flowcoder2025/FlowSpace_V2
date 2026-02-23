# Phase 11: IP-Adapter 일관성 최적화

> Epic: [chibi-pipeline](./README.md)
> 상태: 완료 (근본 해결 보류) | 업데이트: 2026-02-23

## 목표
방향 간 캐릭터 일관성 향상 — 동일 캐릭터가 Down/Left/Up에서 동일한 디자인(헬멧, 갑옷, 망토)으로 보이도록 최적화

## Task 목록
- [x] Task 11.1: IP-Adapter end_at 파라미터 미주입 버그 수정
- [x] Task 11.2: ComfyUI MCP A/B 테스트 (weight_type, embeds_scaling, img2img 등)
- [x] Task 11.3: 최적 IP-Adapter 설정 확정 (style and composition)
- [x] Task 11.4: Down = Phase A 레퍼런스 직접 사용 (재생성 제거) → **11.6에서 번복됨**
- [ ] Task 11.5: Up 방향 핑크 아티팩트 수정 (Rembg 잔여)
- [x] Task 11.6: Down도 IP-Adapter 파이프라인으로 전환 (스케일 일관성)
- [x] Task 11.8: 프롬프트 최적화 (Danbooru 태그 + Animagine 품질 태그 + 초록배경)
- [x] Task 11.9: LoRA 학습 데이터 근본 원인 분석
- [ ] Task 11.7: Trellis2+UltraShape 3D 기반 파이프라인 탐색 (방향 일관성 근본 해결)

## 코드 상세

### 핵심 상수 (`constants.ts`)

```typescript
export const CHIBI_LORA_PRIORITY = ["flowspace-chibi", "chibistyle", "yuugiri"] as const;
export const CHIBI_LORA_FALLBACK = "yuugiri-lyco-nochekaiser.safetensors";
export const CHIBI_LORA_TRIGGER = "flowspace_chibi";

export const CHIBI_PROMPT_PREFIX =
  "masterpiece, best quality, very aesthetic, absurdres, 1boy, solo, chibi, 2-head-tall full body, centered in frame, whole body fully visible from head to toe, no cropping, equal margins top and bottom, no ground, no shadow, no floor, simple_background, green_background, green screen, game sprite, clean silhouette, consistent character design, same outfit, same colors, same distance from camera, no zoom, orthographic feeling, ";

export const CHIBI_DIRECTION_PROMPTS: Record<string, string> = {
  down: "looking_at_viewer, front view, standing, full_body, ",
  left: "from_side, profile, facing left, standing, full_body, ",
  right: "from_side, profile, facing right, standing, full_body, ",
  up: "from_behind, facing_away, back of character, cape seen from behind, full back view, standing, full_body, ",
};

export const CHIBI_NEGATIVE_PROMPT =
  "nsfw, lowres, (bad), text, error, fewer, extra, missing, worst quality, jpeg artifacts, low quality, watermark, unfinished, displeasing, oldest, early, chromatic aberration, signature, extra digits, artistic error, username, scan, abstract, realistic, photorealistic, 3d render, deformed, ugly, extra limbs, missing limbs, fused limbs, multiple characters, multiple views";

export const CHIBI_GENERATION_DEFAULTS = {
  samplerName: "euler_ancestral", scheduler: "normal", steps: 25, cfgScale: 7,
  loraStrength: 0.9, controlNetStrength: 0.85, controlNetStart: 0.0, controlNetEnd: 0.85,
  frameWidth: 1024, frameHeight: 1024,
} as const;

export const IPADAPTER_DEFAULTS = {
  weight: 0.8, weightType: "style and composition", startAt: 0.0, endAt: 0.5,
} as const;
```

### 핵심 함수 시그니처

```typescript
// post-processor.ts
async function resizeFrame(
  buffer: Buffer, targetW: number, targetH: number,
  options?: { maxHeightRatio?: number; footlineRatio?: number; noiseThreshold?: number }
): Promise<Buffer>

async function generateWalkFrames(baseFrame: Buffer, frameCount?: number): Promise<Buffer[]>
// bobFactors: [0, -0.6, -1, -0.6, 0, -0.6, -1, -0.6]
// shiftFactors: [-1, -0.5, 0, 0.5, 1, 0.5, 0, -0.5]

async function normalizeDirectionFrames(
  frames: Buffer[], options: { targetW: number; targetH: number; maxHeightRatio?: number; footlineRatio?: number }
): Promise<Buffer[]>  // ← 치비에서 미사용 (모션 상쇄 문제)

async function composeSpriteSheet(
  frames: Buffer[], options: { frameW: number; frameH: number; cols: number; rows: number }
): Promise<Buffer>

// capability-checker.ts
interface ComfyUICapabilities {
  controlNet: boolean; controlNetModels: string[];
  hasAnimagineXL: boolean; hasChibiLoRA: boolean; hasOpenPoseXL: boolean;
  checkpointModels: string[]; loraModels: string[];
  hasIPAdapter: boolean; hasIPAdapterPlus: boolean; hasCLIPVision: boolean; ipAdapterModels: string[];
  hasRembg: boolean; checkedAt: number;
}
async function checkComfyUICapabilities(): Promise<ComfyUICapabilities>

// pose-manager.ts
async function ensurePosesUploaded(client: ComfyUIClient): Promise<void>
function getPoseImageRef(direction: string, frameIndex: number): string
```

### normalizeDirectionFrames 미사용 이유
`resizeFrame()` → `generateWalkFrames()` 순서로 처리. `normalizeDirectionFrames`는 bbox 재정렬 시 걷기 모션(bodyBob/legShift)을 상쇄하므로 스킵. 같은 base에서 생성된 프레임은 이미 일관적.

## 테스트 상세

### Task 11.1: end_at 버그 수정
**파일:** `comfyui-workflows/character-chibi-ipadapter.json`
**문제:** `_meta.parameters`에 `ipadapter_weight`만 매핑, `start_at`/`end_at`/`weight_type`은 매핑 없음
→ constants에 endAt=0.5 설정해도 실제 워크플로우는 end_at=1.0으로 실행
**수정:** 3개 파라미터 추가 (`ipadapter_start_at`, `ipadapter_end_at`, `ipadapter_weight_type`)

### Task 11.2: A/B 테스트 (ComfyUI MCP)
| 테스트 | weight_type | weight | end_at | embeds | sampler | 결과 |
|--------|-------------|--------|--------|--------|---------|------|
| A | linear | 0.6 | 1.0 | V only | euler_a | 방향 OK, 디테일 불일치 |
| B | linear | 0.6 | 0.5 | V only | euler_a | A와 유사 |
| C | style transfer | 0.8 | 0.5 | V only | euler_a | 스타일 양호, 디테일 부분 유지 |
| D | strong style transfer | 0.6 | 0.5 | V only | euler_a | 망토 과도 강조 |
| E | linear | 1.0 | 1.0 | V only | dpmpp_2m | 모노크롬, 방향 붕괴 |
| F | linear | 1.2 | 1.0 | V only | dpmpp_2m | 트리 형태, 완전 실패 |
| G | linear(img2img) | 0.6 | 1.0 | V only | euler_a(d=0.6) | 디테일 유지 but 방향 전환 안됨 |
| H | linear(img2img) | 0.6 | 1.0 | V only | euler_a(d=0.75) | 방향 약간, 디테일 손실 |
| I | 없음(img2img) | - | - | - | euler_a(d=0.65) | 디테일 유지, 방향 전환 불가 |
| K | linear | 0.8 | 1.0 | K+V | euler_a | 모노크롬, 아티팩트 |
| **L** | **style and composition** | **0.8** | **0.5** | **V only** | **euler_a** | **최적! 디테일+방향 모두 양호** |
| M | style and composition | 0.8 | 0.5 | V only | euler_a(Up) | Up도 일관성 양호 |

### Task 11.3: 최적 설정
**파일:** `src/features/assets/internal/constants.ts`
```typescript
export const IPADAPTER_DEFAULTS = {
  weight: 0.8,                          // 0.6 → 0.8
  weightType: "style and composition",  // "linear" → "style and composition"
  startAt: 0.0,
  endAt: 0.5,
} as const;
```

### Task 11.4: Down = Phase A 레퍼런스 직접 사용 → **번복됨 (Task 11.6)**
**파일:** `src/features/assets/internal/processor.ts`
- 원래: Phase A ref를 Down 기저 프레임으로 직접 사용 (55초)
- **문제 발견**: Phase A(chibi-frame)와 Phase B(chibi-ipadapter) 간 캐릭터 스케일 차이 심각
  - Down(Phase A): 캔버스 60% → Left(Phase B): 캔버스 35% → 크기 불일치
- **번복**: Task 11.6에서 Down도 Phase B로 전환

### Task 11.6: Down도 IP-Adapter 파이프라인으로 전환
**파일:** `src/features/assets/internal/processor.ts`
- `CHIBI_IPADAPTER_DIRECTIONS`: `["left", "up"]` → `["down", "left", "up"]`
- `refFrameData` 변수 제거 (Phase A ref는 IP-Adapter용으로만 사용)
- Down 직접 사용 코드 블록 제거
- ComfyUI 호출: 3회 → 4회 (ref + down + left + up), 67초
- **결과**: 높이 완전 통일 (112px, stddev=0), Down/Up 폭 유사 (72/71px)
- **남은 문제**: Left/Right 캐릭터 디자인 불일치 (투구→둥근머리) → Task 11.7

### Task 11.8: 프롬프트 최적화 (Danbooru 태그 + Animagine 품질 태그)
**파일:** `src/features/assets/internal/constants.ts`
**테스트 순서:**
1. 퍼플렉시티 피드백만 적용 (파라미터 하향 + 레이아웃 프롬프트) → **후퇴** (레퍼런스 품질 저하, 품질 태그 누락)
2. + Danbooru 태그 + Animagine 품질 태그 통합 → **W stddev 7.2→0.9px 대폭 개선**
3. 초록 배경 테스트 → 플랫폼 잔상 문제 발생, `no ground, no shadow` 추가로 해결
4. 퍼플렉시티 파라미터(ControlNet 0.65, LoRA 0.75, IP-Adapter 0.65/0.4) → **identity 붕괴** (Left가 여성 캐릭터)
5. 파라미터 원복(LoRA 0.9, ControlNet 0.85, IP-Adapter 0.8/0.5) + 새 프롬프트 유지 → **최적 결과**

**최종 적용된 변경:**
- `CHIBI_PROMPT_PREFIX`: `masterpiece, best quality, very aesthetic, absurdres` + Danbooru 태그 + `green_background` + `no ground`
- `CHIBI_DIRECTION_PROMPTS`: Danbooru 스타일 (`looking_at_viewer`, `from_side, profile`, `from_behind, facing_away`)
- `CHIBI_NEGATIVE_PROMPT`: Animagine 공식 권장 네거티브
- 파라미터(LoRA/ControlNet/IP-Adapter): 기존 최적값 유지 (변경 없음)

**핵심 발견:**
- 파라미터를 낮추면 품질 태그를 더 강하게 넣어야 균형이 맞음
- IP-Adapter 0.65/endAt 0.4로 내리면 캐릭터 identity 붕괴 → 0.8/0.5 필수
- 초록 배경은 캐릭터 경계를 명확히 하지만 바닥 잔상 유발 → `no ground` 필수

### Task 11.9: LoRA 학습 데이터 근본 원인 분석
**발견:** LoRA 학습 데이터(35장)에 **2종류 캐릭터 디자인이 혼합**됨
- **A형 (투구 기사)**: ~25장, 정면 위주, pink_background
- **B형 (흰머리, 투구 없음)**: ~10장, **측면/걷기 포즈가 B형에만 존재**

**결론:** 방향 간 캐릭터 불일치의 **근본 원인은 LoRA 학습 데이터**
- 측면 생성 시 B형(흰머리)으로 끌려감 — 측면 학습 데이터가 B형에만 있으므로
- IP-Adapter/ControlNet/프롬프트 튜닝은 증상 완화이지 근본 해결이 아님
- `from_side`/`profile` 방향 태그가 학습 캡션에 없음
- `green_background`도 학습에 없음

**해결 방향 (미착수):**
1. LoRA 재학습: 화풍 통일 데이터로 스타일 LoRA 구성
2. Trellis2 3D: LoRA 한계 우회 (2D→3D→2D)

### Task 11.7: Trellis2+UltraShape 3D 기반 파이프라인 탐색
**상태:** 보류 (LoRA 근본 원인 발견으로 우선순위 재검토 필요)
**접근법:** 2D 치비 → Trellis2로 3D 변환 → 4방향 렌더링 → 100% 일관성
- Microsoft TRELLIS.2 (4B 파라미터 image-to-3D)
- UltraShape (메시 품질 개선)
- VRAM 12GB < 16GB 권장 → Low-VRAM 모드 필요
- 참고: https://www.youtube.com/watch?v=H7gqMnK7wUc

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `comfyui-workflows/character-chibi-ipadapter.json` | 수정 | IP-Adapter 파라미터 3개 추가 |
| `src/features/assets/internal/constants.ts` | 수정 | IPADAPTER_DEFAULTS 최적화 |
| `src/features/assets/internal/processor.ts` | 수정 | Phase A/B 리팩토링, Down 직접 사용 |

## 다음으로 넘기는 것
- **LoRA 재학습 또는 Trellis2 3D 파이프라인** — 방향 일관성 근본 해결 (학습 데이터 문제 확인됨)
- Up 하단 핑크 아티팩트 수정 (Task 11.5) — Rembg 잔여
- constants.ts 프롬프트 변경 커밋 필요 (프롬프트 최적화 결과)
