"""
LoRA v2 검증 — 3가지 캐릭터 × 3방향 = 9장 테스트
트리거 워드: flowspace_chibi
"""
import json
import urllib.request

COMFYUI_URL = "http://127.0.0.1:8000"

COMMON_POS = "masterpiece, best quality, very aesthetic, absurdres, flowspace_chibi, chibi, 2-head-tall, full body, simple_background, green_background, standing, game sprite, clean silhouette"
COMMON_NEG = "nsfw, lowres, bad quality, worst quality, text, watermark, realistic, photorealistic, 3d render, multiple characters, multiple views, deformed"

TESTS = [
    # (name, character tags)
    ("office", "1boy, suit, necktie, briefcase, brown hair"),
    ("casual", "1boy, hoodie, glasses, headphones, messy black hair"),
    ("knight", "1boy, silver armor, red cape, sword, helmet"),
]

DIRECTIONS = [
    ("front", "front view, looking_at_viewer"),
    ("side", "from_side"),
    ("back", "from_behind, facing_away, back view"),
]

def make_workflow(prompt: str, seed: int, prefix: str) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL31_v31.safetensors"}},
        "1b": {"class_type": "LoraLoader", "inputs": {
            "model": ["1", 0], "clip": ["1", 1],
            "lora_name": "flowspace-chibi-v2.safetensors",
            "strength_model": 1.0, "strength_clip": 1.0
        }},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1b", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": COMMON_NEG, "clip": ["1b", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "model": ["1b", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["4", 0], "seed": seed, "steps": 25, "cfg": 7,
            "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1
        }},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"test_v2/{prefix}"}}
    }

def enqueue(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result.get("prompt_id", "unknown")

def main():
    seed_base = 700000
    total = 0

    for i, (name, char_tags) in enumerate(TESTS):
        for j, (dir_name, dir_tags) in enumerate(DIRECTIONS):
            seed = seed_base + (i * 100) + (j * 10)
            prompt = f"{COMMON_POS}, {char_tags}, {dir_tags}"
            prefix = f"{name}_{dir_name}"

            wf = make_workflow(prompt, seed, prefix)
            pid = enqueue(wf)
            total += 1
            print(f"[{total:02d}] {prefix} -> {pid[:8]}...")

    print(f"\nTotal: {total} test images")

if __name__ == "__main__":
    main()
