---
paths:
  - "src/features/assets/**"
  - "src/lib/comfyui/**"
  - "src/features/space/game/**"
  - "src/features/space/avatar/**"
  - "public/assets/**"
---

# Asset Specification

## Asset Types

### Character Sprite
| Property | Value |
|----------|-------|
| Format | PNG, transparent background |
| Grid | 8 columns x 4 rows |
| Frame Size | 64 x 64 px |
| Total Size | 512 x 256 px |
| Directions | Down, Left, Right, Up (rows) |
| Frames per Direction | 8 (idle + walk cycle) |
| Naming | `character_{name}_{variant}.png` |

### Tileset
| Property | Value |
|----------|-------|
| Format | PNG |
| Grid | 16 columns x 14 rows |
| Tile Size | 32 x 32 px |
| Total Size | 512 x 448 px |
| Naming | `tileset_{name}_{variant}.png` |

### Object Sprite
| Property | Value |
|----------|-------|
| Format | PNG, transparent background |
| Max Size | 128 x 128 px |
| Naming | `object_{name}_{variant}.png` |

### Map Background
| Property | Value |
|----------|-------|
| Format | PNG |
| Size | Configurable (default 1024 x 768) |
| Naming | `map_{name}_{variant}.png` |

## GeneratedAssetMetadata Interface

```typescript
interface GeneratedAssetMetadata {
  id: string;
  type: 'character' | 'tileset' | 'object' | 'map';
  name: string;
  prompt: string;
  workflow: string;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  rows?: number;
  filePath: string;
  thumbnailPath?: string;
  fileSize: number;
  format: 'png';
  comfyuiJobId?: string;
  seed?: number;
  generatedAt: string;
  processingTime: number; // ms
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

## Validation Rules

- **Character**: 512x256px, alpha channel, 32 frames non-empty
- **Tileset**: 512x448px, grid-aligned (no sub-pixel offset)
- **Object**: <=128x128px, transparent background, subject centered
- **Map Background**: >=512x384px, no transparency required

## File Storage

```
public/assets/generated/
├── characters/    character_{name}_{variant}.png
├── tilesets/      tileset_{name}_{variant}.png
├── objects/       object_{name}_{variant}.png
├── maps/          map_{name}_{variant}.png
└── thumbnails/    thumb_{assetId}.png
```
