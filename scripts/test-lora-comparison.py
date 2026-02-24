"""
LoRA 비교 테스트: flowspace-chibi vs yuugiri
동일 seed/프롬프트로 32프레임 스프라이트시트 2장 생성 → 분석기 비교
"""
import json
import urllib.request
import urllib.parse
import time
import uuid
import io
import os
import sys
from pathlib import Path

# PIL for spritesheet composition
from PIL import Image

COMFYUI_URL = "http://127.0.0.1:8000"
BASE_SEED = 42
DIRECTIONS = ["down", "left", "right", "up"]
FRAMES_PER_DIR = 8
FRAME_SIZE = 128  # final sprite frame size

# Prompt building
CHIBI_PREFIX = "masterpiece, best quality, chibi, full body, solo, simple background, white background"
CHIBI_NEGATIVE = "realistic, photorealistic, 3d render, blurry, low quality, deformed, ugly, extra limbs, missing limbs, fused limbs, watermark, text, signature, multiple characters, multiple views, pixel art, retro, 8bit"

DIRECTION_PROMPTS = {
    "down": "front view, facing viewer, looking at viewer",
    "left": "from side, side view, facing left, looking left",
    "right": "from side, side view, facing right, looking right",
    "up": "from behind, back view, facing away, looking away",
}

CHARACTER_PROMPT = "brave knight, sword, armor"

# Load workflow template
WORKFLOW_PATH = Path(__file__).parent.parent / "comfyui-workflows" / "character-chibi-frame.json"


def load_workflow():
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Remove _meta before sending to ComfyUI
    meta = data.pop("_meta", {})
    return data, meta


def build_prompt(direction: str, lora_name: str, char_prompt: str) -> str:
    dir_prompt = DIRECTION_PROMPTS[direction]
    base = f"{CHIBI_PREFIX}, {dir_prompt}, {char_prompt}"
    if "flowspace-chibi" in lora_name.lower():
        return f"flowspace_chibi, {base}"
    return base


def queue_prompt(workflow: dict) -> str:
    """Send workflow to ComfyUI and return prompt_id"""
    payload = json.dumps({"prompt": workflow, "client_id": str(uuid.uuid4())}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 120) -> dict:
    """Poll history until prompt completes"""
    start = time.time()
    while time.time() - start < timeout:
        with urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}") as resp:
            history = json.loads(resp.read())
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(2)
    raise TimeoutError(f"Prompt {prompt_id} timed out after {timeout}s")


def download_image(filename: str, subfolder: str = "", img_type: str = "output") -> bytes:
    """Download generated image from ComfyUI"""
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": img_type})
    with urllib.request.urlopen(f"{COMFYUI_URL}/view?{params}") as resp:
        return resp.read()


def remove_white_bg(img: Image.Image, tolerance: int = 30) -> Image.Image:
    """Simple white background removal"""
    img = img.convert("RGBA")
    data = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if r > 255 - tolerance and g > 255 - tolerance and b > 255 - tolerance:
                data[x, y] = (r, g, b, 0)
    return img


def extract_bbox(img: Image.Image, alpha_thresh: int = 10):
    """Extract bounding box of non-transparent pixels"""
    data = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if data[x, y][3] > alpha_thresh:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < min_x:
        return None
    return (min_x, min_y, max_x + 1, max_y + 1)


def normalize_and_resize_frame(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Fit character into target frame, bottom-center anchored"""
    bbox = extract_bbox(img)
    if bbox is None:
        return Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))

    cropped = img.crop(bbox)
    cw, ch = cropped.size

    # Scale to fit within target, preserving aspect ratio
    scale = min(target_w / cw, target_h / ch)
    new_w = max(1, int(cw * scale))
    new_h = max(1, int(ch * scale))
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    # Place bottom-center
    result = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    x_offset = (target_w - new_w) // 2
    y_offset = target_h - new_h
    result.paste(resized, (x_offset, y_offset))
    return result


def generate_spritesheet(lora_name: str, output_path: str):
    """Generate 32-frame spritesheet with given LoRA.
    right = left 좌우반전 (OpenPose 측면 포즈 좌/우 구분 불가)
    """
    print(f"\n{'='*60}")
    print(f"Generating with: {lora_name}")
    print(f"Output: {output_path}")
    print(f"{'='*60}")

    GENERATE_DIRECTIONS = ["down", "left", "up"]  # right 제외
    generated_dir_frames: dict[str, list[Image.Image]] = {}

    for direction in GENERATE_DIRECTIONS:
        dir_idx = DIRECTIONS.index(direction)
        dir_seed = BASE_SEED + dir_idx
        dir_frames = []

        for fi in range(FRAMES_PER_DIR):
            frame_num = dir_idx * FRAMES_PER_DIR + fi + 1
            print(f"  Frame {frame_num}/32 ({direction}_{fi})...", end=" ", flush=True)

            workflow, _ = load_workflow()

            # Set parameters
            prompt_text = build_prompt(direction, lora_name, CHARACTER_PROMPT)
            workflow["6"]["inputs"]["text"] = prompt_text
            workflow["7"]["inputs"]["text"] = CHIBI_NEGATIVE
            workflow["3"]["inputs"]["seed"] = dir_seed
            workflow["3"]["inputs"]["steps"] = 25
            workflow["3"]["inputs"]["cfg"] = 7
            workflow["3"]["inputs"]["sampler_name"] = "euler_ancestral"
            workflow["3"]["inputs"]["scheduler"] = "normal"
            workflow["13"]["inputs"]["lora_name"] = lora_name
            workflow["13"]["inputs"]["strength_model"] = 0.9
            workflow["13"]["inputs"]["strength_clip"] = 0.9
            workflow["12"]["inputs"]["image"] = f"chibi-poses/pose_{direction}_{fi}.png"
            workflow["9"]["inputs"]["filename_prefix"] = f"test_{lora_name.split('.')[0]}_{direction}_{fi}"

            prompt_id = queue_prompt(workflow)
            result = wait_for_completion(prompt_id, timeout=120)

            # Find output image
            outputs = result.get("outputs", {})
            img_info = None
            for node_id, node_output in outputs.items():
                if "images" in node_output:
                    img_info = node_output["images"][0]
                    break

            if not img_info:
                print("FAILED - no output")
                dir_frames.append(Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0)))
                continue

            img_data = download_image(img_info["filename"], img_info.get("subfolder", ""))
            img = Image.open(io.BytesIO(img_data)).convert("RGBA")

            # Remove background
            img = remove_white_bg(img, tolerance=30)

            dir_frames.append(img)
            print(f"OK ({img.size[0]}x{img.size[1]})")

        # Normalize direction frames
        print(f"  Normalizing {direction} frames...")
        normalized = []
        for frame in dir_frames:
            normalized.append(normalize_and_resize_frame(frame, FRAME_SIZE, FRAME_SIZE))
        generated_dir_frames[direction] = normalized

    # right = left 좌우반전 (OpenPose 측면 포즈 좌/우 구분 불가)
    print("  Generating right frames by mirroring left...")
    generated_dir_frames["right"] = [
        frame.transpose(Image.FLIP_LEFT_RIGHT) for frame in generated_dir_frames["left"]
    ]

    # 최종 스프라이트시트 행 순서: down, left, right, up
    all_frames = []
    for direction in DIRECTIONS:
        all_frames.extend(generated_dir_frames[direction])

    # Compose spritesheet (8 cols x 4 rows)
    cols, rows = 8, 4
    sheet = Image.new("RGBA", (cols * FRAME_SIZE, rows * FRAME_SIZE), (0, 0, 0, 0))
    for i, frame in enumerate(all_frames):
        x = (i % cols) * FRAME_SIZE
        y = (i // cols) * FRAME_SIZE
        sheet.paste(frame, (x, y))

    sheet.save(output_path)
    print(f"\nSaved: {output_path} ({sheet.size[0]}x{sheet.size[1]})")
    return output_path


def main():
    output_dir = Path(__file__).parent.parent / "public" / "assets" / "test-lora"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Test 1: flowspace-chibi (epoch 8)
    new_lora = "flowspace-chibi-v1-000008.safetensors"
    new_path = str(output_dir / "spritesheet_flowspace-chibi.png")
    generate_spritesheet(new_lora, new_path)

    # Test 2: yuugiri (baseline)
    old_lora = "yuugiri-lyco-nochekaiser.safetensors"
    old_path = str(output_dir / "spritesheet_yuugiri.png")
    generate_spritesheet(old_lora, old_path)

    print(f"\n{'='*60}")
    print("COMPARISON COMPLETE")
    print(f"  flowspace-chibi: {new_path}")
    print(f"  yuugiri:         {old_path}")
    print(f"{'='*60}")
    print("\nRun analyzer on each:")
    print(f"  npx tsx scripts/analyze-spritesheet.ts {new_path} 8 4")
    print(f"  npx tsx scripts/analyze-spritesheet.ts {old_path} 8 4")


if __name__ == "__main__":
    main()
