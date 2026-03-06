"""
Office Tileset Generator — ComfyUI로 오피스 테마 타일 개별 생성 후 타일셋 시트 조립

사용법:
  python scripts/generate-office-tileset.py --generate   # ComfyUI로 개별 타일 생성
  python scripts/generate-office-tileset.py --assemble    # 타일셋 시트 조립
  python scripts/generate-office-tileset.py --all         # 생성 + 조립

출력:
  ComfyUI/output/tileset/individual/  — 개별 타일 (512x512)
  ComfyUI/output/tileset/office_tileset.png — 완성 타일셋 (512x448, 16x14 grid, 32x32 per tile)
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from PIL import Image

COMFYUI_URL = "http://localhost:8000"
OUTPUT_DIR = "C:/Users/User/ComfyUI/output/tileset"
INDIVIDUAL_DIR = os.path.join(OUTPUT_DIR, "individual")

TILE_SIZE = 32
TILESET_COLS = 16
TILESET_ROWS = 14
TILESET_W = TILESET_COLS * TILE_SIZE  # 512
TILESET_H = TILESET_ROWS * TILE_SIZE  # 448

# Animagine XL 설정
CHECKPOINT = "animagineXL31_v31.safetensors"
QUALITY_TAGS = "masterpiece, best quality, very aesthetic, absurdres"
NEGATIVE = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, 3d, realistic, photo"

# 오피스 타일 정의: (파일명, 프롬프트, 타일셋 위치 (col, row))
OFFICE_TILES = [
    # Ground tiles (row 0)
    ("floor_carpet_grey", "simple office carpet floor texture, grey, top-down view, flat, seamless pattern, no furniture, game asset", 0, 0),
    ("floor_carpet_blue", "simple office carpet floor texture, dark blue, top-down view, flat, seamless pattern, no furniture, game asset", 1, 0),
    ("floor_tile_white", "white tile floor texture, top-down view, flat, clean, seamless pattern, game asset", 2, 0),
    ("floor_wood", "wooden parquet floor texture, warm brown, top-down view, flat, seamless pattern, game asset", 3, 0),
    ("floor_carpet_red", "red carpet floor texture, top-down view, flat, seamless pattern, game asset", 4, 0),
    ("floor_marble", "marble floor texture, white grey, top-down view, flat, seamless pattern, game asset", 5, 0),
    ("floor_water_cooler_area", "small tiled floor area, light blue accent, top-down view, flat, game asset", 6, 0),
    ("floor_hallway", "office hallway floor, beige carpet runner, top-down view, flat, seamless, game asset", 7, 0),

    # Walls (row 2)
    ("wall_top", "office wall top section, white wall with thin baseboard, top-down view, anime style, game asset", 0, 2),
    ("wall_mid", "office wall middle section, plain white, top-down view, anime style, game asset", 1, 2),
    ("wall_bottom", "office wall bottom with baseboard, grey trim, top-down view, anime style, game asset", 2, 2),
    ("wall_left", "office wall left edge, white with shadow, top-down view, game asset", 3, 2),
    ("wall_right", "office wall right edge, white with shadow, top-down view, game asset", 4, 2),
    ("wall_corner_tl", "office wall top-left corner, white, top-down view, game asset", 5, 2),
    ("wall_corner_tr", "office wall top-right corner, white, top-down view, game asset", 6, 2),
    ("wall_corner_bl", "office wall bottom-left corner, white, top-down view, game asset", 7, 2),
    ("wall_corner_br", "office wall bottom-right corner, white, top-down view, game asset", 8, 2),
    ("wall_inner", "office interior wall, plain white surface, top-down view, game asset", 9, 2),
    ("wall_door", "office wooden door, brown with silver handle, front view, anime style, game asset", 10, 2),

    # Furniture (row 4-5)
    ("desk_left", "office desk left half, wooden desk with drawer, top-down view, anime style, simple, game asset", 0, 4),
    ("desk_right", "office desk right half, wooden desk, top-down view, anime style, simple, game asset", 1, 4),
    ("chair_office", "office swivel chair, black, top-down view, anime style, simple, game asset", 2, 4),
    ("bookshelf_top", "tall office bookshelf top half, filled with books and files, front view, anime style, game asset", 3, 4),
    ("bookshelf_bottom", "tall office bookshelf bottom half, filled with binders, front view, anime style, game asset", 4, 4),
    ("sofa_left", "office sofa left half, grey fabric, top-down view, anime style, game asset", 5, 4),
    ("sofa_right", "office sofa right half, grey fabric, top-down view, anime style, game asset", 6, 4),
    ("table_coffee", "small coffee table, wooden, top-down view, anime style, simple, game asset", 7, 4),
    ("cabinet_filing", "office filing cabinet, grey metal, front view, anime style, game asset", 8, 4),
    ("whiteboard_top", "office whiteboard top half, white surface with notes, front view, anime style, game asset", 9, 4),
    ("whiteboard_bottom", "office whiteboard bottom half, metal tray with markers, front view, anime style, game asset", 10, 4),

    # Furniture tops / small items (row 6)
    ("monitor", "computer monitor on desk, black screen with code, top-down view, anime style, game asset", 0, 6),
    ("plant_pot", "small office plant in pot, green succulent, top-down view, anime style, cute, game asset", 1, 6),
    ("desk_lamp", "office desk lamp, silver, top-down view, anime style, game asset", 2, 6),
    ("documents", "stack of office documents and papers, top-down view, anime style, game asset", 3, 6),
    ("coffee_cup", "office coffee mug, white with steam, top-down view, anime style, cute, game asset", 4, 6),

    # Decorations (row 7-8)
    ("plant_tall_top", "tall indoor office plant top half, monstera leaves, front view, anime style, game asset", 0, 7),
    ("plant_tall_bottom", "tall indoor plant bottom half, brown pot, front view, anime style, game asset", 1, 7),
    ("water_cooler", "office water cooler dispenser, white and blue, front view, anime style, game asset", 2, 7),
    ("trash_bin", "office trash bin, grey metal, front view, anime style, simple, game asset", 3, 7),
    ("printer", "office printer, white and grey, front view, anime style, game asset", 4, 7),
    ("clock_wall", "office wall clock, simple round, front view, anime style, game asset", 5, 7),
    ("coatrack", "office coat rack, wooden with jacket, front view, anime style, game asset", 6, 7),
    ("vending_top", "office vending machine top half, snacks visible, front view, anime style, game asset", 7, 7),
    ("vending_bottom", "office vending machine bottom half, coin slot, front view, anime style, game asset", 8, 7),

    # Interactive (row 9)
    ("portal_elevator", "office elevator doors, silver metallic, front view, anime style, game asset", 0, 9),
    ("spawn_reception", "reception desk area marker, green glow, top-down view, anime style, game asset", 1, 9),
    ("safe_box", "office safe box, dark grey metal, front view, anime style, game asset", 2, 9),
    ("npc_receptionist", "chibi office receptionist, front view, anime style, cute, game asset", 3, 9),
]


def enqueue_workflow(prompt_text: str, filename_prefix: str, seed: int = 42) -> str:
    """ComfyUI에 txt2img 워크플로우 큐잉"""
    workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 25,
                "cfg": 7.0,
                "sampler_name": "euler_ancestral",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": f"{prompt_text}, {QUALITY_TAGS}",
                "clip": ["4", 1],
            },
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": NEGATIVE,
                "clip": ["4", 1],
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": f"tileset/{filename_prefix}",
                "images": ["8", 0],
            },
        },
    }

    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        return result.get("prompt_id", "")
    except urllib.error.URLError as e:
        print(f"  [ERROR] {e}")
        return ""


def wait_for_completion(prompt_id: str, timeout: int = 120) -> bool:
    """워크플로우 완료 대기"""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}")
            history = json.loads(resp.read())
            if prompt_id in history:
                return True
        except Exception:
            pass
        time.sleep(2)
    return False


def generate_tiles():
    """ComfyUI로 개별 타일 이미지 생성"""
    os.makedirs(INDIVIDUAL_DIR, exist_ok=True)

    total = len(OFFICE_TILES)
    for i, (name, prompt, col, row) in enumerate(OFFICE_TILES):
        # 이미 생성된 파일 스킵
        existing = [f for f in os.listdir(os.path.join(OUTPUT_DIR)) if f.startswith(name) and f.endswith(".png")]
        if existing:
            print(f"[{i+1}/{total}] SKIP {name} (already exists)")
            continue

        print(f"[{i+1}/{total}] Generating {name}...")
        prompt_id = enqueue_workflow(prompt, name, seed=42 + i)
        if not prompt_id:
            print(f"  [FAIL] Could not queue {name}")
            continue

        if wait_for_completion(prompt_id, timeout=180):
            print(f"  [OK] {name}")
        else:
            print(f"  [TIMEOUT] {name}")


def assemble_tileset():
    """개별 타일을 타일셋 시트로 조립"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 빈 타일셋 (투명 배경)
    tileset = Image.new("RGBA", (TILESET_W, TILESET_H), (0, 0, 0, 0))

    # 기본 배경색 (오피스 바닥)
    default_floor = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (180, 180, 190, 255))

    placed = 0
    missing = 0

    for name, prompt, col, row in OFFICE_TILES:
        # ComfyUI 출력 파일 찾기
        tile_img = None
        tileset_subdir = os.path.join(OUTPUT_DIR)

        # ComfyUI는 filename_prefix에 서브폴더를 포함하면 output/tileset/ 아래에 저장
        for f in sorted(os.listdir(tileset_subdir)):
            if f.startswith(name) and f.endswith(".png"):
                tile_path = os.path.join(tileset_subdir, f)
                tile_img = Image.open(tile_path).convert("RGBA")
                break

        if tile_img is None:
            print(f"  [MISSING] {name} at ({col},{row}) — using default")
            tile_img = default_floor
            missing += 1
        else:
            # 512x512 → 32x32 리사이즈
            tile_img = tile_img.resize((TILE_SIZE, TILE_SIZE), Image.LANCZOS)
            placed += 1

        # 타일셋에 배치
        x = col * TILE_SIZE
        y = row * TILE_SIZE
        tileset.paste(tile_img, (x, y))

    # Collision marker (row 13) — nearly invisible red
    collision = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (255, 0, 0, 3))
    tileset.paste(collision, (0, 13 * TILE_SIZE))

    # 저장
    output_path = os.path.join(OUTPUT_DIR, "office_tileset.png")
    tileset.save(output_path)
    print(f"\n[DONE] Tileset saved: {output_path}")
    print(f"  Placed: {placed}, Missing: {missing}, Total tiles: {len(OFFICE_TILES)}")

    # 4x 프리뷰
    preview = tileset.resize((TILESET_W * 4, TILESET_H * 4), Image.NEAREST)
    preview_path = os.path.join(OUTPUT_DIR, "office_tileset_preview_4x.png")
    preview.save(preview_path)
    print(f"  Preview: {preview_path}")


def main():
    parser = argparse.ArgumentParser(description="Office tileset generator")
    parser.add_argument("--generate", action="store_true", help="Generate tiles with ComfyUI")
    parser.add_argument("--assemble", action="store_true", help="Assemble tileset from generated tiles")
    parser.add_argument("--all", action="store_true", help="Generate + assemble")
    args = parser.parse_args()

    if args.all or args.generate:
        generate_tiles()

    if args.all or args.assemble:
        assemble_tileset()

    if not (args.generate or args.assemble or args.all):
        print("Usage: --generate, --assemble, or --all")


if __name__ == "__main__":
    main()
