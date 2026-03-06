"""
Character Sheet 자동 분리 스크립트.

Rembg 처리된 character sheet에서 개별 캐릭터 뷰를 자동 감지 및 crop.
Connected component analysis로 각 캐릭터 영역의 bounding box를 찾고,
위치 기반으로 front/side/back을 식별합니다.

사용: python scripts/split-character-sheet.py <image_path> [output_dir]
"""
import sys
import os
import numpy as np
from PIL import Image
from scipy import ndimage

def load_image(path: str) -> tuple[np.ndarray, Image.Image]:
    """이미지 로드, RGBA 변환."""
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    return arr, img

def find_character_regions(arr: np.ndarray, min_area: int = 5000) -> list[dict]:
    """
    알파 채널 기반 connected component analysis.
    각 캐릭터 영역의 bounding box + 면적 반환.
    """
    alpha = arr[:, :, 3]

    # 이진화: 알파값 > 128인 픽셀
    binary = (alpha > 128).astype(np.uint8)

    # 가까운 영역 연결을 위해 약간 dilate
    struct = ndimage.generate_binary_structure(2, 2)
    dilated = ndimage.binary_dilation(binary, structure=struct, iterations=5)

    # Connected component labeling
    labeled, num_features = ndimage.label(dilated)

    regions = []
    for i in range(1, num_features + 1):
        component = (labeled == i)
        area = component.sum()

        if area < min_area:
            continue

        # Bounding box (원본 binary 기준으로 정밀하게)
        original_component = binary & component
        if original_component.sum() < min_area:
            continue

        rows = np.any(original_component, axis=1)
        cols = np.any(original_component, axis=0)
        y_min, y_max = np.where(rows)[0][[0, -1]]
        x_min, x_max = np.where(cols)[0][[0, -1]]

        # 약간의 padding
        padding = 10
        y_min = max(0, y_min - padding)
        x_min = max(0, x_min - padding)
        y_max = min(arr.shape[0] - 1, y_max + padding)
        x_max = min(arr.shape[1] - 1, x_max + padding)

        width = x_max - x_min
        height = y_max - y_min
        center_x = (x_min + x_max) / 2
        center_y = (y_min + y_max) / 2

        regions.append({
            "bbox": (x_min, y_min, x_max, y_max),
            "width": width,
            "height": height,
            "area": int(original_component.sum()),
            "center_x": center_x,
            "center_y": center_y,
        })

    # 크기순 정렬 (큰 것 = 전신 뷰일 가능성 높음)
    regions.sort(key=lambda r: r["area"], reverse=True)
    return regions

def classify_views(regions: list[dict], img_width: int, img_height: int) -> dict:
    """
    감지된 영역을 front/side/back으로 분류.

    전략:
    1. 전신 뷰만 선택 (높이가 이미지 높이의 30% 이상)
    2. x 위치 기반으로 좌→우 정렬
    3. 가장 큰 3개를 front/side/back으로 매핑
    """
    # 전신 뷰 필터: 높이가 충분한 것만
    min_height = img_height * 0.25
    fullbody = [r for r in regions if r["height"] >= min_height]

    if len(fullbody) < 3:
        print(f"WARNING: 전신 뷰 {len(fullbody)}개만 감지 (3개 필요)")
        fullbody = regions[:3]  # fallback: 가장 큰 3개

    # 상위 6개까지만 고려
    candidates = fullbody[:6]

    # 행 분리: y 중심 기준으로 상단/하단 그룹
    y_centers = [r["center_y"] for r in candidates]
    y_median = np.median(y_centers)

    top_row = sorted([r for r in candidates if r["center_y"] < y_median], key=lambda r: r["center_x"])
    bottom_row = sorted([r for r in candidates if r["center_y"] >= y_median], key=lambda r: r["center_x"])

    print(f"\n상단 행: {len(top_row)}개, 하단 행: {len(bottom_row)}개")

    # 전신 뷰가 더 많은 행을 주 행으로 선택
    # 높이 기준으로 더 큰 뷰가 있는 행 선택
    top_avg_h = np.mean([r["height"] for r in top_row]) if top_row else 0
    bottom_avg_h = np.mean([r["height"] for r in bottom_row]) if bottom_row else 0

    primary_row = bottom_row if bottom_avg_h >= top_avg_h else top_row
    secondary_row = top_row if bottom_avg_h >= top_avg_h else bottom_row

    print(f"주 행 (평균 높이 {max(top_avg_h, bottom_avg_h):.0f}px): {len(primary_row)}개")

    result = {}

    if len(primary_row) >= 3:
        # 3개 이상이면 좌→우 순서로 front/side/back 매핑
        # Character sheet 일반 규칙: 좌=3/4뷰, 중=정면, 우=후면
        result["side"] = primary_row[0]
        result["front"] = primary_row[1]
        result["back"] = primary_row[2]
    elif len(primary_row) == 2:
        # 2개면 secondary에서 보충
        all_sorted = sorted(primary_row + secondary_row, key=lambda r: r["center_x"])
        if len(all_sorted) >= 3:
            result["side"] = all_sorted[0]
            result["front"] = all_sorted[1]
            result["back"] = all_sorted[2]

    if not result and len(candidates) >= 3:
        # fallback: 전체를 x 기준 정렬
        all_sorted = sorted(candidates, key=lambda r: r["center_x"])
        result["side"] = all_sorted[0]
        result["front"] = all_sorted[len(all_sorted)//2]
        result["back"] = all_sorted[-1]

    return result

def crop_and_save(img: Image.Image, views: dict, output_dir: str):
    """각 뷰를 crop하여 저장."""
    os.makedirs(output_dir, exist_ok=True)

    for view_name, region in views.items():
        x_min, y_min, x_max, y_max = region["bbox"]
        cropped = img.crop((x_min, y_min, x_max + 1, y_max + 1))

        # 정사각형 패딩 (가장 긴 변 기준)
        max_dim = max(cropped.width, cropped.height)
        square = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
        offset_x = (max_dim - cropped.width) // 2
        offset_y = (max_dim - cropped.height) // 2
        square.paste(cropped, (offset_x, offset_y))

        output_path = os.path.join(output_dir, f"{view_name}.png")
        square.save(output_path)
        print(f"  {view_name}: {cropped.width}x{cropped.height} → {max_dim}x{max_dim} saved to {output_path}")

def main():
    if len(sys.argv) < 2:
        print("사용: python scripts/split-character-sheet.py <image_path> [output_dir]")
        sys.exit(1)

    image_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(image_path), "split")

    print(f"=== Character Sheet 자동 분리 ===")
    print(f"입력: {image_path}")
    print(f"출력: {output_dir}")

    # 1. 이미지 로드
    arr, img = load_image(image_path)
    print(f"이미지 크기: {img.width}x{img.height}")

    # 2. 캐릭터 영역 감지
    regions = find_character_regions(arr)
    print(f"\n감지된 캐릭터 영역: {len(regions)}개")
    for i, r in enumerate(regions):
        print(f"  [{i}] bbox={r['bbox']}, size={r['width']}x{r['height']}, area={r['area']}")

    # 3. front/side/back 분류
    views = classify_views(regions, img.width, img.height)
    if not views:
        print("\nERROR: front/side/back 분류 실패")
        sys.exit(1)

    print(f"\n분류 결과:")
    for name, r in views.items():
        print(f"  {name}: center=({r['center_x']:.0f}, {r['center_y']:.0f}), size={r['width']}x{r['height']}")

    # 4. Crop & Save
    print(f"\n개별 뷰 저장:")
    crop_and_save(img, views, output_dir)

    print(f"\n완료! {output_dir}에 {len(views)}개 뷰 저장됨")

if __name__ == "__main__":
    main()
