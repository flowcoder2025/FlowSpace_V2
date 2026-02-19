/**
 * Asset Registry
 *
 * flow_metaverse의 asset-registry.ts를 기반으로 한 에셋 메타데이터 레지스트리
 * 배치 가능한 모든 오브젝트를 정의합니다.
 */

export type PlacementType = "point" | "area";

export interface AssetMetadata {
  id: string;
  name: string;
  aliases: string[];
  categoryId: string;
  thumbnail?: string;
  requiresPair: boolean;
  pairConfig?: {
    type: string;
    labels: { first: string; second: string };
    linkProperty: string;
  };
  placementType?: PlacementType;
  rotatable: boolean;
  snapToGrid: boolean;
  collisionEnabled: boolean;
  size: { width: number; height: number };
  description?: string;
}

export const ASSET_REGISTRY: AssetMetadata[] = [
  // Interactive
  {
    id: "party-zone",
    name: "Party Zone",
    aliases: ["파티존", "party", "zone"],
    categoryId: "interactive",
    requiresPair: false,
    placementType: "area",
    rotatable: false,
    snapToGrid: true,
    collisionEnabled: false,
    size: { width: 1, height: 1 },
    description: "같은 영역 내 사용자끼리만 음성/채팅이 연결되는 파티 존",
  },
  {
    id: "portal",
    name: "Portal",
    aliases: ["포털", "portal", "teleport"],
    categoryId: "interactive",
    requiresPair: true,
    pairConfig: {
      type: "portal",
      labels: { first: "입구 위치를 선택하세요", second: "출구 위치를 선택하세요" },
      linkProperty: "destinationId",
    },
    rotatable: false,
    snapToGrid: true,
    collisionEnabled: false,
    size: { width: 1, height: 1 },
    description: "다른 위치로 순간이동하는 포털",
  },
  {
    id: "spawn_point",
    name: "Spawn Point",
    aliases: ["스폰", "spawn", "시작점"],
    categoryId: "interactive",
    requiresPair: false,
    rotatable: true,
    snapToGrid: true,
    collisionEnabled: false,
    size: { width: 1, height: 1 },
    description: "플레이어가 입장하는 시작 위치",
  },

  // Furniture
  {
    id: "chair_wooden",
    name: "Wooden Chair",
    aliases: ["의자", "chair"],
    categoryId: "furniture",
    requiresPair: false,
    rotatable: true,
    snapToGrid: true,
    collisionEnabled: true,
    size: { width: 1, height: 1 },
  },
  {
    id: "desk_wooden",
    name: "Wooden Desk",
    aliases: ["책상", "desk", "table"],
    categoryId: "furniture",
    requiresPair: false,
    rotatable: true,
    snapToGrid: true,
    collisionEnabled: true,
    size: { width: 2, height: 1 },
  },

  // Decoration
  {
    id: "tree",
    name: "Tree",
    aliases: ["나무", "tree"],
    categoryId: "decoration",
    requiresPair: false,
    rotatable: false,
    snapToGrid: true,
    collisionEnabled: true,
    size: { width: 1, height: 2 },
  },
  {
    id: "plant_pot",
    name: "Plant Pot",
    aliases: ["화분", "plant"],
    categoryId: "decoration",
    requiresPair: false,
    rotatable: false,
    snapToGrid: true,
    collisionEnabled: true,
    size: { width: 1, height: 1 },
  },

  // Wall
  {
    id: "wall_basic",
    name: "Basic Wall",
    aliases: ["벽", "wall"],
    categoryId: "wall",
    requiresPair: false,
    rotatable: false,
    snapToGrid: true,
    collisionEnabled: true,
    size: { width: 1, height: 1 },
  },

  // Floor
  {
    id: "floor_wood",
    name: "Wood Floor",
    aliases: ["나무바닥", "wood floor"],
    categoryId: "floor",
    requiresPair: false,
    rotatable: false,
    snapToGrid: true,
    collisionEnabled: false,
    size: { width: 1, height: 1 },
  },
];

export function getAssetById(id: string): AssetMetadata | undefined {
  return ASSET_REGISTRY.find((asset) => asset.id === id);
}

export function getAssetsByCategory(categoryId: string): AssetMetadata[] {
  return ASSET_REGISTRY.filter((asset) => asset.categoryId === categoryId);
}

export function searchAssets(keyword: string): AssetMetadata[] {
  const lower = keyword.toLowerCase();
  return ASSET_REGISTRY.filter(
    (asset) =>
      asset.name.toLowerCase().includes(lower) ||
      asset.aliases.some((a) => a.toLowerCase().includes(lower))
  );
}
