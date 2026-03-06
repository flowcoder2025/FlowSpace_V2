"""
배치 치비 캐릭터 생성 스크립트 v5
Phase 12: Clean ref 기반 파이프라인 (흰 아웃라인 근본 해결)
v5 변경:
  - thick outline, bold lineart 제거 (흰 아웃라인 원인)
  - --gen-refs: 깨끗한 ref 생성 (IP-Adapter 없이)
  - 출력: v5/refs/, v5/final/
  - 채택 6캐릭터만 기본 대상 (c02/c03/c04/c05/c07/c08)
"""
import json
import urllib.request
import sys
import os
import shutil
sys.stdout.reconfigure(encoding='utf-8')

COMFYUI_URL = "http://127.0.0.1:8000"
COMFYUI_INPUT = "C:/Users/User/ComfyUI/input"
COMFYUI_OUTPUT = "C:/Users/User/ComfyUI/output"

# ─── 채택 캐릭터 (v4 배치 판정) ────────────────────────
# (id, gender, front_appearance, back_appearance, neg_gender_tags)
CHARACTERS = [
    ("c02", "1girl",
     "long hair, black hair, blouse, pencil skirt, office wear",
     "very long hair, black hair, straight hair, white blouse, dark pencil skirt, office wear",
     "1boy, male"),

    ("c03", "1boy",
     "messy hair, brown hair, hoodie, glasses, headphones, casual wear",
     "short hair, messy hair, brown hair, gray hoodie, hood down, headphones around neck, casual wear",
     "1girl, female, skirt, dress, long hair"),

    ("c04", "1girl",
     "short hair, brown hair, glasses, sweater, casual wear",
     "bob cut, brown hair, cream sweater, casual wear",
     "1boy, male, long hair"),

    ("c05", "1boy",
     "short hair, gray hair, dress shirt, vest, glasses, necktie, formal wear",
     "short hair, gray hair, back_of_head, dark vest, white dress shirt, formal wear",
     "1girl, female, skirt, dress, long hair, fluffy hair, voluminous hair, puffy hair"),

    ("c07", "1girl",
     "brown hair, hair ribbon, cardigan, pleated skirt, loafers, school wear",
     "hair ribbon, long hair, brown hair, beige cardigan, dark pleated skirt, school wear",
     "1boy, male"),

    ("c08", "1girl",
     "ponytail, brown hair, apron, cafe uniform",
     "ponytail, hair up, hair tie, back_of_head, brown hair, brown dress, black apron, apron strings, white apron, cafe uniform",
     "1boy, male, hair bun, high ponytail"),
]

# ─── 캐릭터별 back seed 오버라이드 ─────────────────────────
BACK_SEEDS = {
    "c08": 100,  # v4 s100 사용자 선택
}

# ─── 방향별 설정 ─────────────────────────────────────
DIRECTIONS = {
    "front": {
        "tags": "facing viewer, front view",
        "depth": "depth_maps/front.png",
        "ipadapter_type": "advanced",
    },
    "back": {
        "tags": "from behind, facing away",
        "depth": "depth_maps/back_shifted.png",
        "ipadapter_type": "style_composition",
    },
    "left": {
        "tags": "from side, left side, profile",
        "depth": "depth_maps/left.png",
        "ipadapter_type": "advanced",
    },
}

# v5: thick outline, bold lineart 제거 (흰 아웃라인 근본 원인)
QUALITY_SUFFIX = "white background, full body, standing, masterpiece, best quality, very aesthetic, absurdres"
LORA_TRIGGER = "flowspace_chibi"
NEG_QUALITY = "thin lines, low quality, worst quality, normal quality, lowres, bad anatomy, bad hands, text, error, signature, watermark, blurry"
NEG_BACK_EXTRA = "face, looking at viewer, frontal view, bangs visible, eyes, front side"


def make_prompt(gender, direction_tags, appearance_tags):
    return f"{LORA_TRIGGER}, {gender}, chibi, {direction_tags}, {appearance_tags}, {QUALITY_SUFFIX}"


def make_negative(neg_gender_tags, is_back=False):
    base = f"{neg_gender_tags}, {NEG_QUALITY}"
    if is_back:
        base += f", {NEG_BACK_EXTRA}"
    return base


def make_ref_workflow(char_id, gender, appearance, neg_gender_tags):
    """Clean ref 생성: IP-Adapter 없이, Rembg 없이 (배경 포함 원본)"""
    positive = make_prompt(gender, "facing viewer, front view", appearance)
    negative = make_negative(neg_gender_tags)
    return {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "animagineXL31_v31.safetensors"}},
        "2": {"class_type": "LoraLoader",
              "inputs": {"lora_name": "flowspace-chibi-v2.safetensors",
                         "strength_model": 0.6, "strength_clip": 0.6,
                         "model": ["1", 0], "clip": ["1", 1]}},
        "6": {"class_type": "CLIPTextEncode",
              "inputs": {"text": positive, "clip": ["2", 1]}},
        "7": {"class_type": "CLIPTextEncode",
              "inputs": {"text": negative, "clip": ["2", 1]}},
        "8": {"class_type": "ControlNetLoader",
              "inputs": {"control_net_name": "controlnet-depth-sdxl-1.0.safetensors"}},
        "9": {"class_type": "LoadImage",
              "inputs": {"image": "depth_maps/front.png"}},
        "10": {"class_type": "ControlNetApplyAdvanced",
               "inputs": {"strength": 0.3, "start_percent": 0, "end_percent": 0.7,
                           "positive": ["6", 0], "negative": ["7", 0],
                           "control_net": ["8", 0], "image": ["9", 0]}},
        "11": {"class_type": "EmptyLatentImage",
               "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "12": {"class_type": "KSampler",
               "inputs": {"seed": 42, "steps": 28, "cfg": 7,
                           "sampler_name": "euler_ancestral", "scheduler": "normal",
                           "denoise": 1, "model": ["2", 0],
                           "positive": ["10", 0], "negative": ["10", 1],
                           "latent_image": ["11", 0]}},
        "13": {"class_type": "VAEDecode",
               "inputs": {"samples": ["12", 0], "vae": ["1", 2]}},
        "15": {"class_type": "SaveImage",
               "inputs": {"filename_prefix": f"v5/refs/{char_id}",
                           "images": ["13", 0]}},
    }


def make_front_left_workflow(char_id, positive, negative, depth_map, prefix):
    """Front/Left: IPAdapterAdvanced (style and composition)"""
    return {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "animagineXL31_v31.safetensors"}},
        "2": {"class_type": "LoraLoader",
              "inputs": {"lora_name": "flowspace-chibi-v2.safetensors",
                         "strength_model": 0.6, "strength_clip": 0.6,
                         "model": ["1", 0], "clip": ["1", 1]}},
        "3": {"class_type": "IPAdapterUnifiedLoader",
              "inputs": {"preset": "PLUS (high strength)", "model": ["2", 0]}},
        "4": {"class_type": "LoadImage",
              "inputs": {"image": f"ref_{char_id}_v5.png"}},
        "5": {"class_type": "IPAdapterAdvanced",
              "inputs": {"model": ["3", 0], "ipadapter": ["3", 1],
                         "image": ["4", 0], "weight": 1.0,
                         "weight_type": "style and composition",
                         "combine_embeds": "average",
                         "start_at": 0, "end_at": 0.5,
                         "embeds_scaling": "V only"}},
        "6": {"class_type": "CLIPTextEncode",
              "inputs": {"text": positive, "clip": ["2", 1]}},
        "7": {"class_type": "CLIPTextEncode",
              "inputs": {"text": negative, "clip": ["2", 1]}},
        "8": {"class_type": "ControlNetLoader",
              "inputs": {"control_net_name": "controlnet-depth-sdxl-1.0.safetensors"}},
        "9": {"class_type": "LoadImage",
              "inputs": {"image": depth_map}},
        "10": {"class_type": "ControlNetApplyAdvanced",
               "inputs": {"strength": 0.3, "start_percent": 0, "end_percent": 0.7,
                           "positive": ["6", 0], "negative": ["7", 0],
                           "control_net": ["8", 0], "image": ["9", 0]}},
        "11": {"class_type": "EmptyLatentImage",
               "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "12": {"class_type": "KSampler",
               "inputs": {"seed": 42, "steps": 28, "cfg": 7,
                           "sampler_name": "euler_ancestral", "scheduler": "normal",
                           "denoise": 1, "model": ["5", 0],
                           "positive": ["10", 0], "negative": ["10", 1],
                           "latent_image": ["11", 0]}},
        "13": {"class_type": "VAEDecode",
               "inputs": {"samples": ["12", 0], "vae": ["1", 2]}},
        "14": {"class_type": "InspyrenetRembg",
               "inputs": {"torchscript_jit": "default", "image": ["13", 0]}},
        "15": {"class_type": "SaveImage",
               "inputs": {"filename_prefix": prefix, "images": ["14", 0]}},
    }


def make_back_workflow(char_id, positive, negative, prefix, seed=42):
    """Back: IPAdapterStyleComposition (style=1.0, comp=0.3)"""
    return {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "animagineXL31_v31.safetensors"}},
        "2": {"class_type": "LoraLoader",
              "inputs": {"lora_name": "flowspace-chibi-v2.safetensors",
                         "strength_model": 0.6, "strength_clip": 0.6,
                         "model": ["1", 0], "clip": ["1", 1]}},
        "3": {"class_type": "IPAdapterUnifiedLoader",
              "inputs": {"preset": "PLUS (high strength)", "model": ["2", 0]}},
        "4": {"class_type": "LoadImage",
              "inputs": {"image": f"ref_{char_id}_v5.png"}},
        "5": {"class_type": "IPAdapterStyleComposition",
              "inputs": {"model": ["3", 0], "ipadapter": ["3", 1],
                         "image_style": ["4", 0], "image_composition": ["4", 0],
                         "weight_style": 1.0, "weight_composition": 0.3,
                         "expand_style": False,
                         "combine_embeds": "average",
                         "start_at": 0, "end_at": 0.5,
                         "embeds_scaling": "V only"}},
        "6": {"class_type": "CLIPTextEncode",
              "inputs": {"text": positive, "clip": ["2", 1]}},
        "7": {"class_type": "CLIPTextEncode",
              "inputs": {"text": negative, "clip": ["2", 1]}},
        "8": {"class_type": "ControlNetLoader",
              "inputs": {"control_net_name": "controlnet-depth-sdxl-1.0.safetensors"}},
        "9": {"class_type": "LoadImage",
              "inputs": {"image": "depth_maps/back_shifted.png"}},
        "10": {"class_type": "ControlNetApplyAdvanced",
               "inputs": {"strength": 0.3, "start_percent": 0, "end_percent": 0.7,
                           "positive": ["6", 0], "negative": ["7", 0],
                           "control_net": ["8", 0], "image": ["9", 0]}},
        "11": {"class_type": "EmptyLatentImage",
               "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "12": {"class_type": "KSampler",
               "inputs": {"seed": seed, "steps": 28, "cfg": 7,
                           "sampler_name": "euler_ancestral", "scheduler": "normal",
                           "denoise": 1, "model": ["5", 0],
                           "positive": ["10", 0], "negative": ["10", 1],
                           "latent_image": ["11", 0]}},
        "13": {"class_type": "VAEDecode",
               "inputs": {"samples": ["12", 0], "vae": ["1", 2]}},
        "14": {"class_type": "InspyrenetRembg",
               "inputs": {"torchscript_jit": "default", "image": ["13", 0]}},
        "15": {"class_type": "SaveImage",
               "inputs": {"filename_prefix": prefix, "images": ["14", 0]}},
    }


def enqueue(workflow):
    """ComfyUI API로 워크플로우 큐잉"""
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        return result.get("prompt_id", "unknown")


def upload_refs():
    """v5/refs/ 결과물을 ComfyUI input/으로 복사"""
    refs_dir = os.path.join(COMFYUI_OUTPUT, "v5", "refs")
    count = 0
    for fname in os.listdir(refs_dir):
        if fname.endswith(".png"):
            char_id = fname.split("_")[0]  # c02_00001_.png → c02
            src = os.path.join(refs_dir, fname)
            dst = os.path.join(COMFYUI_INPUT, f"ref_{char_id}_v5.png")
            shutil.copy2(src, dst)
            count += 1
            print(f"  {fname} → ref_{char_id}_v5.png")
    print(f"  {count}개 ref 업로드 완료")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--gen-refs", action="store_true",
                        help="Phase 1: 깨끗한 ref 생성 (IP-Adapter 없이)")
    parser.add_argument("--upload-refs", action="store_true",
                        help="v5/refs/ → ComfyUI input/ 복사")
    parser.add_argument("--back-only", action="store_true",
                        help="back만 재생성")
    parser.add_argument("--chars", type=str,
                        help="특정 캐릭터만 (쉼표 구분: c02,c05)")
    args = parser.parse_args()

    target_chars = None
    if args.chars:
        target_chars = set(args.chars.split(","))

    if args.upload_refs:
        upload_refs()
        return

    total = 0

    if args.gen_refs:
        # Phase 1: clean ref 생성
        print("=== Phase 1: Clean Ref 생성 (IP-Adapter 없이) ===")
        for char_id, gender, front_app, _, neg_gender in CHARACTERS:
            if target_chars and char_id not in target_chars:
                continue
            wf = make_ref_workflow(char_id, gender, front_app, neg_gender)
            prompt_id = enqueue(wf)
            total += 1
            print(f"[{total:02d}] {char_id}_ref → {prompt_id}")
    else:
        # Phase 2: 3방향 생성
        print("=== Phase 2: 3방향 생성 (clean ref 사용) ===")
        for char_id, gender, front_app, back_app, neg_gender in CHARACTERS:
            if target_chars and char_id not in target_chars:
                continue

            for dir_name, dir_cfg in DIRECTIONS.items():
                if args.back_only and dir_name != "back":
                    continue

                is_back = (dir_name == "back")
                appearance = back_app if is_back else front_app
                positive = make_prompt(gender, dir_cfg["tags"], appearance)
                negative = make_negative(neg_gender, is_back=is_back)
                prefix = f"v5/final/{char_id}_{dir_name}"

                if dir_cfg["ipadapter_type"] == "style_composition":
                    back_seed = BACK_SEEDS.get(char_id, 42)
                    wf = make_back_workflow(char_id, positive, negative, prefix, seed=back_seed)
                else:
                    wf = make_front_left_workflow(
                        char_id, positive, negative, dir_cfg["depth"], prefix
                    )

                prompt_id = enqueue(wf)
                total += 1
                print(f"[{total:02d}] {char_id}_{dir_name} → {prompt_id}")

    print(f"\n완료: {total}개 워크플로우 큐잉됨")


if __name__ == "__main__":
    main()
