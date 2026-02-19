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

  // Dimensions
  width: number;
  height: number;
  frameWidth?: number;   // For spritesheets
  frameHeight?: number;  // For spritesheets
  columns?: number;      // Grid columns
  rows?: number;         // Grid rows

  // File info
  filePath: string;
  thumbnailPath?: string;
  fileSize: number;
  format: 'png';

  // Generation info
  comfyuiJobId?: string;
  seed?: number;
  generatedAt: string;
  processingTime: number; // ms

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

## Asset Validation Rules

### Character Sprite
1. Image dimensions = 512 x 256 px
2. Transparent background (alpha channel exists)
3. All 32 frames non-empty (no blank frames)

### Tileset
1. Image dimensions = 512 x 448 px
2. Grid-aligned (no sub-pixel offset)

### Object Sprite
1. Width <= 128 px, Height <= 128 px
2. Transparent background
3. Subject centered

### Map Background
1. Minimum 512 x 384 px
2. No transparency required

## File Storage

```
public/assets/generated/
├── characters/
│   └── character_{name}_{variant}.png
├── tilesets/
│   └── tileset_{name}_{variant}.png
├── objects/
│   └── object_{name}_{variant}.png
├── maps/
│   └── map_{name}_{variant}.png
└── thumbnails/
    └── thumb_{assetId}.png
```
