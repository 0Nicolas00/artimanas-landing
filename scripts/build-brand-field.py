"""Regenerate the glass distance and contour position maps from the SVG paths."""
import gzip
from pathlib import Path
import struct
import subprocess
from xml.etree import ElementTree
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter
from scipy.spatial import cKDTree
from svgpathtools import parse_path

source = Path(__file__).resolve().parents[1] / "src"
texture_size = (1220, 814)
supersampling = 3
hero_design_height = 684
distance_range = 0.12
silhouettes = ElementTree.parse(source / "brand-contours.svg").getroot()


def contour_samples(path):
    points = []
    for segment in parse_path(path):
        steps = max(1, int(np.ceil(segment.length())))
        points.extend(segment.point(i / steps) for i in range(steps))
    points.append(points[0])
    coordinates = np.column_stack((np.real(points), np.imag(points)))
    lengths = np.linalg.norm(np.diff(coordinates, axis=0), axis=1)
    fraction = np.r_[0, np.cumsum(lengths)] / lengths.sum()
    return coordinates, np.rint(fraction * 255).astype(np.uint8)

with TemporaryDirectory() as temporary:
    mask_path = Path(temporary) / "mask.png"
    subprocess.run([
        "inkscape", str(source / "brand-contours.svg"),
        f"--export-width={texture_size[0] * supersampling}",
        f"--export-filename={mask_path}",
    ], check=True)
    mask = np.asarray(Image.open(mask_path).convert("RGBA"))[:, :, 3] >= 128

inside = distance_transform_edt(mask)
outside = distance_transform_edt(~mask)
hero_pixel_height = hero_design_height * mask.shape[1] / 1220
distance = (outside - inside + np.where(mask, 0.5, -0.5)) / hero_pixel_height
# Smooth the distance ramp before encoding it, so the lighting follows curves
# instead of the pixel steps of the binary mask.
distance = np.asarray(Image.fromarray(distance.astype(np.float32)).resize(texture_size, Image.Resampling.BOX))
distance = gaussian_filter(distance, sigma=.72)
normalized = np.clip(distance / distance_range, -1, 1) * 0.5 + 0.5
encoded = np.rint(normalized * 4095).astype(np.uint16)
# Red and green store the signed distance; blue and alpha locate the nearest point on a path.
samples = [contour_samples(path.attrib["d"]) for path in silhouettes]
x, y = np.meshgrid(np.arange(texture_size[0]) - 64.5, np.arange(texture_size[1]) - 64.5)
_, nearest = cKDTree(np.concatenate([points for points, _ in samples])).query(np.dstack((x, y)))
arc = np.concatenate([fraction for _, fraction in samples])[nearest]
shape = np.concatenate([np.full(len(points), i, dtype=np.uint8) for i, (points, _) in enumerate(samples)])[nearest]
planes = np.stack([encoded >> 4, (encoded & 15) * 17, arc, shape]).astype(np.uint8)
delta = np.diff(planes, axis=2, prepend=np.zeros_like(planes[:, :, :1]))
header = struct.pack("<HH", *texture_size)
(source / "brand-glass-field.gz").write_bytes(gzip.compress(header + delta.tobytes(), mtime=0))

# The vector layer uses the same paths when canvas rendering is disabled.
paths = "".join(f'<path id="glass-{path.attrib["id"]}" pathLength="1" d="{path.attrib["d"]}"/>' for path in silhouettes)
pieces = "".join(
    f'<g class="glass-static-piece"><use class="glass-vector-body" href="#glass-{path.attrib["id"]}" fill="url(#glass-placeholder-fill)" stroke="none"/>'
    f'<g class="glass-vector-rim" fill="none" stroke="url(#glass-placeholder-edge)" stroke-linecap="round">'
    f'<use href="#glass-{path.attrib["id"]}" stroke-width="8" opacity=".32"/>'
    f'<use href="#glass-{path.attrib["id"]}" stroke-width="2.2"/></g></g>'
    for path in silhouettes
)
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1090 684" preserveAspectRatio="none">
  <defs>
    <linearGradient id="glass-placeholder-fill" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="#e8dfff" stop-opacity=".17"/>
      <stop offset=".48" stop-color="#11091a" stop-opacity=".25"/>
      <stop offset="1" stop-color="#f2ebff" stop-opacity=".12"/>
    </linearGradient>
    <linearGradient id="glass-placeholder-edge" x2=".82" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="#fff" stop-opacity=".84"/>
      <stop offset=".3" stop-color="#eee1ff" stop-opacity=".23"/>
      <stop offset=".58" stop-color="#fff" stop-opacity=".72"/>
      <stop offset="1" stop-color="#ede6ff" stop-opacity=".17"/>
    </linearGradient>
    {paths}
  </defs>
  <g stroke-linejoin="round">{pieces}</g>
</svg>
"""
(source.parent / "assets" / "brand-glass-static.svg").write_text(svg, encoding="utf-8")
