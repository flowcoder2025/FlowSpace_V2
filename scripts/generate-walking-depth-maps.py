"""
걷기 포즈 depth map 생성 스크립트
기존 서있는 depth map에서 다리 영역을 변형하여 걷기 프레임 생성

프레임 구조 (4프레임 걷기 사이클):
  frame1: 서기 (기존 depth map)
  frame2: 왼발 앞, 오른발 뒤
  frame3: 서기 (frame1과 동일)
  frame4: 오른발 앞, 왼발 뒤 (frame2의 좌우반전)

방향별:
  front/back: 다리를 좌우로 벌림 (정면에서 보이는 걷기)
  left: 다리를 앞뒤로 벌림 (측면에서 보이는 걷기)
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

INPUT_DIR = "C:/Users/User/ComfyUI/input/depth_maps"
OUTPUT_DIR = "C:/Users/User/ComfyUI/input/depth_maps/walk"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── 걷기 파라미터 ───────────────────────────────────
LEG_SPREAD_PX = 18       # front/back: 다리 좌우 벌림 (px)
LEG_STRIDE_PX = 22       # left: 다리 앞뒤 벌림 (px)
BODY_BOB_PX = 6          # 걸을 때 몸 위아래 흔들림


def find_body_bounds(img_array):
    """이미지에서 비검정 영역의 bounding box 찾기"""
    mask = img_array > 20  # 검정(0)이 아닌 영역
    if mask.ndim == 3:
        mask = mask.any(axis=2)
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    return rmin, rmax, cmin, cmax


def find_leg_split(img_array, body_bottom):
    """다리 영역 시작점 찾기 (몸통 하단에서 다리가 갈라지는 지점)"""
    if img_array.ndim == 3:
        gray = img_array[:, :, 0]
    else:
        gray = img_array

    # 몸통 하단 40% 영역에서 수직 가운데 gap 찾기
    h = body_bottom - int(body_bottom * 0.6)
    search_start = int(body_bottom * 0.6)

    for y in range(search_start, body_bottom):
        row = gray[y, :]
        lit = np.where(row > 20)[0]
        if len(lit) < 2:
            continue
        center = (lit[0] + lit[-1]) // 2
        # 가운데 영역이 어두우면 다리 갈라진 지점
        center_val = gray[y, center-3:center+3].mean() if center > 3 else 0
        if center_val < 30 and (lit[-1] - lit[0]) > 20:
            return y

    # 못 찾으면 하단 30% 지점
    return int(body_bottom * 0.7)


def create_front_back_walk(base_path, direction, spread_px=LEG_SPREAD_PX):
    """front/back 걷기: 다리를 좌우로 벌림"""
    img = Image.open(base_path).convert("RGBA")
    arr = np.array(img)

    rmin, rmax, cmin, cmax = find_body_bounds(arr[:, :, :3])
    leg_y = find_leg_split(arr[:, :, 0], rmax)

    # 상체 (다리 위)
    upper = img.crop((0, 0, img.width, leg_y))
    # 왼쪽 다리
    center_x = (cmin + cmax) // 2
    left_leg = img.crop((cmin, leg_y, center_x, img.height))
    # 오른쪽 다리
    right_leg = img.crop((center_x, leg_y, cmax + 1, img.height))

    frames = {}

    # frame1, frame3: 서기 (원본)
    frames["frame1"] = img.copy()
    frames["frame3"] = img.copy()

    # frame2: 왼발 왼쪽, 오른발 오른쪽 (벌림) + 약간 위로 밥
    f2 = Image.new("RGBA", img.size, (0, 0, 0, 0))
    f2.paste(upper, (0, -BODY_BOB_PX), upper)
    f2.paste(left_leg, (cmin - spread_px, leg_y - BODY_BOB_PX), left_leg)
    f2.paste(right_leg, (center_x + spread_px, leg_y - BODY_BOB_PX), right_leg)
    frames["frame2"] = f2

    # frame4: 반대 (오른발 왼쪽, 왼발 오른쪽) + 약간 위로 밥
    f4 = Image.new("RGBA", img.size, (0, 0, 0, 0))
    f4.paste(upper, (0, -BODY_BOB_PX), upper)
    f4.paste(left_leg, (cmin + spread_px, leg_y - BODY_BOB_PX), left_leg)
    f4.paste(right_leg, (center_x - spread_px, leg_y - BODY_BOB_PX), right_leg)
    frames["frame4"] = f4

    # 저장
    for fname, fimg in frames.items():
        # RGBA → RGB (검정 배경)
        bg = Image.new("RGB", fimg.size, (0, 0, 0))
        if fimg.mode == "RGBA":
            bg.paste(fimg, mask=fimg.split()[3])
        else:
            bg = fimg.convert("RGB")
        out_path = os.path.join(OUTPUT_DIR, f"{direction}_{fname}.png")
        bg.save(out_path)
        print(f"  {out_path}")

    return frames


def create_left_walk(base_path, stride_px=LEG_STRIDE_PX):
    """left 걷기: 다리를 앞뒤로 벌림"""
    img = Image.open(base_path).convert("RGBA")
    arr = np.array(img)

    rmin, rmax, cmin, cmax = find_body_bounds(arr[:, :, :3])
    leg_y = find_leg_split(arr[:, :, 0], rmax)

    upper = img.crop((0, 0, img.width, leg_y))

    # left view에서 다리는 수직으로 나란히 → 앞뒤로 벌림
    # 다리 전체를 하나로 취급하고, 복제하여 앞뒤 배치
    legs = img.crop((cmin, leg_y, cmax + 1, img.height))
    leg_w = cmax - cmin + 1

    frames = {}

    # frame1, frame3: 서기
    frames["frame1"] = img.copy()
    frames["frame3"] = img.copy()

    # frame2: 앞다리 왼쪽으로, 뒷다리 오른쪽으로
    f2 = Image.new("RGBA", img.size, (0, 0, 0, 0))
    f2.paste(upper, (0, -BODY_BOB_PX), upper)
    # 앞다리 (왼쪽으로 이동 = 화면에서 왼쪽 = 걷는 방향)
    f2.paste(legs, (cmin - stride_px, leg_y - BODY_BOB_PX), legs)
    # 뒷다리 (오른쪽으로 이동)
    f2.paste(legs, (cmin + stride_px, leg_y - BODY_BOB_PX), legs)
    frames["frame2"] = f2

    # frame4: 반대
    f4 = Image.new("RGBA", img.size, (0, 0, 0, 0))
    f4.paste(upper, (0, -BODY_BOB_PX), upper)
    f4.paste(legs, (cmin + stride_px, leg_y - BODY_BOB_PX), legs)
    f4.paste(legs, (cmin - stride_px, leg_y - BODY_BOB_PX), legs)
    frames["frame4"] = f4

    for fname, fimg in frames.items():
        bg = Image.new("RGB", fimg.size, (0, 0, 0))
        if fimg.mode == "RGBA":
            bg.paste(fimg, mask=fimg.split()[3])
        else:
            bg = fimg.convert("RGB")
        out_path = os.path.join(OUTPUT_DIR, f"left_{fname}.png")
        bg.save(out_path)
        print(f"  {out_path}")

    return frames


def main():
    print("=== 걷기 depth map 생성 ===\n")

    print("[front]")
    create_front_back_walk(
        os.path.join(INPUT_DIR, "front.png"), "front"
    )

    print("\n[back]")
    create_front_back_walk(
        os.path.join(INPUT_DIR, "back_shifted.png"), "back"
    )

    print("\n[left]")
    create_left_walk(
        os.path.join(INPUT_DIR, "left.png")
    )

    print(f"\n완료! {OUTPUT_DIR} 에 12개 파일 생성")
    print("frame1/frame3 = 서기 (원본), frame2/frame4 = 걷기")


if __name__ == "__main__":
    main()
