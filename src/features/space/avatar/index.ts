// Avatar Module - Public API
export type {
  AvatarConfig,
  ClassicAvatarConfig,
  CustomAvatarConfig,
  PartsAvatarConfig,
  Direction,
} from "./internal/avatar-types";
export { DIRECTION_FRAMES, IDLE_FRAMES } from "./internal/avatar-types";

export {
  parseAvatarString,
  getTextureKey,
  DEFAULT_AVATAR,
  DEFAULT_PARTS_AVATAR,
} from "./internal/avatar-config";

export { generateAvatarSprite, generateAvatarSpriteFromConfig } from "./internal/sprite-generator";

// Parts system
export type {
  PartCategory,
  PartDefinition,
  SelectedPart,
  PartsAvatarConfig as PartsConfig,
} from "./internal/parts/parts-types";
export { LAYER_ORDER } from "./internal/parts/parts-types";

export { parsePartsString, buildPartsAvatarString } from "./internal/parts/parts-string";

export {
  getPartsByCategory,
  CATEGORY_LABELS,
} from "./internal/parts/parts-registry";

export { generatePartsSprite, renderPartsPreview } from "./internal/parts/parts-compositor";
