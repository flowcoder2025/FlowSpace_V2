"""
render-3d-views.py — GLB 모델을 4방향(front/left/back/right)으로 렌더링

Usage:
    python scripts/render-3d-views.py <glb_path> [--output-dir <dir>] [--size <px>]

Output:
    {output_dir}/front.png
    {output_dir}/left.png
    {output_dir}/back.png
    {output_dir}/right.png

Dependencies:
    pip install pyvista trimesh Pillow
"""

import argparse
import math
import os
import sys

import numpy as np

try:
    import pyvista as pv
except ImportError:
    print("ERROR: pyvista is required. Install with: pip install pyvista")
    sys.exit(1)

try:
    import trimesh
except ImportError:
    print("ERROR: trimesh is required. Install with: pip install trimesh")
    sys.exit(1)

from PIL import Image

# Enable offscreen rendering
pv.OFF_SCREEN = True

# 4방향 카메라 각도 (Y축 기준 회전, degree)
DIRECTIONS = {
    "front": 0,
    "left": 90,
    "back": 180,
    "right": 270,
}


def load_glb_to_pyvista(path: str) -> pv.PolyData:
    """GLB 파일을 PyVista PolyData로 로드 (trimesh 경유)"""
    scene = trimesh.load(path, force="scene")

    if isinstance(scene, trimesh.Scene):
        meshes = []
        for geom in scene.geometry.values():
            if isinstance(geom, trimesh.Trimesh):
                meshes.append(geom)
        if not meshes:
            raise ValueError(f"No meshes found in {path}")
        combined = trimesh.util.concatenate(meshes)
    elif isinstance(scene, trimesh.Trimesh):
        combined = scene
    else:
        raise ValueError(f"Unexpected type: {type(scene)}")

    # PyVista로 변환
    faces_pv = np.column_stack([
        np.full(len(combined.faces), 3),
        combined.faces,
    ]).ravel()
    mesh = pv.PolyData(combined.vertices, faces_pv)

    # 버텍스 컬러 복사
    if combined.visual and hasattr(combined.visual, "vertex_colors"):
        try:
            colors = np.array(combined.visual.vertex_colors[:, :3], dtype=np.uint8)
            mesh.point_data["RGB"] = colors
        except Exception:
            pass

    return mesh


def center_and_normalize(mesh: pv.PolyData) -> pv.PolyData:
    """메시를 원점 중심으로 이동하고 단위 크기로 정규화"""
    center = mesh.center
    mesh.translate(-np.array(center), inplace=True)

    bounds = mesh.bounds
    extent = max(
        bounds[1] - bounds[0],  # x
        bounds[3] - bounds[2],  # y
        bounds[5] - bounds[4],  # z
    )
    if extent > 0:
        mesh.scale(2.0 / extent, inplace=True)

    # 바닥이 y=0이 되도록 조정 (캐릭터 중심이 화면 중앙)
    new_bounds = mesh.bounds
    y_min = new_bounds[2]
    y_max = new_bounds[3]
    y_center = (y_min + y_max) / 2.0
    mesh.translate([0, -y_center, 0], inplace=True)

    return mesh


def render_view(
    mesh: pv.PolyData,
    angle_deg: float,
    size: int = 1024,
) -> np.ndarray:
    """특정 각도에서 메시를 렌더링하여 RGBA numpy 배열 반환"""
    plotter = pv.Plotter(off_screen=True, window_size=[size, size])
    plotter.set_background("white")

    # 메시 추가
    if "RGB" in mesh.point_data:
        plotter.add_mesh(mesh, scalars="RGB", rgb=True, smooth_shading=True)
    else:
        plotter.add_mesh(mesh, color="lightgray", smooth_shading=True)

    # 조명 — 카메라 방향 기준으로 key/fill/rim 배치
    plotter.remove_all_lights()
    angle_rad = math.radians(angle_deg)
    sin_a = math.sin(angle_rad)
    cos_a = math.cos(angle_rad)

    # Key light: 카메라 약간 위+옆
    plotter.add_light(pv.Light(
        position=(sin_a * 4 + cos_a * 1, 3, cos_a * 4 - sin_a * 1),
        focal_point=(0, 0, 0),
        intensity=1.0,
    ))
    # Fill light: 카메라 반대쪽
    plotter.add_light(pv.Light(
        position=(-sin_a * 3, 1, -cos_a * 3),
        focal_point=(0, 0, 0),
        intensity=0.5,
    ))
    # Top light: 위에서
    plotter.add_light(pv.Light(
        position=(0, 5, 0),
        focal_point=(0, 0, 0),
        intensity=0.6,
    ))
    # Ambient-like: 아래에서 반사광 시뮬레이션
    plotter.add_light(pv.Light(
        position=(0, -3, 0),
        focal_point=(0, 0, 0),
        intensity=0.2,
    ))

    # 카메라 위치 계산 (Y-up, 더 멀리서)
    distance = 4.5
    cam_x = distance * sin_a
    cam_z = distance * cos_a

    plotter.camera.position = (cam_x, 0.2, cam_z)
    plotter.camera.focal_point = (0.0, 0.0, 0.0)
    plotter.camera.up = (0.0, 1.0, 0.0)
    plotter.camera.view_angle = 25.0  # 더 좁은 FOV → 캐릭터가 프레임에 맞음

    # 렌더링
    img = plotter.screenshot(transparent_background=True, return_img=True)
    plotter.close()

    return img  # RGBA numpy array


def save_png(arr: np.ndarray, path: str):
    """RGBA numpy 배열을 PNG로 저장"""
    if arr.shape[2] == 4:
        img = Image.fromarray(arr, "RGBA")
    else:
        img = Image.fromarray(arr, "RGB")
    img.save(path)
    print(f"  Saved: {path} ({img.size[0]}x{img.size[1]})")


def main():
    parser = argparse.ArgumentParser(description="Render GLB model from 4 directions")
    parser.add_argument("glb_path", help="Path to GLB file")
    parser.add_argument("--output-dir", "-o", default=None, help="Output directory")
    parser.add_argument("--size", "-s", type=int, default=1024, help="Render size (default: 1024)")
    args = parser.parse_args()

    if not os.path.exists(args.glb_path):
        print(f"ERROR: File not found: {args.glb_path}")
        sys.exit(1)

    output_dir = args.output_dir or os.path.join(
        os.path.dirname(args.glb_path), "renders"
    )
    os.makedirs(output_dir, exist_ok=True)

    print(f"Loading GLB: {args.glb_path}")
    mesh = load_glb_to_pyvista(args.glb_path)
    mesh = center_and_normalize(mesh)
    print(f"  Points: {mesh.n_points}, Cells: {mesh.n_cells}")
    print(f"  Has vertex colors: {'RGB' in mesh.point_data}")

    print(f"\nRendering 4 directions at {args.size}x{args.size}...")
    for direction, angle in DIRECTIONS.items():
        print(f"  Rendering {direction} ({angle} deg)...")
        rgba = render_view(mesh, angle, args.size)
        out_path = os.path.join(output_dir, f"{direction}.png")
        save_png(rgba, out_path)

    print(f"\nDone! Renders saved to: {output_dir}")


if __name__ == "__main__":
    main()
