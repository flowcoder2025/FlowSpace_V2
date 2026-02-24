"""
정규화 이미지 50장 생성 — 치비가 아닌 일반 애니메 캐릭터
LoRA가 베이스 모델의 일반 능력을 유지하도록 함
"""
import json
import urllib.request
import random

COMFYUI_URL = "http://127.0.0.1:8000"

# 다양한 일반 애니메 캐릭터 프롬프트 (치비 아님)
PROMPTS = [
    "1girl, long hair, school uniform, standing, simple_background, white_background",
    "1boy, short hair, casual, t-shirt, jeans, standing, simple_background",
    "1girl, ponytail, dress, standing, full body, simple_background",
    "1boy, suit, necktie, standing, full body, simple_background",
    "1girl, short hair, glasses, sweater, standing, simple_background",
    "1boy, hoodie, messy hair, standing, full body, simple_background",
    "1girl, twintails, maid outfit, standing, simple_background",
    "1boy, armor, cape, sword, standing, simple_background",
    "1girl, witch hat, robe, staff, standing, simple_background",
    "1boy, chef hat, apron, standing, simple_background",
    "1girl, nurse outfit, standing, simple_background",
    "1boy, lab coat, glasses, standing, simple_background",
    "1girl, kimono, long hair, standing, simple_background",
    "1boy, sportswear, shorts, running shoes, standing, simple_background",
    "1girl, leather jacket, boots, standing, simple_background",
    "1boy, military uniform, standing, simple_background",
    "1girl, ballet outfit, standing, simple_background",
    "1boy, pirate, hat, eyepatch, standing, simple_background",
    "1girl, detective, coat, hat, standing, simple_background",
    "1boy, musician, guitar, standing, simple_background",
    "1girl, artist, beret, paint brush, standing, simple_background",
    "1boy, farmer, overalls, straw hat, standing, simple_background",
    "1girl, pilot, uniform, goggles, standing, simple_background",
    "1boy, firefighter, helmet, standing, simple_background",
    "1girl, princess, crown, long dress, standing, simple_background",
]

COMMON_PREFIX = "masterpiece, best quality, very aesthetic, absurdres, full body, anime coloring"
COMMON_NEG = "nsfw, lowres, bad quality, worst quality, text, watermark, chibi, deformed"

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
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"reg/{prefix}"}}
    }

def enqueue(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result.get("prompt_id", "unknown")

def main():
    seed_base = 600000
    total = 0

    for i, char_prompt in enumerate(PROMPTS):
        # 2 images per prompt = 50 total
        for k in range(2):
            seed = seed_base + (i * 10) + k
            prompt = f"{COMMON_PREFIX}, {char_prompt}"
            prefix = f"reg_{i:02d}_{k}"

            wf = make_workflow(prompt, seed, prefix)
            pid = enqueue(wf)
            total += 1
            print(f"[{total:02d}] reg_{i:02d}_{k} -> {pid[:8]}...")

    print(f"\nTotal enqueued: {total} regularization images")

if __name__ == "__main__":
    main()
