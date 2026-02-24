"""
2차 재생성 — 정확한 색상/디자인 명시
GOOD 이미지 기준으로 색상을 일치시킴
"""
import json
import urllib.request

COMFYUI_URL = "http://127.0.0.1:8000"

COMMON_POS_PREFIX = "masterpiece, best quality, very aesthetic, absurdres, chibi, 2-head-tall, full body, simple_background, green_background, standing, anime coloring, clean lineart, game sprite"
COMMON_NEG = "nsfw, lowres, bad quality, worst quality, text, watermark, realistic, photorealistic, 3d render, multiple characters, multiple views, deformed, silhouette, shadow, dark, backlighting, monochrome, greyscale, flat color, minimal detail, pixel art"

REGENERATE = [
    # c01 back — 정면 기준: 어두운 갈색(다크브라운) 정장, 빨간 넥타이, 갈색 서류가방
    ("c01_back_v2", "1boy, dark brown suit, red necktie, briefcase, short brown hair, from_behind, facing_away, back view, anime coloring, clean lineart", 210001),
    ("c01_back_v2", "1boy, dark brown suit, red necktie, briefcase, short brown hair, from_behind, facing_away, back view, anime coloring, clean lineart", 210002),
    ("c01_back_v2", "1boy, dark brown suit, red necktie, briefcase, short brown hair, from_behind, facing_away, back view, anime coloring, clean lineart", 210003),

    # c01 front2 — 정면 기준과 동일한 색상
    ("c01_front_v2", "1boy, dark brown suit, red necktie, briefcase, short brown hair, brown eyes, front view, looking_at_viewer, anime coloring, clean lineart", 210101),
    ("c01_front_v2", "1boy, dark brown suit, red necktie, briefcase, short brown hair, brown eyes, front view, looking_at_viewer, anime coloring, clean lineart", 210102),

    # c02 back — 정면 기준: 흰 블라우스, 검정 스커트, 검정 니삭스
    ("c02_back_v2", "1girl, white blouse, black pencil skirt, black thigh highs, long black hair, from_behind, facing_away, back view, anime coloring, clean lineart", 220001),
    ("c02_back_v2", "1girl, white blouse, black pencil skirt, black thigh highs, long black hair, from_behind, facing_away, back view, anime coloring, clean lineart", 220002),

    # c04 back — 정면 기준: 오렌지 스웨터, 회색/블루 스커트
    ("c04_back_v2", "1girl, orange sweater, gray skirt, glasses, short brown hair, from_behind, facing_away, back view, anime coloring, clean lineart", 240001),
    ("c04_back_v2", "1girl, orange sweater, gray skirt, glasses, short brown hair, from_behind, facing_away, back view, anime coloring, clean lineart", 240002),

    # c05 side — 정면 기준: 검정 조끼, 흰 드레스셔츠, 회색머리, 안경
    ("c05_side_v2", "1boy, black vest, white dress shirt, necktie, glasses, gray hair, blue eyes, from_side, anime coloring, clean lineart", 250001),
    ("c05_side_v2", "1boy, black vest, white dress shirt, necktie, glasses, gray hair, blue eyes, from_side, anime coloring, clean lineart", 250002),
    ("c05_side_v2", "1boy, black vest, white dress shirt, necktie, glasses, gray hair, blue eyes, from_side, anime coloring, clean lineart", 250003),
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
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"regen2/{prefix}_{seed}"}}
    }


def enqueue(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    return result.get("prompt_id", "unknown")


def main():
    total = 0
    for prefix, prompt, seed in REGENERATE:
        full_prompt = f"{COMMON_POS_PREFIX}, {prompt}"
        wf = make_workflow(full_prompt, COMMON_NEG, seed, prefix)
        pid = enqueue(wf)
        total += 1
        print(f"[{total:02d}] {prefix} seed={seed} -> {pid[:8]}...")

    print(f"\nTotal: {total} round-2 images queued")


if __name__ == "__main__":
    main()
