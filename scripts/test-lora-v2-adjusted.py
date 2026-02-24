"""
LoRA v2 조정 테스트 — strength 0.7 + anime coloring 프롬프트
"""
import json
import urllib.request

COMFYUI_URL = "http://127.0.0.1:8000"

COMMON_POS = "masterpiece, best quality, very aesthetic, absurdres, flowspace_chibi, chibi, 2-head-tall, full body, simple_background, green_background, standing, game sprite, anime coloring, clean lineart"
COMMON_NEG = "nsfw, lowres, bad quality, worst quality, text, watermark, realistic, photorealistic, 3d render, multiple characters, multiple views, deformed, silhouette, shadow, dark, backlighting, monochrome"

TESTS = [
    ("office", "1boy, suit, necktie, briefcase, brown hair"),
    ("casual", "1boy, hoodie, glasses, headphones, messy black hair"),
    ("knight", "1boy, silver armor, red cape, sword, helmet"),
]

DIRECTIONS = [
    ("front", "front view, looking_at_viewer"),
    ("side", "from_side"),
    ("back", "from_behind, facing_away, back view"),
]

STRENGTHS = [0.7, 0.5]  # Test two strengths

def make_workflow(prompt: str, neg: str, seed: int, prefix: str, strength: float) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL31_v31.safetensors"}},
        "1b": {"class_type": "LoraLoader", "inputs": {
            "model": ["1", 0], "clip": ["1", 1],
            "lora_name": "flowspace-chibi-v2.safetensors",
            "strength_model": strength, "strength_clip": strength
        }},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1b", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["1b", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "model": ["1b", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["4", 0], "seed": seed, "steps": 25, "cfg": 7,
            "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1
        }},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"test_v2_adj/{prefix}"}}
    }

def enqueue(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result.get("prompt_id", "unknown")

def main():
    seed_base = 800000
    total = 0

    for s, strength in enumerate(STRENGTHS):
        for i, (name, char_tags) in enumerate(TESTS):
            for j, (dir_name, dir_tags) in enumerate(DIRECTIONS):
                seed = seed_base + (s * 1000) + (i * 100) + (j * 10)
                prompt = f"{COMMON_POS}, {char_tags}, {dir_tags}"
                prefix = f"s{int(strength*10)}_{name}_{dir_name}"

                wf = make_workflow(prompt, COMMON_NEG, seed, prefix, strength)
                pid = enqueue(wf)
                total += 1
                print(f"[{total:02d}] str={strength} {name}_{dir_name} -> {pid[:8]}...")

    print(f"\nTotal: {total} adjusted test images")

if __name__ == "__main__":
    main()
