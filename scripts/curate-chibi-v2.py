"""
캐릭터별 LoRA 학습 데이터 최종 큐레이션 (v2 — per-character)
각 캐릭터 폴더에 검증된 이미지만 복사 + 캡션 생성
"""
import shutil
import os

BASE_ORIG = "C:/Users/User/sd-scripts/train_data/chibi_v2/10_flowspace_chibi"
REGEN1 = "C:/Users/User/ComfyUI/output/regen"
REGEN2 = "C:/Users/User/ComfyUI/output/regen2"
REGEN3 = "C:/Users/User/ComfyUI/output/regen3"
OUT_BASE = "C:/Users/User/sd-scripts/train_data/chibi_v2_per_char"

# 캐릭터별 최종 선별 — 검증 완료 이미지만
SELECTIONS = {
    "c01": {
        "trigger": "flowspace_c01",
        "gender": "1boy",
        "images": [
            (f"{BASE_ORIG}/c01_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c01_side.png", "from_side"),
            (f"{BASE_ORIG}/c01_side2.png", "from_side"),
            (f"{REGEN3}/c01_back_v3_310001_00001_.png", "from_behind, back view"),
        ],
    },
    "c02": {
        "trigger": "flowspace_c02",
        "gender": "1girl",
        "images": [
            (f"{BASE_ORIG}/c02_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c02_side.png", "from_side"),
            (f"{REGEN2}/c02_back_v2_220001_00001_.png", "from_behind, back view"),
        ],
    },
    "c03": {
        "trigger": "flowspace_c03",
        "gender": "1boy",
        "images": [
            (f"{BASE_ORIG}/c03_front.png", "front view, looking_at_viewer"),
            (f"{REGEN1}/c03_side_regen_130001_00001_.png", "from_side"),
            (f"{REGEN1}/c03_back_regen_130002_00001_.png", "from_behind, back view"),
        ],
    },
    "c04": {
        "trigger": "flowspace_c04",
        "gender": "1girl",
        "images": [
            (f"{BASE_ORIG}/c04_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c04_side.png", "from_side"),
            (f"{REGEN2}/c04_back_v2_240002_00001_.png", "from_behind, back view"),
        ],
    },
    "c05": {
        "trigger": "flowspace_c05",
        "gender": "1boy",
        "images": [
            (f"{BASE_ORIG}/c05_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c05_front2.png", "front view, looking_at_viewer"),
            (f"{REGEN2}/c05_side_v2_250002_00001_.png", "from_side"),
            (f"{REGEN1}/c05_back_regen_150002_00001_.png", "from_behind, back view"),
        ],
    },
    "c06": {
        "trigger": "flowspace_c06",
        "gender": "1boy",
        "images": [
            (f"{BASE_ORIG}/c06_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c06_side.png", "from_side"),
            (f"{BASE_ORIG}/c06_back.png", "from_behind, back view"),
            (f"{BASE_ORIG}/c06_back2.png", "from_behind, back view"),
        ],
    },
    "c07": {
        "trigger": "flowspace_c07",
        "gender": "1girl",
        "images": [
            (f"{BASE_ORIG}/c07_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c07_front2.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c07_side.png", "from_side"),
            (f"{BASE_ORIG}/c07_back.png", "from_behind, back view"),
        ],
    },
    "c08": {
        "trigger": "flowspace_c08",
        "gender": "1girl",
        "images": [
            (f"{BASE_ORIG}/c08_front.png", "front view, looking_at_viewer"),
            (f"{REGEN1}/c08_side_regen_180001_00001_.png", "from_side"),
            (f"{BASE_ORIG}/c08_back2.png", "from_behind, back view"),
        ],
    },
    "c09": {
        "trigger": "flowspace_c09",
        "gender": "1boy",
        "images": [
            (f"{BASE_ORIG}/c09_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c09_front2.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c09_side.png", "from_side"),
            (f"{BASE_ORIG}/c09_back.png", "from_behind, back view"),
        ],
    },
    "c10": {
        "trigger": "flowspace_c10",
        "gender": "1boy",
        "images": [
            (f"{BASE_ORIG}/c10_front.png", "front view, looking_at_viewer"),
            (f"{BASE_ORIG}/c10_front2.png", "front view, looking_at_viewer"),
            (f"{REGEN1}/c10_side_regen_1100001_00001_.png", "from_side"),
            (f"{BASE_ORIG}/c10_back.png", "from_behind, back view"),
        ],
    },
    "c11": {
        "trigger": "flowspace_c11",
        "gender": "1girl",
        "images": [
            (f"{BASE_ORIG}/c11_front.png", "front view, looking_at_viewer"),
            (f"{REGEN1}/c11_side_regen_1110001_00001_.png", "from_side"),
            (f"{BASE_ORIG}/c11_back.png", "from_behind, back view"),
        ],
    },
}


def main():
    if os.path.exists(OUT_BASE):
        shutil.rmtree(OUT_BASE)
    os.makedirs(OUT_BASE)

    total = 0
    for char_id, info in SELECTIONS.items():
        folder_name = f"10_{info['trigger']}"
        char_dir = os.path.join(OUT_BASE, folder_name)
        os.makedirs(char_dir, exist_ok=True)

        for i, (src_path, direction_tags) in enumerate(info["images"]):
            if not os.path.exists(src_path):
                print(f"  [MISSING] {src_path}")
                continue

            dst_name = f"{char_id}_{i:02d}.png"
            shutil.copy2(src_path, os.path.join(char_dir, dst_name))

            caption = f"{info['trigger']}, chibi, {info['gender']}, full body, standing, green_background, simple_background, {direction_tags}"
            with open(os.path.join(char_dir, f"{char_id}_{i:02d}.txt"), "w", encoding="utf-8") as f:
                f.write(caption)

            total += 1

        count = len([f for f in os.listdir(char_dir) if f.endswith(".png")])
        print(f"[{char_id}] {info['trigger']}: {count} images")

    print(f"\nTotal: {total} curated images across {len(SELECTIONS)} characters")
    print(f"Output: {OUT_BASE}")


if __name__ == "__main__":
    main()
