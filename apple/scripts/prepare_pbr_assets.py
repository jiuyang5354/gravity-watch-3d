#!/usr/bin/env python3
"""Prepare spotless CC0 PBR textures & studio HDRI for iOS + watchOS bundle."""

from pathlib import Path
import shutil
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_ASSETS_ROOT = Path(r"d:\gemini\重力表盘_Web交互演示器_2026-11-20\assets")
OUT_DIR = PROJECT_ROOT / "Shared" / "Resources" / "PBRTextures"

TEXTURE_SPECS = [
    ("textures/felt/diff.jpg", "felt_diff.jpg"),
    ("textures/felt/nor_gl.jpg", "felt_nor.jpg"),
    ("textures/felt/rough.jpg", "felt_rough.jpg"),
    ("textures/rubber/diff.jpg", "rubber_diff.jpg"),
    ("textures/rubber/nor_gl.jpg", "rubber_nor.jpg"),
    ("textures/rubber/rough.jpg", "rubber_rough.jpg"),
    ("textures/basketball_leather/diff.jpg", "bball_leather_diff.jpg"),
    ("textures/basketball_leather/nor_gl.jpg", "bball_leather_nor.jpg"),
    ("textures/basketball_leather/rough.jpg", "bball_leather_rough.jpg"),
    ("textures/maple_court/diff.jpg", "maple_diff.jpg"),
    ("textures/maple_court/nor_gl.jpg", "maple_nor.jpg"),
    ("textures/maple_court/rough.jpg", "maple_rough.jpg"),
    ("textures/black_marble/diff.jpg", "marble_diff.jpg"),
    ("textures/black_marble/nor_gl.jpg", "marble_nor.jpg"),
    ("textures/black_marble/rough.jpg", "marble_rough.jpg"),
    ("textures/metal_clean/nor_gl.jpg", "metal_nor.jpg"),
    ("textures/metal_clean/rough.jpg", "metal_rough.jpg"),
    ("textures/leather_white/nor_gl.jpg", "leather_white_nor.jpg"),
    ("textures/leather_white/rough.jpg", "leather_white_rough.jpg"),
    ("textures/leafy_grass/diff.jpg", "grass_diff.jpg"),
    ("textures/leafy_grass/nor_gl.jpg", "grass_nor.jpg"),
    ("textures/leafy_grass/rough.jpg", "grass_rough.jpg"),
    ("textures/velvet/diff.jpg", "velvet_diff.jpg"),
    ("textures/velvet/nor_gl.jpg", "velvet_nor.jpg"),
    ("textures/velvet/rough.jpg", "velvet_rough.jpg"),
]

HDR_SPEC = ("hdr/studio_small_09_1k.hdr", "studio_small_09.hdr")


def main() -> int:
    if not WEB_ASSETS_ROOT.is_dir():
        raise FileNotFoundError(f"Source web assets directory not found: {WEB_ASSETS_ROOT}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    written = 0

    hdr_src = WEB_ASSETS_ROOT / HDR_SPEC[0]
    hdr_dst = OUT_DIR / HDR_SPEC[1]
    if not hdr_src.is_file():
        raise FileNotFoundError(f"Missing HDRI source: {hdr_src}")
    shutil.copy2(hdr_src, hdr_dst)
    size = hdr_dst.stat().st_size
    total_bytes += size
    written += 1
    print(f"COPIED  {hdr_dst.name:<24} ({size / 1024:.1f} KB)")

    resampling = Image.Resampling.LANCZOS
    for src_rel, dst_name in TEXTURE_SPECS:
        src_path = WEB_ASSETS_ROOT / src_rel
        if not src_path.is_file():
            raise FileNotFoundError(f"Missing PBR texture: {src_path}")
        dst_path = OUT_DIR / dst_name
        with Image.open(src_path) as im:
            rgb = im.convert("RGB")
            if rgb.size != (512, 512):
                rgb = rgb.resize((512, 512), resampling)
            rgb.save(dst_path, format="JPEG", quality=86, optimize=True, progressive=False)
        size = dst_path.stat().st_size
        total_bytes += size
        written += 1
        print(f"RESIZED {dst_name:<24} 512x512 RGB ({size / 1024:.1f} KB)")

    print(f"\nDONE: {written} clean PBR assets written to {OUT_DIR} ({total_bytes / (1024 * 1024):.2f} MB total)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
