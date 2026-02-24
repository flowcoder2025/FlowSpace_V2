"""
c08~c11 정면+후면 재생성 — 실루엣 캐릭터 수정
anime coloring + clean lineart + 강화 네거티브
"""
import json
import urllib.request

COMFYUI_URL = "http://127.0.0.1:8000"

# Only dark-prone characters that need regeneration
CHARACTERS = [
    ("c08", "1girl", "apron, coffee_cup, ponytail, barista, brown hair"),  # added hair color
    ("c09", "1boy", "chef_hat, chef_uniform, white apron, short black hair"),  # white apron explicit
    ("c10", "1boy", "silver armor, red cape, sword, helmet, blue eyes"),  # lighter armor
    ("c11", "1girl", "white robe, wizard_hat, staff, magic, long purple hair"),  # white robe
]

DIRECTIONS = [
    ("front", "front view, looking_at_viewer"),
    ("back", "from_behind, facing_away, back view"),
]

COMMON_POS = "masterpiece, best quality, very aesthetic, absurdres, chibi, 2-head-tall, full body, simple_background, green_background, standing, game sprite, anime coloring, clean lineart"
COMMON_NEG = "nsfw, lowres, bad quality, worst quality, text, watermark, realistic, photorealistic, 3d render, multiple characters, multiple views, deformed, silhouette, shadow, dark, backlighting, monochrome, greyscale, neon, pop art, pixel art, glitch"

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
    seed_base = 500000
    total = 0

    for i, (cid, gender, char_tags) in enumerate(CHARACTERS):
        for j, (dir_name, dir_tags) in enumerate(DIRECTIONS):
            for k, suffix in enumerate(["c", "d"]):
                seed = seed_base + (i * 100) + (j * 10) + k
                prompt = f"{COMMON_POS}, {gender}, {char_tags}, {dir_tags}"
                prefix = f"{cid}_{dir_name}_{suffix}"

                wf = make_workflow(prompt, seed, prefix)
                pid = enqueue(wf)
                total += 1
                print(f"[{total:02d}] {prefix} -> seed={seed} -> {pid[:8]}...")

    print(f"\nTotal enqueued: {total} fixed front/back images for c08-c11")

if __name__ == "__main__":
    main()
