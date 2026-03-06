"""흰 테두리 해결 비교 테스트 — 5가지 접근법

테스트 대상: front/back/left (1024x1024 RGBA)
비교 조건:
  A) 어두운 배경(#2a2a3a) 합성 — 원본 해상도
  B) 게임 해상도(48x64) 축소 후 어두운 배경 합성
측정: edge band별 white%, avg RGB, 시각적 비교 이미지 출력
"""

import sys
import os
import numpy as np
from PIL import Image

# ── 설정 ──
INPUT_DIR = "C:/Users/User/ComfyUI/output/final"
OUTPUT_DIR = "C:/Users/User/ComfyUI/output/defringe_compare"
DARK_BG = (42, 42, 58)  # #2a2a3a (게임 배경 근사)
GAME_SIZE = (48, 64)
DIRECTIONS = ["front", "back", "left"]
FILES = {
    "front": "front_00001_.png",
    "back": "back_00001_.png",
    "left": "left_00001_.png",
}

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ════════════════════════════════════════
# 접근법 1: 현재 remove_white_fringe (베이스라인)
# ════════════════════════════════════════
def method_current(arr: np.ndarray) -> np.ndarray:
    """inverse alpha deblending: true_rgb = (blended - (1-a)*255) / a"""
    result = arr.copy().astype(np.float64)
    alpha = result[:, :, 3]
    mask = (alpha > 0) & (alpha < 255)
    if not np.any(mask):
        return arr.copy()
    a = alpha[mask] / 255.0
    for c in range(3):
        ch = result[:, :, c]
        corrected = (ch[mask] - (1.0 - a) * 255.0) / np.maximum(a, 0.01)
        ch[mask] = np.clip(corrected, 0, 255)
        result[:, :, c] = ch
    return result.astype(np.uint8)


# ════════════════════════════════════════
# 접근법 2: Premultiply alpha
# ════════════════════════════════════════
def method_premultiply(arr: np.ndarray, threshold: int = 230) -> np.ndarray:
    """RGB *= alpha/255 for semi-transparent pixels"""
    result = arr.copy().astype(np.float32)
    alpha = result[:, :, 3]
    mask = (alpha > 0) & (alpha < threshold)
    factor = np.ones_like(alpha)
    factor[mask] = alpha[mask] / 255.0
    for c in range(3):
        result[:, :, c] *= factor
    return np.clip(result, 0, 255).astype(np.uint8)


# ════════════════════════════════════════
# 접근법 3: Mask Erode + Premultiply
# ════════════════════════════════════════
def method_erode_premultiply(arr: np.ndarray, erode_px: int = 4, premul_threshold: int = 230) -> np.ndarray:
    """erode alpha mask → then premultiply remaining semi-transparent"""
    try:
        import cv2
    except ImportError:
        print("WARNING: cv2 not available, skipping erode")
        return method_premultiply(arr, premul_threshold)

    result = arr.copy()
    alpha = result[:, :, 3].copy()

    # erode: alpha mask 축소
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode_px * 2 + 1, erode_px * 2 + 1))
    alpha_eroded = cv2.erode(alpha, kernel, iterations=1)
    result[:, :, 3] = alpha_eroded

    # premultiply on remaining semi-transparent
    return method_premultiply(result, premul_threshold)


# ════════════════════════════════════════
# 접근법 4: Color-to-Mask 선택적 흰색 제거
# ════════════════════════════════════════
def method_color_mask(arr: np.ndarray, white_threshold: int = 210, edge_width: int = 8) -> np.ndarray:
    """가장자리의 흰색 픽셀만 선택적 투명화 (검은 라인 보존)"""
    try:
        import cv2
    except ImportError:
        print("WARNING: cv2 not available, skipping color_mask")
        return arr.copy()

    result = arr.copy()
    alpha = result[:, :, 3]
    rgb = result[:, :, :3]

    # 1) 흰색 마스크: RGB 모두 threshold 이상
    white_mask = np.all(rgb >= white_threshold, axis=2) & (alpha > 0)

    # 2) edge 마스크: alpha 경계에서 edge_width px 이내
    opaque = (alpha >= 200).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (edge_width * 2 + 1, edge_width * 2 + 1))
    eroded = cv2.erode(opaque, kernel, iterations=1)
    edge_mask = (opaque.astype(bool)) & (~eroded.astype(bool))

    # 반투명 영역도 edge로 포함
    semi_transparent = (alpha > 0) & (alpha < 200)
    edge_mask = edge_mask | semi_transparent

    # 3) 교집합: 가장자리 + 흰색 → 투명화
    target = white_mask & edge_mask
    result[:, :, 3][target] = 0

    # 4) 새로 생긴 edge에 대해 premultiply (잔여 halo 방지)
    return method_premultiply(result, 230)


# ════════════════════════════════════════
# 측정 함수
# ════════════════════════════════════════
def measure_edge_quality(arr: np.ndarray, n_bands: int = 5) -> dict:
    """edge band별 white%, avg RGB 측정"""
    try:
        import cv2
    except ImportError:
        return {"error": "cv2 not available"}

    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]

    results = {}
    prev_mask = np.zeros_like(alpha, dtype=bool)

    for band in range(1, n_bands + 1):
        # band N: alpha 경계에서 N px 안쪽
        opaque = (alpha > 0).astype(np.uint8)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (band * 2 + 1, band * 2 + 1))
        eroded = cv2.erode(opaque, kernel, iterations=1)
        # 이 band = eroded의 경계
        band_mask = (opaque.astype(bool)) & (~eroded.astype(bool)) & (~prev_mask)

        if not np.any(band_mask):
            results[f"band_{band}"] = {"pixels": 0, "white_pct": 0, "avg_rgb": (0, 0, 0)}
            prev_mask = prev_mask | band_mask
            continue

        band_rgb = rgb[band_mask]
        band_alpha = alpha[band_mask]

        # white: all channels > 200
        white_count = np.sum(np.all(band_rgb > 200, axis=1))
        white_pct = white_count / len(band_rgb) * 100

        avg_r = np.mean(band_rgb[:, 0])
        avg_g = np.mean(band_rgb[:, 1])
        avg_b = np.mean(band_rgb[:, 2])
        avg_a = np.mean(band_alpha)

        results[f"band_{band}"] = {
            "pixels": int(len(band_rgb)),
            "white_pct": round(white_pct, 1),
            "avg_rgb": (round(avg_r, 1), round(avg_g, 1), round(avg_b, 1)),
            "avg_alpha": round(avg_a, 1),
        }
        prev_mask = prev_mask | band_mask

    # 전체 edge (band 1~5 합산)
    all_edge = np.zeros_like(alpha, dtype=bool)
    opaque = (alpha > 0).astype(np.uint8)
    kernel5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    eroded5 = cv2.erode(opaque, kernel5, iterations=1)
    all_edge = (opaque.astype(bool)) & (~eroded5.astype(bool))

    if np.any(all_edge):
        edge_rgb = rgb[all_edge]
        white_total = np.sum(np.all(edge_rgb > 200, axis=1))
        results["total_edge"] = {
            "pixels": int(len(edge_rgb)),
            "white_pct": round(white_total / len(edge_rgb) * 100, 1),
            "avg_rgb": (
                round(np.mean(edge_rgb[:, 0]), 1),
                round(np.mean(edge_rgb[:, 1]), 1),
                round(np.mean(edge_rgb[:, 2]), 1),
            ),
        }

    return results


def composite_on_dark(arr: np.ndarray, bg_color=DARK_BG) -> np.ndarray:
    """RGBA를 어두운 배경 위에 합성"""
    h, w = arr.shape[:2]
    bg = np.full((h, w, 3), bg_color, dtype=np.uint8)
    alpha = arr[:, :, 3].astype(np.float32) / 255.0
    for c in range(3):
        bg[:, :, c] = (arr[:, :, c].astype(np.float32) * alpha + bg[:, :, c].astype(np.float32) * (1 - alpha)).astype(np.uint8)
    return bg


def resize_to_game(arr: np.ndarray) -> np.ndarray:
    """1024x1024 RGBA → bbox crop → 48x64 RGBA (게임 해상도)"""
    alpha = arr[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not np.any(rows) or not np.any(cols):
        return arr
    r0, r1 = np.where(rows)[0][[0, -1]]
    c0, c1 = np.where(cols)[0][[0, -1]]
    cropped = arr[r0:r1+1, c0:c1+1]
    img = Image.fromarray(cropped)
    img = img.resize(GAME_SIZE, Image.LANCZOS)
    return np.array(img)


# ════════════════════════════════════════
# 메인
# ════════════════════════════════════════
def main():
    methods = {
        "0_original": lambda arr: arr.copy(),
        "1_current": method_current,
        "2_premultiply": method_premultiply,
        "3_erode4_premul": method_erode_premultiply,
        "4_color_mask": method_color_mask,
    }

    all_results = {}

    for direction in DIRECTIONS:
        filepath = os.path.join(INPUT_DIR, FILES[direction])
        if not os.path.exists(filepath):
            print(f"SKIP: {filepath} not found")
            continue

        img = Image.open(filepath).convert("RGBA")
        arr = np.array(img)
        print(f"\n{'='*60}")
        print(f"Direction: {direction} ({img.size})")
        print(f"{'='*60}")

        direction_results = {}

        # 각 방법 적용 + 측정
        for method_name, method_fn in methods.items():
            processed = method_fn(arr)
            metrics = measure_edge_quality(processed)
            direction_results[method_name] = metrics

            # 원본 해상도: 어두운 배경 합성
            dark_comp = composite_on_dark(processed)
            Image.fromarray(dark_comp).save(
                os.path.join(OUTPUT_DIR, f"{direction}_{method_name}_dark.png")
            )

            # 게임 해상도: crop → resize → 어두운 배경 합성
            game_arr = resize_to_game(processed)
            game_dark = composite_on_dark(game_arr)
            # 4x 확대 (시각 확인용)
            game_4x = Image.fromarray(game_dark).resize(
                (GAME_SIZE[0] * 4, GAME_SIZE[1] * 4), Image.NEAREST
            )
            game_4x.save(
                os.path.join(OUTPUT_DIR, f"{direction}_{method_name}_game4x.png")
            )

            # RGBA 그대로 저장 (추가 분석용)
            Image.fromarray(processed).save(
                os.path.join(OUTPUT_DIR, f"{direction}_{method_name}_rgba.png")
            )

        all_results[direction] = direction_results

        # 결과 테이블 출력
        print(f"\n{'Method':<22} {'Edge White%':>11} {'Edge Avg RGB':>20} {'Band1 White%':>12} {'Band3 White%':>12}")
        print("-" * 80)
        for method_name, metrics in direction_results.items():
            total = metrics.get("total_edge", {})
            b1 = metrics.get("band_1", {})
            b3 = metrics.get("band_3", {})
            print(
                f"{method_name:<22} "
                f"{total.get('white_pct', 'N/A'):>10}% "
                f"{str(total.get('avg_rgb', 'N/A')):>20} "
                f"{b1.get('white_pct', 'N/A'):>11}% "
                f"{b3.get('white_pct', 'N/A'):>11}%"
            )

    # ── 비교 이미지 생성 (한 방향당 가로 5장 병합) ──
    print(f"\n{'='*60}")
    print("Generating comparison strips...")
    for direction in DIRECTIONS:
        strips_dark = []
        strips_game = []
        for method_name in methods.keys():
            dark_path = os.path.join(OUTPUT_DIR, f"{direction}_{method_name}_dark.png")
            game_path = os.path.join(OUTPUT_DIR, f"{direction}_{method_name}_game4x.png")
            if os.path.exists(dark_path):
                strips_dark.append(Image.open(dark_path))
            if os.path.exists(game_path):
                strips_game.append(Image.open(game_path))

        if strips_dark:
            # 원본 해상도 비교 (512px 높이로 축소)
            target_h = 512
            resized = []
            for s in strips_dark:
                ratio = target_h / s.height
                resized.append(s.resize((int(s.width * ratio), target_h), Image.LANCZOS))
            total_w = sum(r.width for r in resized) + (len(resized) - 1) * 4
            strip = Image.new("RGB", (total_w, target_h), (20, 20, 30))
            x = 0
            for r in resized:
                strip.paste(r, (x, 0))
                x += r.width + 4
            strip.save(os.path.join(OUTPUT_DIR, f"COMPARE_{direction}_dark.png"))

        if strips_game:
            # 게임 해상도 비교 (4x)
            total_w = sum(s.width for s in strips_game) + (len(strips_game) - 1) * 4
            max_h = max(s.height for s in strips_game)
            strip = Image.new("RGB", (total_w, max_h), (20, 20, 30))
            x = 0
            for s in strips_game:
                strip.paste(s, (x, 0))
                x += s.width + 4
            strip.save(os.path.join(OUTPUT_DIR, f"COMPARE_{direction}_game4x.png"))

    print(f"\nAll outputs saved to: {OUTPUT_DIR}")
    print("Files: COMPARE_{direction}_dark.png (원본 해상도), COMPARE_{direction}_game4x.png (게임 4x)")


if __name__ == "__main__":
    main()
