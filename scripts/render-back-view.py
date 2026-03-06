"""
Render a 3D GLB mesh from specific camera angles to 2D PNG images.
Uses Open3D Visualizer (OpenGL, works on Windows).

Usage:
  python scripts/render-back-view.py <input.glb> <output.png> [--size 1024] [--azimuth 180]
"""

import sys
import argparse
import numpy as np


def render_mesh_from_angle(glb_path: str, output_path: str, size: int = 1024, azimuth: float = 180.0, elevation: float = 0.0):
    import open3d as o3d

    # Load GLB mesh
    mesh = o3d.io.read_triangle_mesh(glb_path)
    if mesh.is_empty():
        print(f"ERROR: Failed to load mesh from {glb_path}")
        sys.exit(1)

    print(f"Loaded mesh: {len(mesh.vertices)} vertices, {len(mesh.triangles)} triangles")
    mesh.compute_vertex_normals()

    # Get bounding box
    bbox = mesh.get_axis_aligned_bounding_box()
    center = bbox.get_center()
    extent = bbox.get_max_extent()
    print(f"Bounding box center: {center}, extent: {extent}")

    # Create visualizer (hidden window)
    vis = o3d.visualization.Visualizer()
    vis.create_window(width=size, height=size, visible=False)
    vis.add_geometry(mesh)

    # Render options
    opt = vis.get_render_option()
    opt.background_color = np.array([1.0, 1.0, 1.0])  # White background
    opt.light_on = True

    # Setup camera
    ctr = vis.get_view_control()

    # Calculate camera position
    az_rad = np.radians(azimuth)
    el_rad = np.radians(elevation)
    distance = extent * 2.0

    cam_x = distance * np.cos(el_rad) * np.sin(az_rad)
    cam_y = distance * np.sin(el_rad)
    cam_z = distance * np.cos(el_rad) * np.cos(az_rad)

    eye = center + np.array([cam_x, cam_y, cam_z])
    up = np.array([0.0, 1.0, 0.0])

    # Set camera look-at
    ctr.set_lookat(center)
    ctr.set_front((eye - center) / np.linalg.norm(eye - center))
    ctr.set_up(up)
    ctr.set_zoom(0.7)

    # Render and capture
    vis.poll_events()
    vis.update_renderer()
    vis.capture_screen_image(output_path, do_render=True)
    vis.destroy_window()

    print(f"Rendered to: {output_path} ({size}x{size})")
    print(f"  Azimuth: {azimuth} deg, Elevation: {elevation} deg")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Render GLB mesh from specific camera angle")
    parser.add_argument("input", help="Path to input GLB file")
    parser.add_argument("output", help="Path to output PNG file")
    parser.add_argument("--size", type=int, default=1024, help="Output image size (default: 1024)")
    parser.add_argument("--azimuth", type=float, default=180.0, help="Camera azimuth in degrees (default: 180 = back)")
    parser.add_argument("--elevation", type=float, default=0.0, help="Camera elevation in degrees (default: 0)")

    args = parser.parse_args()
    render_mesh_from_angle(args.input, args.output, args.size, args.azimuth, args.elevation)


if __name__ == "__main__":
    main()
