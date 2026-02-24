"""
불량 학습 데이터 재생성 — v3 프롬프트 (anime coloring, clean lineart)
캐릭터별 일관성 확보를 위해 GOOD 이미지의 색상/디자인 기준으로 프롬프트 작성
"""
import json
import urllib.request
import time

COMFYUI_URL = "http://127.0.0.1:8000"

COMMON_POS_PREFIX = "masterpiece, best quality, very aesthetic, absurdres, chibi, 2-head-tall, full body, simple_background, green_background, standing, anime coloring, clean lineart, game sprite"
COMMON_NEG = "nsfw, lowres, bad quality, worst quality, text, watermark, realistic, photorealistic, 3d render, multiple characters, multiple views, deformed, silhouette, shadow, dark, backlighting, monochrome, greyscale, flat color, minimal detail"

DIRECTION_TAGS = {
    "front": "front view, looking_at_viewer",
    "side": "from_side, anime coloring, clean lineart",
    "back": "from_behind, facing_away, back view, anime coloring, clean lineart",
}

# 재생성 목록 — GOOD 이미지의 색상/디자인과 일치하도록 프롬프트 구성
REGENERATE = [
    # c01: back(실루엣), front2(어두운얼굴)
    ("c01", "back", "1boy, suit, necktie, briefcase, short brown hair, brown eyes", 110001),
    ("c01", "front", "1boy, suit, necktie, briefcase, short brown hair, brown eyes", 110002),

    # c02: back(실루엣)
    ("c02", "back", "1girl, white blouse, black skirt, laptop, long black hair, brown eyes", 120001),

    # c03: side(머리색변경), back(어두움)
    ("c03", "side", "1boy, green hoodie, glasses, headphones, messy black hair, green eyes", 130001),
    ("c03", "back", "1boy, green hoodie, glasses, headphones, messy black hair", 130002),

    # c04: back(디테일없음)
    ("c04", "back", "1girl, orange sweater, skirt, glasses, short brown hair", 140001),

    # c05: side(비율깨짐), back(어두움)
    ("c05", "side", "1boy, dark vest, white dress_shirt, necktie, glasses, gray hair, blue eyes", 150001),
    ("c05", "back", "1boy, dark vest, white dress_shirt, glasses, gray hair", 150002),

    # c08: side+side2(머리색변경) — 정면은 갈색 포니테일
    ("c08", "side", "1girl, white apron, coffee_cup, brown ponytail, brown hair, barista", 180001),
    ("c08", "side", "1girl, white apron, coffee_cup, brown ponytail, brown hair, barista", 180002),

    # c10: side(완전다른캐릭터) — 정면은 은투구+빨간망토
    ("c10", "side", "1boy, silver armor, red cape, sword, silver helmet, blue eyes, knight", 1100001),

    # c11: side+side2(로브색변경) — 정면은 보라모자+흰로브
    ("c11", "side", "1girl, white robe, purple wizard_hat, staff, magic, long lavender hair, purple eyes", 1110001),
    ("c11", "side", "1girl, white robe, purple wizard_hat, staff, magic, long lavender hair, purple eyes", 1110002),
]


def make_workflow(prompt: str, neg: str, seed: int, prefix: str) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL31_v31.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["4", 0], "seed": seed, "steps": 25, "cfg": 7,
            "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1
        }},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"regen/{prefix}"}}
    }


def enqueue(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result.get("prompt_id", "unknown")


def main():
    total = 0
    for char, direction, char_tags, seed in REGENERATE:
        dir_tags = DIRECTION_TAGS[direction]
        prompt = f"{COMMON_POS_PREFIX}, {char_tags}, {dir_tags}"

        # seed 변형으로 2장씩 생성 (선택 여지)
        for s_offset in [0, 100]:
            actual_seed = seed + s_offset
            prefix = f"{char}_{direction}_regen_{actual_seed}"
            wf = make_workflow(prompt, COMMON_NEG, actual_seed, prefix)
            pid = enqueue(wf)
            total += 1
            print(f"[{total:02d}] {char}_{direction} seed={actual_seed} -> {pid[:8]}...")

    print(f"\nTotal: {total} regeneration images queued")


if __name__ == "__main__":
    main()
