/** 치비 AI 캐릭터 정적 목록 (Phaser preload 대상) */

export interface ChibiCharacterDef {
  id: string;
  name: string;
  spritePath: string;
}

export const CHIBI_CHARACTERS: readonly ChibiCharacterDef[] = [
  { id: "c02", name: "Maid", spritePath: "/assets/generated/c02_spritesheet_96x128.png" },
  { id: "c03", name: "Goggle Boy", spritePath: "/assets/generated/c03_spritesheet_96x128.png" },
  { id: "c04", name: "Glasses Girl", spritePath: "/assets/generated/c04_spritesheet_96x128.png" },
  { id: "c05", name: "White Hair Boy", spritePath: "/assets/generated/c05_spritesheet_96x128.png" },
  { id: "c07", name: "Ribbon Girl", spritePath: "/assets/generated/c07_spritesheet_96x128.png" },
] as const;

/** chibi ID → textureKey (Phaser 내부용) */
export function getChibiTextureKey(characterId: string): string {
  return `chibi_${characterId}`;
}
