# Phase 12: 멀티뷰 스프라이트시트

> Epic: [chibi-pipeline](./README.md)
> 상태: 진행중 | 업데이트: 2026-03-10

## 목표
11개 고정 프리셋 캐릭터의 8방향 걷기 스프라이트시트 생성 + 게임 적용.
방향 간 캐릭터 일관성 확보가 핵심 (Phase 1~11에서 미해결).

## 최종 확정 파이프라인

### 모델 스택
| 모델 | 용도 | 설정 |
|------|------|------|
| Animagine XL 3.1 | 베이스 체크포인트 | - |
| flowspace-chibi-v2 LoRA | 치비 스타일 | str=0.6 |
| Depth ControlNet (xinsir) | 방향 제어 | str=0.3, endAt=0.7 |
| IP-Adapter Plus SDXL | 캐릭터 identity | 방향별 다름 (아래 참조) |
| IPAdapterStyleComposition | back 전용 | style=1.0, comp=0.3 |
| Inspyrenet Rembg | 배경 제거 | - |

### 방향별 IP-Adapter 설정
| 방향 | 노드 | weight_type | 이유 |
|------|------|------------|------|
| front | IPAdapterAdvanced | style and composition | 팔/크기 유지 |
| left | IPAdapterAdvanced | style and composition | 동일 |
| back | **IPAdapterStyleComposition** | style=1.0, comp=0.3 | 주황 마크 방지 + 크기 힌트 |
| right | left mirror (sharp.flop) | - | - |

### 워크플로우 (15 nodes)
상세 노드 구조 및 파라미터 → `comfyui-experiments.md` 섹션 1~2 참조

## Task 목록

### 3D 접근 (시도 → 폐기)
- [x] Task 12.1: Hunyuan3D v2 테스트 → FAIL (부조 형태)
- [x] Task 12.2: SV3D 테스트 → 부분 성공 (realistic만, anime FAIL)
- [x] Task 12.3: Character sheet 접근 발견

### Depth ControlNet 접근 (채택)
- [x] Task 12.4: OpenPose/ControlNet 리서치 → OpenPose 정면/후면 구분 불가 확인
- [x] Task 12.5: Depth ControlNet 다운로드 + 테스트 → **str=0.3에서 3방향 성공**
- [x] Task 12.6: 치비 비율 깊이 맵 3방향 수작업 제작 (front/back/left)
- [x] Task 12.7: IP-Adapter + Depth ControlNet 조합 → 캐릭터 일관성 확인

### Back 문제 해결
- [x] Task 12.8: back 주황 마크 해결 → `style transfer` weight_type
- [x] Task 12.9: back 팔 미표시 해결 → depth map v3 (팔 확대)
- [x] Task 12.10: back 발 위치 해결 → depth map 44px 하향 shift
- [x] Task 12.11: back 사이즈 해결 → IPAdapterStyleComposition (style=1.0, comp=0.3)
- [x] Task 12.12: warm ref 세트 확정 → `light brown hair` seed front를 ref로 사용

### 11캐릭터 배치
- [x] Task 12.13: 태그별 back view 기준점 테스트 (길이 4종 + 스타일 5종 + back 전용 3종)
- [x] Task 12.14: 배치 v1~v4 (프롬프트 강화, 의상 구체화, 태그 최적화)
- [x] Task 12.15: 최종 판정 — **6캐릭터 채택** (c02/c03/c04/c05/c07/c08), 5캐릭터 제외
  - ⚠️ c08 후속 제외: back view 품질 불량 → **5캐릭터로 축소** (c02/c03/c04/c05/c07)

### 걷기 애니메이션
- [x] Task 12.16: AI 걷기 포즈 테스트 → 실패 (txt2img=identity 불일치, img2img=다리 안 바뀜)
- [x] Task 12.17: 코드 기반 걷기 프레임 생성 (`scripts/generate-walking-frames.py`)
- [x] Task 12.18: 걷기 개선 (shear_upper_body + scale_leg_vertical + defringe + overlap 30px)

### 게임 적용
- [x] Task 12.19: 스프라이트 해상도 업그레이드 (32x48 → 96x128 텍스처, scale 0.5 = 48x64 표시)
- [x] Task 12.20: c02 게임 적용 (스프라이트시트 → DB 등록 → avatarConfig)
- [x] Task 12.21: 스페이스키 점프 (Tween + squash&stretch + 바닥 그림자 + apply/restore 패턴)
- [x] Task 12.22: ~~나머지 5캐릭터~~ → Task 12.24로 통합
- [x] Task 12.23: 흰 테두리 해결 — clean ref 생성(IP-Adapter 없이) + `thick outline` 제거 → v5 파이프라인 확정
- [x] Task 12.24: 5캐릭터(c02/c03/c04/c05/c07) 걷기 프레임 + 스프라이트시트 + 게임 적용 (c08 제외)
- [x] Task 12.25: pixelArt OFF + antialias ON (AI 캐릭터 대응)
- [x] Task 12.26: 닉네임 텍스트 위치/폰트 개선 (NAME_OFFSET_Y 상수화, bold 12px)
- [x] Task 12.27: 캐릭터 scale 0.5→0.35 (ZEP/게더타운 수준 34x45 표시)
- [x] Task 12.28: 대각선 이동 시 측면 스프라이트 우선 (ZEP 방식)
- [ ] ~~Task 12.29: 오피스 테마 타일셋 생성 (ComfyUI AI)~~ → 방향 변경 (아래 참조)
- [x] Task 12.30: 타일맵 색상 ZEP 스타일로 교체 (바닥=웜 베이지, 벽=클린 그레이)
- [x] Task 12.31: 그리드 이동 시스템 (ZEP/Gather.town 방식 타일 단위 이동, Tween 기반)

### 실패/폐기한 접근
- 2-pass img2img back 생성 → 폐기 (Pass1이 다른 캐릭터, 복구 불가)
- I2V 카메라 제어 (ReCamMaster/AniSora/360 LoRA) → 폐기 (2D→3D 뒷면 합성 불가)
- character sheet split → 비실용적 (레이아웃 불규칙)
- img2img 체형 비율 변환 → 불가 (latent에 고정)
- ComfyUI mask erode → 폐기 (edge RGB가 흰색이라 깎아도 다음 층도 흰색)
- 프롬프트 `thick outline` 제거 → 단독으로는 무효 (ref 오염이 주원인), 단 ref 정리와 병행 시 유효
- 배경색 변경 (green/simple) → 무효 (ref 오염이 주원인이라 배경 무관)
- premultiply alpha → 부분 해결만 (Band 1-2 반투명 halo만, Band 4-7 불투명 흰색 70%는 처리 불가)
- LoRA str 감소 (0.6→0.4) → root cause(ref 오염) 발견 전 테스트, 재검증 필요

## 구현 상세

### Depth ControlNet 방향 제어 (Task 12.5)
- 수작업 깊이 맵: front(눈/코 밝은 점) vs back(얼굴 특징 없음)으로 정면/후면 구분
- str=0.3: 방향 힌트만 제공, 애니메 스타일 보존
- str=0.5~0.7: 3D 점토 인형화 (사용 금지)
- preprocessor=none (직접 제작 맵 사용)

### 코드 기반 걷기 프레임 (Task 12.17~18)
- `scripts/generate-walking-frames.py`: standing 스프라이트에서 상체/다리 분리 → 4프레임 사이클
- 정면/후면: 좌우 다리 분리 + 상하 이동
- 측면: 다리 복제 + 전후 교차
- 가랑이 라인 감지: 폭 변화 기반 (중앙 갭 감지보다 정확)
- `shear_upper_body()`: 상체 전단 (팔 스윙 효과)
- `scale_leg_vertical()`: 다리 수직 압축
- `remove_white_fringe()`: Rembg 잔여 디프린지 (임시)
- overlap 30px: LANCZOS 보간 경계 반투명 방지

### 스프라이트 해상도 업그레이드 (Task 12.19, 12.27)
- 96x128 텍스처 + Phaser scale 0.35 = 34x45 표시 (Task 12.27에서 0.5→0.35, ZEP/게더타운 수준)
- Parts/Classic 아바타: 32x48 tempCanvas 그린 뒤 96x128 스케일업
- Custom 아바타: PLAYER_WIDTH/HEIGHT 참조 → 자동 적용
- `PLAYER_SCALE = 0.35` (`src/constants/game-constants.ts`)

### 점프 기능 (Task 12.21, 그리드 이동 통합 후 업데이트)
- jumpState.offsetY Tween (0→-20→0, JUMP_DURATION=400ms/2 yoyo, Sine.Out)
- **logicalX/logicalY 분리**: jumpState.offsetY는 logicalY와 독립, syncVisuals()에서 합산
- **jumpState 별도 객체**: 이동 Tween(`targets: this`)과 점프 Tween(`targets: this.jumpState`) 타겟 분리 → Phaser tween 간섭 방지
- **점프 중 수직 이동 보정**: 하향 이동 시 오프셋 ×1.5 (상쇄 보상), 상향은 보정 없음
- squash(scaleY 0.85, 80ms) + stretch(scaleY 1.15, 60ms)
- 바닥 그림자: fillEllipse, 점프 높이 비례 축소/투명화
- preupdate/apply/restore 패턴 → **제거됨** (logicalY 분리로 불필요)

### Shift+방향 전환 버그 수정
- `setIdle()`: 이미 idle 시 early return으로 `setFrame()` 미실행 → 방향 전환이 시각적으로 반영 안 됨
- **수정**: `setFrame()`을 early return 밖으로 이동 → 방향 변경 시 항상 프레임 갱신
- `update()`: `!isMoving` 분기에서 `direction !== currentDirection`이면 즉시 `setIdle(direction)` + `emitMovement(false)`

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/constants/game-constants.ts` | 수정 | SCALE=0.35, NAME_OFFSET_Y, TILE_STEP_DURATION=130, TILE_HALF=16 추가 |
| `src/features/space/game/internal/player/input-controller.ts` | 수정 | velocityX/Y → dx/dy 정수 델타, Shift+방향 = 방향전환만(이동 없음) |
| `src/features/space/game/internal/player/local-player.ts` | 전면 수정 | Physics.Arcade.Sprite → GameObjects.Sprite, tileCol/tileRow, Tween 이동 |
| `src/features/space/game/internal/player/tile-collision-checker.ts` | 신규 | 순수 로직 충돌 판정 클래스 |
| `src/features/space/game/internal/remote/remote-player-sprite.ts` | 수정 | LERP 150→130ms (로컬 스텝과 동기화) |
| `src/features/space/game/internal/scenes/main-scene.ts` | 수정 | TileCollisionChecker 통합, Arcade 충돌 제거, initTileCollision() 추가 |
| `src/features/space/game/internal/tilemap/map-data.ts` | 수정 | COLLISION_LAYER_NAMES export 추가 |
| `src/features/space/avatar/internal/sprite-generator.ts` | 수정 | DRAW_WIDTH/HEIGHT + tempCanvas 스케일업 |
| `src/features/space/avatar/internal/parts/parts-compositor.ts` | 수정 | 동일 패턴 |
| `src/features/assets/internal/processor.ts` | 수정 | lint 수정 |
| `src/components/assets/asset-detail-modal.tsx` | 수정 | barrel import 수정 |
| `scripts/generate-walking-frames.py` | 추가 | 걷기 프레임 생성 |
| `scripts/batch-chibi-directions.py` | 수정 | 배치 생성 v5 (clean ref + thick outline 제거) |
| `scripts/generate-walking-depth-maps.py` | 추가 | 걷기 depth map 생성 |
| `public/assets/generated/c02_spritesheet_96x128.png` | 추가 | c02 게임용 |
| `public/assets/generated/c03_spritesheet_96x128.png` | 추가 | c03 게임용 |
| `public/assets/generated/c04_spritesheet_96x128.png` | 추가 | c04 게임용 |
| `public/assets/generated/c05_spritesheet_96x128.png` | 추가 | c05 게임용 |
| `public/assets/generated/c07_spritesheet_96x128.png` | 추가 | c07 게임용 |
| `src/features/space/game/internal/phaser-config.ts` | 수정 | pixelArt:false, antialias:true |
| `scripts/generate-office-tileset.py` | 추가 | 오피스 타일셋 ComfyUI 생성 스크립트 |
| `scripts/register-characters.mjs` | 추가 | DB 캐릭터 일괄 등록 스크립트 |
| `src/features/space/game/internal/tilemap/tileset-generator.ts` | 수정 | 타일맵 색상 ZEP 스타일 교체 (바닥=웜베이지, 벽=클린그레이) |
| `src/features/space/avatar/internal/chibi-characters.ts` | 신규 | 5종 치비 캐릭터 상수 + getChibiTextureKey |
| `src/features/space/avatar/internal/avatar-types.ts` | 수정 | ChibiAvatarConfig 추가, AvatarConfig 유니언 확장 |
| `src/features/space/avatar/internal/avatar-config.ts` | 수정 | chibi 파싱 + custom→chibi 하위 호환 매핑 |
| `src/features/space/avatar/internal/sprite-generator.ts` | 수정 | chibi 타입 즉시 반환 (preload 확인 + fallback) |
| `src/features/space/avatar/index.ts` | 수정 | ChibiAvatarConfig, ChibiCharacterDef, CHIBI_CHARACTERS, getChibiTextureKey 재공개 |
| `src/features/space/game/internal/scenes/main-scene.ts` | 수정 | preload()에 5종 치비 스프라이트시트 로드 |
| `src/components/space/avatar-editor-modal.tsx` | 수정 | API 호출 제거, CHIBI_CHARACTERS 직접 렌더, ChibiThumbnail 컴포넌트 추가 |
| `prisma/schema.prisma` | 수정 | GeneratedAsset.isShared 필드 + 복합 인덱스 추가 |
| `src/app/api/assets/route.ts` | 수정 | shared=true 쿼리 지원 (공용 에셋 조회) |
| `src/features/space/game/internal/player/local-player.ts` | 수정 | Shift+방향 전환 버그 수정, 점프 하향 이동 보정 |

### v5 파이프라인 (Task 12.23, 흰 테두리 근본 해결)
- **원인**: ref 이미지에 흰 아웃라인 포함 → IP-Adapter가 스타일로 전파
- **해결**: clean ref (IP-Adapter 없이 생성) + 프롬프트에서 `thick outline, bold lineart` 제거
- **결과**: 6캐릭터 × 3방향 = 18장 전원 **흰 아웃라인 0%**
- **출력 구조**: `ComfyUI/output/v5/refs/` + `v5/final/` (이전: `legacy/`)
- **배치 스크립트**: `scripts/batch-chibi-directions.py` v5 (`--gen-refs` → `--upload-refs` → 기본)
- **ComfyUI 워크플로우**: `v5_clean_ref_pipeline.json`, `v5_front_left_pipeline.json`, `v5_back_pipeline.json`

### 그리드 이동 시스템 (Task 12.31)

Physics.Arcade 연속 이동을 Tween 기반 타일 단위 이동으로 전면 교체.

#### 신규 상수 (`src/constants/game-constants.ts`)

```typescript
export const TILE_STEP_DURATION = 130; // ms, 타일 1칸 이동 시간
export const TILE_HALF = TILE_SIZE / 2; // 16px, 타일 중심 오프셋
```

#### TileCollisionChecker (`src/features/space/game/internal/player/tile-collision-checker.ts`)

Phaser 의존 없는 순수 로직 클래스. 경계 + 충돌 레이어 + 가구 blocked 타일 통합 판정.

```typescript
export class TileCollisionChecker {
  constructor(
    private mapCols: number,
    private mapRows: number,
    private collisionLayers: number[][][], // walls, furniture, collision 레이어
    private blockedTiles: Set<string> = new Set(),
  ) {}

  isWalkable(col: number, row: number): boolean {
    // 경계 체크
    if (col < 0 || col >= this.mapCols || row < 0 || row >= this.mapRows) return false;
    // 충돌 레이어: 타일 인덱스 >= 0이면 충돌
    for (const layer of this.collisionLayers) {
      if (layer[row]?.[col] !== undefined && layer[row][col] >= 0) return false;
    }
    // 가구 blocked
    if (this.blockedTiles.has(`${col},${row}`)) return false;
    return true;
  }

  addBlocked(col: number, row: number): void { ... }
  removeBlocked(col: number, row: number): void { ... }
}
```

충돌 레이어 소스: `COLLISION_LAYER_NAMES = ["walls", "furniture", "collision"]`
MainScene의 `initTileCollision()`에서 Phaser `TilemapLayer.getTileAt(col, row)`로 raw 데이터 추출 → 주입.

#### InputController 인터페이스 변경 (`input-controller.ts`)

```typescript
// 이전
interface MovementInput { velocityX: number; velocityY: number; ... }

// 이후
interface MovementInput {
  dx: number; // -1 | 0 | 1
  dy: number; // -1 | 0 | 1
  direction: Direction;
  isMoving: boolean;
}
```

대각선 입력 시 dx != 0 && dy != 0인 경우, `direction`은 항상 측면(left/right) 우선 반환.

**Shift + 방향 = 방향 전환만 (이동 없음)**:

```typescript
// Shift 키 감지 — cursors.shift (Phaser 내장)
const shiftHeld = this.cursors.shift.isDown;
const isMoving = hasDirection && !shiftHeld;

return {
  dx: isMoving ? dx : 0,   // Shift 시 0 반환
  dy: isMoving ? dy : 0,   // Shift 시 0 반환
  direction: this.lastDirection, // 방향은 항상 갱신
  isMoving,
};
```

제약:
- `this.cursors.shift`는 Phaser `createCursorKeys()`에 포함된 내장 키 — 별도 `addKey()` 불필요
- Shift 중에는 `direction`만 갱신되고 `dx/dy = 0` → LocalPlayer는 `isStepping` 진입 안 함
- 캐릭터는 제자리에서 방향만 전환 (ZEP/게더타운 캐릭터 방향 조작과 동일)

#### LocalPlayer 이동 루프 (`local-player.ts`)

이전: `Physics.Arcade.Sprite` + `setVelocity(velocityX, velocityY)` → 프레임마다 연속 이동.
이후: `GameObjects.Sprite` + `logicalX/logicalY` 분리 + Tween 1칸 이동.

**핵심 아키텍처**: logicalX/logicalY (이동) + jumpState.offsetY (시각 전용) 분리
- Step Tween → `this.logicalX/logicalY` (sprite.x/y 직접 변경 안 함)
- Jump Tween → `this.jumpState` (별도 객체 — 이동 Tween과 Phaser 타겟 충돌 방지)
- 매 프레임 `syncVisuals()`: `sprite.y = logicalY + jumpState.offsetY`

> **분리 이유**: Phaser Tween은 같은 `targets` 객체에 동시 적용 시 간섭 발생.
> 이동 Tween(`targets: this`, logicalX/Y)과 점프 Tween(`targets: this.jumpState`, offsetY)이
> 서로 다른 객체를 타겟으로 하여 독립 동작 보장.

```typescript
// 핵심 상태
private logicalX: number;              // Tween 대상 (타일 중심 좌표)
private logicalY: number;              // Tween 대상 (타일 중심 좌표)
private jumpState = { offsetY: 0 };    // 시각 전용 별도 객체 (logicalY와 독립)
private tileCol: number;
private tileRow: number;
private isStepping = false;
private isIdle = true;
private lastStepEndTime = 0; // idle 전환 grace period (80ms)

private startStep(col: number, row: number, dir: Direction): void {
  this.isStepping = true;
  const isDiagonal = col !== this.tileCol && row !== this.tileRow;
  const duration = isDiagonal
    ? Math.round(TILE_STEP_DURATION * Math.SQRT2) // 184ms (속도 보정)
    : TILE_STEP_DURATION; // 130ms
  this.sprite.anims.play(`player-walk-${dir}`, true);
  this.scene.tweens.add({
    targets: this,              // logicalX/logicalY Tween
    logicalX: col * TILE_SIZE + TILE_HALF,
    logicalY: row * TILE_SIZE + TILE_HALF,
    duration,
    ease: "Linear",
    onComplete: () => {
      this.tileCol = col;
      this.tileRow = row;
      this.isStepping = false;
      this.lastStepEndTime = this.scene.time.now;
      this.emitMovement(true);
    },
  });
}

private syncVisuals(): void {
  const visualY = this.logicalY + this.jumpState.offsetY;
  this.sprite.setPosition(this.logicalX, visualY);
  this.nameText.setPosition(this.logicalX, visualY + NAME_OFFSET_Y);
  this.shadow.setPosition(this.logicalX, this.logicalY + 28);
  // 그림자: 점프 높이 비례 축소/투명화
}
```

제약:
- `isStepping = true`인 동안 입력 무시 → 타일 경계에서만 방향 전환 가능
- 대각선 이동 지원: 대각 타일 → 수평만 → 수직만 순서로 fallback
- 대각선 √2 duration 보정: 이동 속도 일정 유지
- idle 전환: 80ms grace period + isIdle 플래그 (유령 스텝 방지)
- 걷기 애니메이션: frameRate 12 (8→12, 130ms 스텝에 ~1.6프레임)
- 스폰 위치: `col=20, row=27` (문 앞), 픽셀 = `col * 32 + 16`

#### RemotePlayerSprite LERP 동기화 (`remote-player-sprite.ts`)

```typescript
const LERP_DURATION = 130; // ms (로컬 TILE_STEP_DURATION과 동기화, 이전 150ms)
```

로컬 플레이어의 타일 스텝 완료 시점에 네트워크 이벤트가 발행되므로, 원격 플레이어의 LERP 시간을 동일하게 맞춰 시각 지연 최소화.

#### MainScene 초기화 순서 (`main-scene.ts`)

```
initWorld() → initTilemap() → initFurniture() → initTileCollision() → initPlayer()
```

`initTileCollision()`이 `initPlayer()` 앞에 위치해야 함 — LocalPlayer 생성 후 `setCollisionChecker()` 주입.
Arcade Physics 충돌 설정(`addCollider`) 전면 제거.

### 게임 적용 (계속)

- [x] Task 12.32: AI 캐릭터 정적 에셋 전환 (런타임 API 의존 → Phaser preload 정적 로드)

## 구현 상세 (Task 12.32)

### AI 캐릭터 정적 에셋 전환

런타임에 `/api/assets` API를 호출하여 DB에서 AI 캐릭터 목록을 가져오던 방식을 제거하고, 5종 치비 캐릭터를 코드 상수로 정의하여 Phaser `preload()`에서 정적으로 로드하는 방식으로 전환.

**신규 파일: `src/features/space/avatar/internal/chibi-characters.ts`**

```typescript
export interface ChibiCharacterDef {
  id: string;
  name: string;
  spritePath: string;
}

export const CHIBI_CHARACTERS: readonly ChibiCharacterDef[] = [
  { id: "c02", name: "Maid",            spritePath: "/assets/generated/c02_spritesheet_96x128.png" },
  { id: "c03", name: "Goggle Boy",      spritePath: "/assets/generated/c03_spritesheet_96x128.png" },
  { id: "c04", name: "Glasses Girl",    spritePath: "/assets/generated/c04_spritesheet_96x128.png" },
  { id: "c05", name: "White Hair Boy",  spritePath: "/assets/generated/c05_spritesheet_96x128.png" },
  { id: "c07", name: "Ribbon Girl",     spritePath: "/assets/generated/c07_spritesheet_96x128.png" },
] as const;

export function getChibiTextureKey(characterId: string): string {
  return `chibi_${characterId}`;
}
```

**`avatar-types.ts`: ChibiAvatarConfig 추가**

```typescript
export interface ChibiAvatarConfig {
  type: "chibi";
  characterId: string; // "c02" | "c03" | "c04" | "c05" | "c07"
}

export type AvatarConfig =
  | ClassicAvatarConfig
  | CustomAvatarConfig
  | PartsAvatarConfig
  | ChibiAvatarConfig; // 추가
```

**`avatar-config.ts`: chibi 파싱 + custom→chibi 하위 호환 매핑**

```typescript
// "chibi:c02" 파싱
if (type === "chibi" && data) {
  return { type: "chibi", characterId: data };
}

// 기존 "custom:character_xxx" → chibi 자동 매핑 (DB 저장값 하위 호환)
if (type === "custom" && data) {
  const chibiId = matchCustomToChibi(data); // ch.id 포함 여부로 매핑
  if (chibiId) return { type: "chibi", characterId: chibiId };
  return { type: "custom", textureKey: data };
}

function matchCustomToChibi(textureKey: string): string | null {
  for (const ch of CHIBI_CHARACTERS) {
    if (textureKey.includes(ch.id)) return ch.id;
  }
  return null;
}
```

**`sprite-generator.ts`: chibi 타입 즉시 반환**

```typescript
if (config.type === "chibi") {
  const key = getTextureKey(config); // "chibi_c02" 등
  if (scene.textures.exists(key)) return key; // preload 완료 → 즉시 반환
  return generatePartsSprite(scene, DEFAULT_PARTS_AVATAR); // fallback
}
```

**`main-scene.ts`: preload()에 치비 스프라이트시트 일괄 로드**

```typescript
for (const ch of CHIBI_CHARACTERS) {
  this.load.spritesheet(getChibiTextureKey(ch.id), ch.spritePath, {
    frameWidth: PLAYER_WIDTH,   // 96
    frameHeight: PLAYER_HEIGHT, // 128
  });
}
```

**`avatar-editor-modal.tsx`: API 호출 제거 → CHIBI_CHARACTERS 직접 렌더**

- `aiCharacters` state + `useEffect` fetch 제거
- `selectedCustomId` → `selectedChibiId` (값: `"c02"` 등 ID 직접 사용)
- 저장 시 `avatarString = chibi:${selectedChibiId}` (이전: `custom:character_${uuid}`)
- `ChibiThumbnail` 컴포넌트 신규 추가: 스프라이트시트 첫 프레임(0,0) canvas로 추출하여 썸네일 표시

```typescript
function ChibiThumbnail({ spritePath, alt }: { spritePath: string; alt: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.src = spritePath;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 96, 128, 0, 0, 96, 128); // 첫 프레임만 추출
    };
  }, [spritePath]);
  return <canvas ref={canvasRef} width={96} height={128} ... />;
}
```

**부수 변경: `prisma/schema.prisma` + `src/app/api/assets/route.ts`**

- `GeneratedAsset` 모델에 `isShared Boolean @default(false)` 필드 추가
- `@@index([isShared, status, type])` 인덱스 추가
- `/api/assets?shared=true` 쿼리 지원 (공용 에셋 조회, IDOR 예외 처리)
  - `shared=true` 시 `where.isShared = true` (userId 필터 미적용)
  - 미지정 시 기존 동작 유지 (`where.userId = session.user.id`)

**`local-player.ts`: Shift+방향 전환 버그 수정 (부수 수정)**

- `setIdle()`: early return을 `anims.stop()`에만 적용 → `setFrame()`은 항상 실행
- `update()`: `!isMoving && direction !== currentDirection` 시 `setIdle(direction)` + `emitMovement(false)` 즉시 호출
- 점프 중 하향 이동 시 `jy *= 1.5` 보정 (`syncVisuals()` 내 조건 추가)

## 다음 작업
1. 충돌 영역 정밀화 (가구별 blocked 타일 등록)
2. Y-sorting (깊이 정렬)
3. 가구/오브젝트 AI 생성 방안 결정
