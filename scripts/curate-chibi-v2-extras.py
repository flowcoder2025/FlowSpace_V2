"""추가 변형 이미지 — 방향 균등화 + 다양성 향상"""
import shutil
import os

SRC = "C:/Users/User/ComfyUI/output/chibi_v2"
DST = "C:/Users/User/sd-scripts/train_data/chibi_v2/10_flowspace_chibi"

EXTRAS = [
    # 추가 측면 (side) — 균형 맞추기
    ("c01_side_f_00001_.png", "c01_side2",
     "flowspace_chibi, chibi, 1boy, suit, necktie, briefcase, short brown hair, side_view, standing, green_background, full_body"),
    ("c08_side_f_00001_.png", "c08_side2",
     "flowspace_chibi, chibi, 1girl, apron, coffee_cup, ponytail, barista, brown hair, side_view, standing, green_background, full_body"),
    ("c11_side_f_00001_.png", "c11_side2",
     "flowspace_chibi, chibi, 1girl, white robe, wizard_hat, staff, magic, long purple hair, side_view, standing, green_background, full_body"),

    # 추가 후면 (back) — 균형 맞추기
    ("c06_back_b_00001_.png", "c06_back2",
     "flowspace_chibi, chibi, 1boy, t-shirt, jeans, sneakers, backpack, blonde hair, from_behind, standing, green_background, full_body"),
    ("c08_back_d_00001_.png", "c08_back2",
     "flowspace_chibi, chibi, 1girl, apron, coffee_cup, ponytail, barista, brown hair, from_behind, standing, green_background, full_body"),
    ("c10_back_d_00001_.png", "c10_back2",
     "flowspace_chibi, chibi, 1boy, silver armor, red cape, sword, helmet, from_behind, standing, green_background, full_body"),
]

def main():
    added = 0
    for src_name, dst_name, caption in EXTRAS:
        src_path = os.path.join(SRC, src_name)
        if not os.path.exists(src_path):
            print(f"[WARN] Missing: {src_name}")
            continue

        dst_img = os.path.join(DST, f"{dst_name}.png")
        shutil.copy2(src_path, dst_img)

        dst_txt = os.path.join(DST, f"{dst_name}.txt")
        with open(dst_txt, "w", encoding="utf-8") as f:
            f.write(caption)

        added += 1
        print(f"[+] {dst_name}")

    # Final count
    pngs = [f for f in os.listdir(DST) if f.endswith(".png")]
    txts = [f for f in os.listdir(DST) if f.endswith(".txt")]
    print(f"\nAdded: {added} extras")
    print(f"Total: {len(pngs)} images, {len(txts)} captions")

    # Direction balance
    dir_counts = {"front": 0, "side": 0, "back": 0}
    for t in txts:
        path = os.path.join(DST, t)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if "front_view" in content:
            dir_counts["front"] += 1
        elif "side_view" in content:
            dir_counts["side"] += 1
        elif "from_behind" in content:
            dir_counts["back"] += 1
    print(f"Direction balance: {dir_counts}")

if __name__ == "__main__":
    main()
