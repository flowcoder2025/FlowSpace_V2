/**
 * Parts Registry - 파츠 카탈로그 등록/조회
 *
 * 모든 사용 가능한 파츠와 드로어 관리
 */

import type { PartDefinition, PartCategory, PartDrawer } from "./parts-types";

/** 파츠 정의 저장소 */
const partDefinitions = new Map<string, PartDefinition>();

/** 파츠 드로어 저장소 */
const partDrawers = new Map<string, PartDrawer>();

/** 카테고리별 파츠 ID 인덱스 */
const categoryIndex = new Map<PartCategory, string[]>();

/** 파츠 등록 */
export function registerPart(def: PartDefinition, drawer: PartDrawer): void {
  partDefinitions.set(def.id, def);
  partDrawers.set(def.id, drawer);

  const ids = categoryIndex.get(def.category) ?? [];
  if (!ids.includes(def.id)) {
    ids.push(def.id);
    categoryIndex.set(def.category, ids);
  }
}

/** 파츠 정의 조회 */
export function getPartDefinition(partId: string): PartDefinition | undefined {
  return partDefinitions.get(partId);
}

/** 파츠 드로어 조회 */
export function getPartDrawer(partId: string): PartDrawer | undefined {
  return partDrawers.get(partId);
}

/** 카테고리별 파츠 목록 */
export function getPartsByCategory(category: PartCategory): PartDefinition[] {
  const ids = categoryIndex.get(category) ?? [];
  return ids.map((id) => partDefinitions.get(id)!).filter(Boolean);
}

/** 전체 카테고리 목록 (UI 탭용) */
export const CATEGORY_LABELS: Record<PartCategory, string> = {
  body: "Body",
  hair: "Hair",
  eyes: "Eyes",
  top: "Top",
  bottom: "Bottom",
  accessory: "Accessory",
};
