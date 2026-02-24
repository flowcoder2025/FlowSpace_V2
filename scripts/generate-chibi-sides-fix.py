"""
측면 이미지 수정 재생성 — 실루엣 문제 해결
from_side, profile, facing left → side view, looking left, bright colors
"""
import json
import urllib.request

COMFYUI_URL = "http://127.0.0.1:8000"

CHARACTERS = [
    ("c01", "1boy", "suit, necktie, briefcase, short brown hair"),
    ("c02", "1girl", "blouse, pencil_skirt, laptop, long black hair"),
    ("c03", "1boy", "hoodie, glasses, headphones, messy hair"),
    ("c04", "1girl", "casual, glasses, coffee_cup, short hair, sweater"),
    ("c05", "1boy", "dress_shirt, vest, glasses, necktie, gray hair"),
    ("c06", "1boy", "t-shirt, jeans, sneakers, backpack, blonde hair"),
    ("c07", "1girl", "cardigan, pleated_skirt, loafers, brown hair, hair_ribbon"),
    ("c08", "1girl", "apron, coffee_cup, ponytail, barista"),
    ("c09", "1boy", "chef_hat, chef_uniform, apron, short black hair"),
    ("c10", "1boy", "armor, cape, sword, helmet"),
    ("c11", "1girl", "robe, wizard_hat, staff, magic, long purple hair"),
]

COMMON_POS = "masterpiece, best quality, very aesthetic, absurdres, chibi, 2-head-tall, full body, simple_background, green_background, standing, game sprite, clean silhouette"
COMMON_NEG = "nsfw, lowres, bad quality, worst quality, text, watermark, realistic, photorealistic, 3d render, multiple characters, multiple views, deformed, silhouette, shadow, dark, backlighting"

def make_workflow(prompt: str, seed: int, prefix: str) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL31_v31.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": COMMON_NEG, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["4", 0], "seed": seed, "steps": 25, "cfg": 7,
            "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1
        }},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"chibi_v2/{prefix}"}}
    }

def enqueue(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result.get("prompt_id", "unknown")

def main():
    seed_base = 300000
    total = 0

    for i, (cid, gender, char_tags) in enumerate(CHARACTERS):
        for k, suffix in enumerate(["c", "d"]):  # c, d to not conflict with a, b
            seed = seed_base + (i * 100) + k
            # Fixed side prompt: no "profile", no "facing left", add bright/colorful
            prompt = f"{COMMON_POS}, {gender}, {char_tags}, side view, looking to the side, bright colors, colorful"
            prefix = f"{cid}_side_{suffix}"

            wf = make_workflow(prompt, seed, prefix)
            pid = enqueue(wf)
            total += 1
            print(f"[{total:02d}] {prefix} → seed={seed} → {pid[:8]}...")

    print(f"\nTotal enqueued: {total} fixed side images")

if __name__ == "__main__":
    main()
