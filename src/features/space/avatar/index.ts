// Avatar Module - Public API
export type {
  AvatarConfig,
  ClassicAvatarConfig,
  CustomAvatarConfig,
  Direction,
} from "./internal/avatar-types";
export { DIRECTION_FRAMES, IDLE_FRAMES } from "./internal/avatar-types";

export {
  parseAvatarString,
  getTextureKey,
  DEFAULT_AVATAR,
} from "./internal/avatar-config";

export { generateAvatarSprite } from "./internal/sprite-generator";
