"""
Walking Frame Generator — Standing 스프라이트에서 4프레임 걷기 사이클 생성

사용법:
  python scripts/generate-walking-frames.py --char c02
  python scripts/generate-walking-frames.py --char c02 --preview

입력: ComfyUI/output/batch/ 의 standing 스프라이트 (front/back/left)
출력: ComfyUI/output/walk/ 에 4x4 스프라이트시트 + 프리뷰

걷기 사이클 (4프레임):
  Frame 0: 서기 (원본)
  Frame 1: 왼발 앞 + body bob
  Frame 2: 서기 (원본)
  Frame 3: 오른발 앞 + body bob

방향 매핑 (게임 기준):
  Row 0: down (= front view)
  Row 1: left
  Row 2: right (= left mirror)
  Row 3: up (= back view)
"""

import argparse
import os
import sys
import numpy as np
from PIL import Image

# === 설정 ===
BATCH_DIR = "C:/Users/User/ComfyUI/output/v5/final"
OUTPUT_DIR = "C:/Users/User/ComfyUI/output/walk"

# 게임 스프라이트시트 규격
GAME_FRAME_W = 96
GAME_FRAME_H = 128
SPRITE_COLS = 4  # 프레임 수
SPRITE_ROWS_4 = 4  # 4방향
SPRITE_ROWS_8 = 8  # 8방향

# 소스 해상도에서의 이동량 (32:1 스케일 기준)
# 게임에서 2px 이동 = 소스에서 ~60px
LEG_SHIFT_Y = 40       # 정면뷰 다리 상하 이동량 (px, 소스 해상도)
BODY_BOB_Y = -12        # 상체 bob (음수 = 위로)
SIDE_LEG_SHIFT_X = 45   # 측면뷰 다리 전후 이동량 (교차폭)
TORSO_SWAY_PX = 12      # 상체 수평 전단량 (px, 소스 해상도). 머리 끝에서의 최대 이동

# 파일명 패턴
FILE_PATTERNS = {
    "front": "{char}_front_00001_.png",
    "back": "{char}_back_00001_.png",
    "left": "{char}_left_00001_.png",
}


def remove_white_fringe(img_arr: np.ndarray) -> np.ndarray:
    """Rembg 등 배경 제거 후 남은 흰색 프린지 제거.

    반투명 엣지 픽셀의 RGB가 흰색(255)과 블렌딩된 상태를 역산:
    true_rgb = (blended_rgb - (1-a)*255) / a
    """
    result = img_arr.copy()
    alpha = result[:, :, 3].astype(np.float64)
    mask = (alpha > 0) & (alpha < 255)

    if not np.any(mask):
        return result

    a = alpha[mask] / 255.0

    for c in range(3):
        channel = result[:, :, c].astype(np.float64)
        # 흰색 매트 역산
        corrected = (channel[mask] - (1.0 - a) * 255.0) / np.maximum(a, 0.01)
        channel[mask] = np.clip(corrected, 0, 255)
        result[:, :, c] = channel.astype(np.uint8)

    return result


def find_bbox(alpha: np.ndarray, threshold: int = 10):
    """알파 채널에서 캐릭터 바운딩 박스 찾기"""
    rows = np.any(alpha > threshold, axis=1)
    cols = np.any(alpha > threshold, axis=0)
    y_indices = np.where(rows)[0]
    x_indices = np.where(cols)[0]
    if len(y_indices) == 0 or len(x_indices) == 0:
        return None
    return x_indices[0], y_indices[0], x_indices[-1], y_indices[-1]


def find_crotch_line(alpha: np.ndarray, bbox: tuple) -> int:
    """치마→다리 전환점 찾기 (폭 급감 기반)

    뒷머리카락이 중앙 갭을 가리는 경우가 있으므로,
    투명 갭 대신 실루엣 폭이 급감하는 지점을 감지.
    """
    x_min, y_min, x_max, y_max = bbox

    # 60% 지점부터 아래로 스캔
    start_y = y_min + int((y_max - y_min) * 0.55)
    prev_w = 0

    for y in range(start_y, y_max):
        active = np.where(alpha[y, :] > 10)[0]
        if len(active) == 0:
            continue
        w = active[-1] - active[0] + 1

        # 폭이 급감하는 지점 (이전 대비 50px 이상 감소)
        if prev_w > 0 and (prev_w - w) > 50:
            return y

        prev_w = w

    # 폴백: 중앙 갭 방식
    cx = (x_min + x_max) // 2
    for y in range(start_y, y_max):
        center = alpha[y, cx-8:cx+8]
        transparent = np.sum(center < 10)
        if transparent >= 8:
            return y

    return y_min + int((y_max - y_min) * 0.75)


def find_leg_center_x(alpha: np.ndarray, crotch_y: int, y_max: int, bbox: tuple) -> int:
    """다리 영역에서 좌/우 다리를 나누는 x좌표 찾기

    하단(발 위)에서 실제 갭을 찾아서 그 중심을 반환.
    상단에 머리카락이 갭을 가릴 수 있으므로 여러 높이에서 탐색.
    """
    x_min, _, x_max, _ = bbox
    cx = (x_min + x_max) // 2

    # 하단 70%~30% 범위에서 갭 탐색 (발 쪽에서 위로)
    for ratio in [0.7, 0.5, 0.3, 0.2]:
        test_y = crotch_y + int((y_max - crotch_y) * ratio)
        if test_y >= y_max:
            continue

        row = alpha[test_y, :]
        search_start = max(0, cx - 80)
        search_end = min(alpha.shape[1], cx + 80)

        gap_pixels = []
        for x in range(search_start, search_end):
            if row[x] < 10:
                gap_pixels.append(x)

        if gap_pixels:
            return (gap_pixels[0] + gap_pixels[-1]) // 2

    return cx


def split_legs_frontal(img_arr: np.ndarray, crotch_y: int, leg_cx: int, bbox: tuple):
    """정면/후면 뷰: 좌우 다리 분리 (상체-다리 오버랩으로 경계선 방지)"""
    x_min, _, x_max, y_max = bbox
    h, w = img_arr.shape[:2]
    overlap = 30  # 상체가 다리 위를 덮는 오버랩 픽셀

    # 왼쪽 다리 (이미지 기준 왼쪽 = 캐릭터 오른다리)
    left_leg = np.zeros_like(img_arr)
    left_leg[crotch_y:, :leg_cx] = img_arr[crotch_y:, :leg_cx]

    # 오른쪽 다리
    right_leg = np.zeros_like(img_arr)
    right_leg[crotch_y:, leg_cx:] = img_arr[crotch_y:, leg_cx:]

    # 상체 — 가랑이 아래로 overlap만큼 확장 (합성 시 다리 위를 덮어 경계선 제거)
    upper = np.zeros_like(img_arr)
    upper[:crotch_y + overlap] = img_arr[:crotch_y + overlap]

    return upper, left_leg, right_leg


def shift_region(region: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """이미지 영역을 dx, dy만큼 이동 (빈 자리는 투명)"""
    h, w = region.shape[:2]
    result = np.zeros_like(region)

    # 소스/대상 범위 계산
    src_y_start = max(0, -dy)
    src_y_end = min(h, h - dy)
    src_x_start = max(0, -dx)
    src_x_end = min(w, w - dx)

    dst_y_start = max(0, dy)
    dst_y_end = min(h, h + dy) if dy < 0 else min(h, src_y_end + dy)
    dst_x_start = max(0, dx)
    dst_x_end = min(w, w + dx) if dx < 0 else min(w, src_x_end + dx)

    # 유효 범위 확인
    copy_h = min(src_y_end - src_y_start, dst_y_end - dst_y_start)
    copy_w = min(src_x_end - src_x_start, dst_x_end - dst_x_start)

    if copy_h > 0 and copy_w > 0:
        result[dst_y_start:dst_y_start+copy_h, dst_x_start:dst_x_start+copy_w] = \
            region[src_y_start:src_y_start+copy_h, src_x_start:src_x_start+copy_w]

    return result


def compose_layers(*layers: np.ndarray) -> np.ndarray:
    """여러 RGBA 레이어를 합성 (아래→위 순서)"""
    result = np.zeros_like(layers[0])
    for layer in layers:
        alpha = layer[:, :, 3:4] / 255.0
        result[:, :, :3] = (result[:, :, :3] * (1 - alpha) + layer[:, :, :3] * alpha).astype(np.uint8)
        result[:, :, 3] = np.clip(result[:, :, 3] + layer[:, :, 3], 0, 255).astype(np.uint8)
    return result


def shear_upper_body(upper: np.ndarray, crotch_y: int, bbox: tuple, amount: int) -> np.ndarray:
    """상체를 수평 전단(shear) — 허리 고정, 머리 쪽으로 갈수록 이동.

    amount > 0: 머리가 오른쪽으로, amount < 0: 왼쪽으로.
    """
    _, y_min, _, _ = bbox
    result = np.zeros_like(upper)
    h, w = upper.shape[:2]

    # 유효 범위: bbox 상단 ~ crotch_y
    span = max(1, crotch_y - y_min)

    for y in range(h):
        if y >= crotch_y or y < y_min:
            result[y] = upper[y]
            continue

        # 허리(crotch_y)=0, 머리(y_min)=1.0 비율
        ratio = (crotch_y - y) / span
        dx = int(amount * ratio)

        if dx == 0:
            result[y] = upper[y]
        elif dx > 0:
            result[y, dx:] = upper[y, :w - dx]
        else:
            result[y, :w + dx] = upper[y, -dx:]

    return result


def scale_leg_vertical(leg: np.ndarray, crotch_y: int, bbox_ymax: int, target_h: int) -> np.ndarray:
    """다리를 수직 스케일링 — 가랑이 위치 고정, 발 위치만 변경.

    target_h < 원래 높이 → 다리가 짧아짐 (발이 올라감, 걷기 시 들린 발)
    target_h > 원래 높이 → 다리가 길어짐 (발이 내려감)
    갭 없이 가랑이에서 발까지 연속적으로 스케일링.
    """
    result = np.zeros_like(leg)
    orig_h = bbox_ymax - crotch_y
    w = leg.shape[1]
    if orig_h <= 0 or target_h <= 0:
        return result

    # 다리 영역 추출 → PIL 리사이즈 → 재배치
    leg_crop = Image.fromarray(leg[crotch_y:bbox_ymax, :])
    leg_scaled = leg_crop.resize((w, target_h), Image.LANCZOS)
    scaled_arr = np.array(leg_scaled)

    end_y = min(crotch_y + target_h, leg.shape[0])
    result[crotch_y:end_y, :] = scaled_arr[:end_y - crotch_y]

    return result


def generate_frontal_walk_frames(img: Image.Image) -> list[Image.Image]:
    """정면/후면 뷰 걷기 4프레임 생성 (수직 압축으로 다리 길이 차이)"""
    arr = np.array(img)
    alpha = arr[:, :, 3]
    bbox = find_bbox(alpha)
    if bbox is None:
        return [img] * 4

    crotch_y = find_crotch_line(alpha, bbox)
    leg_cx = find_leg_center_x(alpha, crotch_y, bbox[3], bbox)
    upper, left_leg, right_leg = split_legs_frontal(arr, crotch_y, leg_cx, bbox)

    leg_h = bbox[3] - crotch_y
    shorten = max(10, int(leg_h * 0.25))   # 들린 발: 25% 짧게
    bob_y = max(5, int(leg_h * 0.10))      # body bob
    sway = max(8, int(leg_h * 0.15))       # 상체 기울기

    frames = []
    for f in range(4):
        if f == 0 or f == 2:
            frames.append(img.copy())
        elif f == 1:
            # 왼다리 짧게(들림), 오른다리 원래 길이
            upper_swayed = shear_upper_body(upper, crotch_y, bbox, sway)
            upper_shifted = shift_region(upper_swayed, 0, -bob_y)
            left_short = scale_leg_vertical(left_leg, crotch_y, bbox[3], leg_h - shorten)
            composed = compose_layers(right_leg, left_short, upper_shifted)
            frames.append(Image.fromarray(composed))
        else:  # f == 3
            # 오른다리 짧게(들림), 왼다리 원래 길이
            upper_swayed = shear_upper_body(upper, crotch_y, bbox, -sway)
            upper_shifted = shift_region(upper_swayed, 0, -bob_y)
            right_short = scale_leg_vertical(right_leg, crotch_y, bbox[3], leg_h - shorten)
            composed = compose_layers(left_leg, right_short, upper_shifted)
            frames.append(Image.fromarray(composed))

    return frames


def split_legs_side(img_arr: np.ndarray, crotch_y: int, bbox: tuple):
    """측면 뷰: 다리를 앞/뒤로 분리 (상하 절반)"""
    x_min, _, x_max, y_max = bbox

    leg_h = y_max - crotch_y
    leg_mid_y = crotch_y + leg_h // 2  # 다리 중간 지점

    # 앞다리 = 다리 영역 상반부 (허벅지~무릎)
    front_leg = np.zeros_like(img_arr)
    front_leg[crotch_y:leg_mid_y] = img_arr[crotch_y:leg_mid_y]

    # 뒷다리 = 다리 영역 하반부 (무릎~발) + 복제한 상반부
    back_leg = np.zeros_like(img_arr)
    back_leg[crotch_y:] = img_arr[crotch_y:]

    return front_leg, back_leg


def generate_side_walk_frames(img: Image.Image) -> list[Image.Image]:
    """측면 뷰 걷기 4프레임 생성 (다리 교차)"""
    arr = np.array(img)
    alpha = arr[:, :, 3]
    bbox = find_bbox(alpha)
    if bbox is None:
        return [img] * 4

    crotch_y = find_crotch_line(alpha, bbox)

    # 가랑이 감지 실패 fallback: 의상이 다리를 가리는 캐릭터용
    # c07 기준 leg_ratio=0.25 (다리가 캐릭터 높이의 25%)
    char_h = bbox[3] - bbox[1]
    leg_h_detected = bbox[3] - crotch_y
    leg_ratio = leg_h_detected / char_h if char_h > 0 else 0

    if leg_ratio < 0.15:
        crotch_y = bbox[1] + int(char_h * 0.75)
        print(f"  [FALLBACK] crotch detection failed (ratio={leg_ratio:.2f}), using 75% position: crotch_y={crotch_y}")

    # 상체
    upper = np.zeros_like(arr)
    upper[:crotch_y] = arr[:crotch_y]

    # 다리 전체 (교차용으로 2개 복제)
    legs_full = np.zeros_like(arr)
    legs_full[crotch_y:] = arr[crotch_y:]

    # 상체 전단량 (다리 높이 비례)
    leg_h = bbox[3] - crotch_y
    sway = max(6, int(leg_h * 0.12))

    # 다리 교차: 같은 다리를 복제해서 하나는 앞으로, 하나는 뒤로
    frames = []
    for f in range(4):
        if f == 0 or f == 2:
            frames.append(img.copy())
        elif f == 1:
            # 앞다리: 앞(+x)으로 + 살짝 위(-y)
            # 뒷다리: 뒤(-x)로 + 살짝 아래(+y)
            upper_swayed = shear_upper_body(upper, crotch_y, bbox, -sway)
            upper_shifted = shift_region(upper_swayed, 0, BODY_BOB_Y)
            leg_front = shift_region(legs_full, SIDE_LEG_SHIFT_X, -LEG_SHIFT_Y // 3)
            leg_back = shift_region(legs_full, -SIDE_LEG_SHIFT_X, LEG_SHIFT_Y // 4)
            # 뒷다리 먼저, 앞다리가 위에 (교차 느낌)
            composed = compose_layers(leg_back, leg_front, upper_shifted)
            frames.append(Image.fromarray(composed))
        else:  # f == 3
            upper_swayed = shear_upper_body(upper, crotch_y, bbox, sway)
            upper_shifted = shift_region(upper_swayed, 0, BODY_BOB_Y)
            leg_front = shift_region(legs_full, -SIDE_LEG_SHIFT_X, -LEG_SHIFT_Y // 3)
            leg_back = shift_region(legs_full, SIDE_LEG_SHIFT_X, LEG_SHIFT_Y // 4)
            composed = compose_layers(leg_back, leg_front, upper_shifted)
            frames.append(Image.fromarray(composed))

    return frames


def create_spritesheet(direction_frames: dict[str, list[Image.Image]], target_size: tuple = None, row_order: list[str] = None) -> Image.Image:
    """
    N방향 × 4프레임 → 스프라이트시트

    direction_frames: {"down": [...], "left": [...], ...}
    target_size: (width, height) per frame. None이면 소스 크기 유지
    row_order: 행 순서 리스트
    """
    if row_order is None:
        row_order = ["down", "left", "right", "up"]

    # 소스 크기
    sample = list(direction_frames.values())[0][0]
    src_w, src_h = sample.size

    fw = target_size[0] if target_size else src_w
    fh = target_size[1] if target_size else src_h

    num_rows = len(row_order)
    sheet = Image.new("RGBA", (fw * SPRITE_COLS, fh * num_rows), (0, 0, 0, 0))

    for row_idx, direction in enumerate(row_order):
        if direction not in direction_frames:
            continue
        for col_idx, frame in enumerate(direction_frames[direction]):
            if target_size:
                frame = frame.resize(target_size, Image.LANCZOS)
            sheet.paste(frame, (col_idx * fw, row_idx * fh))

    return sheet


def crop_to_content(img: Image.Image, padding: int = 5) -> Image.Image:
    """투명 영역 잘라내기 (패딩 포함)"""
    arr = np.array(img)
    alpha = arr[:, :, 3]
    bbox = find_bbox(alpha)
    if bbox is None:
        return img

    x_min, y_min, x_max, y_max = bbox
    x_min = max(0, x_min - padding)
    y_min = max(0, y_min - padding)
    x_max = min(img.width - 1, x_max + padding)
    y_max = min(img.height - 1, y_max + padding)

    return img.crop((x_min, y_min, x_max + 1, y_max + 1))


def normalize_frame_size(frames: list[Image.Image]) -> list[Image.Image]:
    """모든 프레임을 동일 크기로 맞추기 (가장 큰 bbox 기준)"""
    # 전체 프레임의 최대 bbox 찾기
    all_frames = []
    for f in frames:
        arr = np.array(f)
        bbox = find_bbox(arr[:, :, 3])
        all_frames.append((f, bbox))

    max_w = max(b[2] - b[0] + 1 for _, b in all_frames if b)
    max_h = max(b[3] - b[1] + 1 for _, b in all_frames if b)

    # 정사각형에 가깝게 + 패딩
    pad = 10
    canvas_w = max_w + pad * 2
    canvas_h = max_h + pad * 2

    normalized = []
    for f, bbox in all_frames:
        if bbox is None:
            normalized.append(Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0)))
            continue

        # crop 후 캔버스 중앙 하단 정렬
        cropped = f.crop((bbox[0] - pad, bbox[1] - pad, bbox[2] + 1 + pad, bbox[3] + 1 + pad))
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

        # 하단 정렬
        x_offset = (canvas_w - cropped.width) // 2
        y_offset = canvas_h - cropped.height
        canvas.paste(cropped, (x_offset, y_offset))
        normalized.append(canvas)

    return normalized


def main():
    parser = argparse.ArgumentParser(description="Walking frame generator")
    parser.add_argument("--char", required=True, help="Character ID (e.g., c02)")
    parser.add_argument("--preview", action="store_true", help="Show preview strip")
    parser.add_argument("--game-sheet", action="store_true", help="Also generate 32x48 game sprite sheet")
    args = parser.parse_args()

    char = args.char
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 파일 로드
    images = {}
    for direction, pattern in FILE_PATTERNS.items():
        filename = pattern.format(char=char)

        path = os.path.join(BATCH_DIR, filename)
        if not os.path.exists(path):
            print(f"[SKIP] {path} not found")
            continue

        img = Image.open(path).convert("RGBA")
        # 흰색 프린지 제거 (Rembg 잔여물)
        img = Image.fromarray(remove_white_fringe(np.array(img)))
        images[direction] = img
        print(f"[LOAD] {direction}: {filename} ({img.size}) — defringe applied")

    if not images:
        print("No images found!")
        sys.exit(1)

    # 각 방향 걷기 프레임 생성
    direction_frames = {}

    for direction, img in images.items():
        print(f"\n[{direction.upper()}] Generating walk frames...")

        if direction in ("front", "back"):
            frames = generate_frontal_walk_frames(img)
        else:  # left
            frames = generate_side_walk_frames(img)

        direction_frames[direction] = frames

        # 개별 프레임 저장
        for i, frame in enumerate(frames):
            fname = f"{char}_{direction}_walk_f{i}.png"
            frame.save(os.path.join(OUTPUT_DIR, fname))

        print(f"  → 4 frames saved")

    # right = left mirror
    if "left" in direction_frames:
        direction_frames["right"] = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in direction_frames["left"]]
        print(f"\n[RIGHT] Mirrored from left")

    # 게임 방향 매핑 (4방향 기본)
    game_directions = {}
    if "front" in direction_frames:
        game_directions["down"] = direction_frames["front"]
    if "left" in direction_frames:
        game_directions["left"] = direction_frames["left"]
    if "right" in direction_frames:
        game_directions["right"] = direction_frames["right"]
    if "back" in direction_frames:
        game_directions["up"] = direction_frames["back"]

    if len(game_directions) < 4:
        print("Not enough directions!")
        sys.exit(1)

    # 8방향: 대각선 = 측면 스프라이트 재사용
    game_directions["down_left"] = [f.copy() for f in game_directions["left"]]
    game_directions["down_right"] = [f.copy() for f in game_directions["right"]]
    game_directions["up_left"] = [f.copy() for f in game_directions["left"]]
    game_directions["up_right"] = [f.copy() for f in game_directions["right"]]
    print(f"\n[DIAGONAL] 4 diagonal directions = side view reuse")

    # 8방향 행 순서
    ROW_ORDER_8 = ["down", "down_left", "left", "up_left", "up", "up_right", "right", "down_right"]
    ROW_ORDER_4 = ["down", "left", "right", "up"]

    # 모든 프레임 수집 → 크기 정규화 (8방향 전체)
    all_frames = []
    for d in ROW_ORDER_8:
        all_frames.extend(game_directions[d])

    normalized = normalize_frame_size(all_frames)

    # 다시 방향별로 분배
    idx = 0
    for d in ROW_ORDER_8:
        count = len(game_directions[d])
        game_directions[d] = normalized[idx:idx+count]
        idx += count

    # === 8방향 스프라이트시트 ===
    sheet_8 = create_spritesheet(game_directions, row_order=ROW_ORDER_8)
    sheet_8_path = os.path.join(OUTPUT_DIR, f"{char}_8dir_hires.png")
    sheet_8.save(sheet_8_path)
    print(f"\n[SHEET] 8-dir Hi-res: {sheet_8.size} → {sheet_8_path}")

    game_sheet_8 = create_spritesheet(game_directions, target_size=(GAME_FRAME_W, GAME_FRAME_H), row_order=ROW_ORDER_8)
    game_path_8 = os.path.join(OUTPUT_DIR, f"{char}_8dir_96x128.png")
    game_sheet_8.save(game_path_8)
    print(f"[SHEET] 8-dir Game: {game_sheet_8.size} → {game_path_8}")

    preview_8 = game_sheet_8.resize((game_sheet_8.width * 4, game_sheet_8.height * 4), Image.NEAREST)
    preview_8_path = os.path.join(OUTPUT_DIR, f"{char}_8dir_preview_4x.png")
    preview_8.save(preview_8_path)
    print(f"[PREVIEW] 8-dir 4x: {preview_8.size} → {preview_8_path}")

    # === 4방향 스프라이트시트 (호환용) ===
    sheet_4 = create_spritesheet(game_directions, row_order=ROW_ORDER_4)
    sheet_4_path = os.path.join(OUTPUT_DIR, f"{char}_spritesheet_hires.png")
    sheet_4.save(sheet_4_path)

    game_sheet_4 = create_spritesheet(game_directions, target_size=(GAME_FRAME_W, GAME_FRAME_H), row_order=ROW_ORDER_4)
    game_path_4 = os.path.join(OUTPUT_DIR, f"{char}_spritesheet_96x128.png")
    game_sheet_4.save(game_path_4)

    preview_4 = game_sheet_4.resize((game_sheet_4.width * 4, game_sheet_4.height * 4), Image.NEAREST)
    preview_4_path = os.path.join(OUTPUT_DIR, f"{char}_preview_4x.png")
    preview_4.save(preview_4_path)
    print(f"[SHEET] 4-dir Game: {game_sheet_4.size} (compat)")

    print("\nDone!")


if __name__ == "__main__":
    main()
