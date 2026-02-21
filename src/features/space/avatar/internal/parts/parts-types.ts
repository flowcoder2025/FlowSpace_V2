/**
 * Parts Avatar Type System
 *
 * 파츠 조합 캐릭터의 카테고리, 정의, 드로잉 컨텍스트
 */

/** 파츠 카테고리 (레이어 순서 = 렌더링 순서) */
export type PartCategory = "body" | "bottom" | "top" | "eyes" | "hair" | "accessory";

/** 레이어 렌더링 순서 (아래→위) */
export const LAYER_ORDER: PartCategory[] = [
  "body",
  "bottom",
  "top",
  "eyes",
  "hair",
  "accessory",
];

/** 단일 파츠 정의 */
export interface PartDefinition {
  id: string; // e.g. "body_01", "hair_03"
  category: PartCategory;
  name: string; // 표시 이름
  colorable: boolean; // 색상 변경 가능 여부
  defaultColor?: string; // 기본 색상 (hex)
}

/** 선택된 파츠 (아바타 문자열의 한 구성 요소) */
export interface SelectedPart {
  partId: string; // e.g. "body_01"
  color?: string; // hex color or palette index
}

/** 드로잉 컨텍스트 (각 드로어에 전달) */
export interface PartDrawContext {
  ctx: CanvasRenderingContext2D;
  x: number; // 프레임 좌상단 X
  y: number; // 프레임 좌상단 Y
  direction: number; // 0=down, 1=left, 2=right, 3=up
  frame: number; // 0-3
  yOff: number; // 걷기 애니메이션 Y오프셋
  color: string; // 적용할 색상
}

/** 파츠 드로어 함수 시그니처 */
export type PartDrawer = (dc: PartDrawContext) => void;

/** 파츠 아바타 설정 */
export interface PartsAvatarConfig {
  type: "parts";
  body: SelectedPart;
  hair: SelectedPart;
  eyes: SelectedPart;
  top: SelectedPart;
  bottom: SelectedPart;
  accessory: SelectedPart;
}
