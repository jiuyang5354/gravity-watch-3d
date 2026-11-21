#!/usr/bin/env python3
"""Generate crisp 1024x1024 RGB studio App Icons & Xcode asset catalogs for iOS & watchOS."""

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def build_studio_icon(size: int = 1024) -> Image.Image:
    img = Image.new("RGBA", (size, size), (8, 11, 17, 255))
    px = img.load()
    cx = cy = size * 0.5
    max_r = size * 0.72

    for y in range(size):
        dy = y - cy
        for x in range(size):
            dx = x - cx
            dist = math.hypot(dx, dy) / max_r
            t = max(0.0, min(1.0, 1.0 - dist))
            glow = t * t
            px[x, y] = (
                int(8 + 20 * glow),
                int(11 + 26 * glow),
                int(17 + 38 * glow),
                255,
            )

    # Outer titanium case + recessed sapphire screen
    bezel = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(bezel)
    pad = int(size * 0.13)
    top_pad = int(size * 0.10)
    outer_rect = [pad, top_pad, size - pad, size - top_pad]
    outer_r = int(size * 0.21)
    b_draw.rounded_rectangle(outer_rect, radius=outer_r, fill=(32, 37, 47, 255), outline=(154, 166, 186, 255), width=11)

    inner_pad = pad + 26
    inner_top = top_pad + 26
    inner_rect = [inner_pad, inner_top, size - inner_pad, size - inner_top]
    inner_r = int(size * 0.178)
    b_draw.rounded_rectangle(inner_rect, radius=inner_r, fill=(10, 13, 20, 255), outline=(52, 60, 76, 255), width=4)

    # Digital Crown
    crown_x0 = size - pad - 4
    crown_x1 = size - pad + 28
    b_draw.rounded_rectangle([crown_x0, int(size * 0.34), crown_x1, int(size * 0.49)], radius=10, fill=(64, 72, 86, 255), outline=(172, 184, 204, 240), width=4)
    img = Image.alpha_composite(img, bezel)

    # Clipped mask matching exact inner watch screen boundary
    screen_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(screen_mask).rounded_rectangle(inner_rect, radius=inner_r, fill=255)

    # Subtle colored floor bounce light strictly inside screen
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow_layer)
    g_draw.ellipse([230, 510, 630, 820], fill=(246, 200, 84, 52))
    g_draw.ellipse([480, 420, 830, 740], fill=(176, 232, 255, 44))
    g_draw.ellipse([230, 280, 550, 580], fill=(210, 242, 48, 38))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=40))
    glow_clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_clipped.paste(glow_layer, (0, 0), screen_mask)
    img = Image.alpha_composite(img, glow_clipped)

    objects = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # 1. Optic-Yellow US Open Tennis Sphere
    tennis = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    td = ImageDraw.Draw(tennis)
    tx, ty, tr = 376, 405, 118
    td.ellipse([tx - tr + 14, ty - tr + 26, tx + tr + 14, ty + tr + 26], fill=(0, 0, 0, 125))
    for i in range(tr, 0, -1):
        f = 1.0 - (i / tr)
        cx_i = tx - int(f * 28)
        cy_i = ty - int(f * 30)
        cr = int(154 + 78 * math.sqrt(f))
        cg = int(196 + 56 * math.sqrt(f))
        cb = int(22 + 34 * math.sqrt(f))
        td.ellipse([cx_i - i, cy_i - i, cx_i + i, cy_i + i], fill=(min(255, cr), min(255, cg), min(255, cb), 255))
    td.arc([tx - 84, ty - 110, tx + 84, ty + 110], start=212, end=328, fill=(244, 244, 238, 245), width=11)
    td.arc([tx - 84, ty - 110, tx + 84, ty + 110], start=32, end=148, fill=(244, 244, 238, 245), width=11)
    objects = Image.alpha_composite(objects, tennis)

    # 2. D-Color VVS1 Brilliant Diamond (full facet coverage + crystalline contrast)
    diamond = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dd = ImageDraw.Draw(diamond)
    dx, dy, dr = 636, 462, 128
    dd.ellipse([dx - dr + 16, dy - dr + 26, dx + dr + 16, dy + dr + 26], fill=(0, 0, 0, 130))
    outer_poly = [(dx + math.cos(i * math.pi * 2 / 8) * dr, dy + math.sin(i * math.pi * 2 / 8) * dr) for i in range(8)]
    mid_poly = [(dx + math.cos((i + 0.5) * math.pi * 2 / 8) * (dr * 0.72), dy + math.sin((i + 0.5) * math.pi * 2 / 8) * (dr * 0.72)) for i in range(8)]
    table_poly = [(dx + math.cos(i * math.pi * 2 / 8) * (dr * 0.44), dy + math.sin(i * math.pi * 2 / 8) * (dr * 0.44)) for i in range(8)]

    dd.polygon(outer_poly, fill=(142, 174, 208, 255))
    bezel_shades = [
        (244, 249, 255, 255), (176, 208, 238, 255),
        (224, 238, 252, 255), (84, 114, 148, 255),
        (146, 182, 218, 255), (252, 254, 255, 255),
        (164, 198, 232, 255), (104, 136, 174, 255),
    ]
    star_shades = [
        (210, 230, 248, 255), (118, 152, 188, 255),
        (248, 252, 255, 255), (144, 178, 214, 255),
        (194, 222, 246, 255), (96, 128, 166, 255),
        (234, 244, 254, 255), (168, 202, 236, 255),
    ]
    for i in range(8):
        nxt = (i + 1) % 8
        # Upper girdle left + right triangles
        dd.polygon([outer_poly[i], outer_poly[nxt], mid_poly[i]], fill=bezel_shades[i], outline=(235, 245, 255, 220))
        # Kite halves from girdle vertex to table vertices and mid star points
        dd.polygon([outer_poly[i], mid_poly[i], table_poly[i]], fill=star_shades[i], outline=(235, 245, 255, 190))
        dd.polygon([outer_poly[nxt], mid_poly[i], table_poly[nxt]], fill=star_shades[(i + 3) % 8], outline=(235, 245, 255, 190))
        # Star triangle along table edge
        dd.polygon([table_poly[i], mid_poly[i], table_poly[nxt]], fill=bezel_shades[(i + 2) % 8], outline=(255, 255, 255, 210))
    dd.polygon(table_poly, fill=(242, 249, 255, 255), outline=(255, 255, 255, 240))
    dd.line([(dx - 26, dy - 18), (dx + 22, dy - 42)], fill=(255, 255, 255, 255), width=6)
    objects = Image.alpha_composite(objects, diamond)

    # 3. 24K Swiss Bullion Beveled Gold Ingot (layered alpha composite for crisp metallic lustre)
    gold_base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gb = ImageDraw.Draw(gold_base)
    gx, gy = 486, 654
    gw, gh = 330, 168
    gb.rounded_rectangle([gx - gw // 2, gy - gh // 2, gx + gw // 2, gy + gh // 2], radius=34, fill=(224, 164, 42, 255), outline=(255, 245, 192, 255), width=6)
    gb.rounded_rectangle([gx - gw // 2 + 24, gy - gh // 2 + 20, gx + gw // 2 - 24, gy + gh // 2 - 20], radius=20, fill=(248, 206, 86, 255), outline=(255, 249, 212, 255), width=4)
    gb.rounded_rectangle([gx - 108, gy - 38, gx + 108, gy + 38], radius=8, outline=(168, 110, 22, 195), width=4)

    gold_shine = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gs = ImageDraw.Draw(gold_shine)
    gs.polygon([
        (gx - 105, gy - 76),
        (gx - 22, gy - 76),
        (gx + 68, gy + 76),
        (gx - 15, gy + 76),
    ], fill=(255, 252, 224, 115))
    gold_combined = Image.alpha_composite(gold_base, gold_shine)
    gold_rot = gold_combined.rotate(-14, resample=Image.Resampling.BICUBIC, center=(gx, gy))
    objects = Image.alpha_composite(objects, gold_rot)

    img = Image.alpha_composite(img, objects)

    # Sapphire glass top-left crisp reflection strictly clipped inside screen squircle
    glass = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gl_draw = ImageDraw.Draw(glass)
    gl_draw.polygon([
        (inner_pad, inner_top),
        (int(size * 0.62), inner_top),
        (inner_pad, int(size * 0.56)),
    ], fill=(255, 255, 255, 24))
    glass_clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glass_clipped.paste(glass, (0, 0), screen_mask)
    img = Image.alpha_composite(img, glass_clipped)

    return img.convert("RGB")


def write_catalog_files(catalog_dir: Path, idiom: str) -> Path:
    catalog_dir.mkdir(parents=True, exist_ok=True)
    accent_dir = catalog_dir / "AccentColor.colorset"
    accent_dir.mkdir(parents=True, exist_ok=True)
    icon_dir = catalog_dir / "AppIcon.appiconset"
    icon_dir.mkdir(parents=True, exist_ok=True)

    (catalog_dir / "Contents.json").write_text(
        json.dumps({"info": {"author": "xcode", "version": 1}}, indent=2),
        encoding="utf-8",
    )

    accent_json = {
        "colors": [
            {
                "color": {
                    "color-space": "srgb",
                    "components": {"alpha": "1.000", "blue": "0.180", "green": "0.961", "red": "0.839"},
                },
                "idiom": "universal",
            }
        ],
        "info": {"author": "xcode", "version": 1},
    }
    (accent_dir / "Contents.json").write_text(json.dumps(accent_json, indent=2), encoding="utf-8")

    icon_entry = {
        "filename": "AppIcon-1024.png",
        "idiom": "universal",
        "platform": idiom,
        "size": "1024x1024",
    }
    icon_json = {
        "images": [icon_entry],
        "info": {"author": "xcode", "version": 1},
    }
    (icon_dir / "Contents.json").write_text(json.dumps(icon_json, indent=2), encoding="utf-8")
    return icon_dir / "AppIcon-1024.png"


def main() -> int:
    icon_img = build_studio_icon(1024)
    ios_icon_path = write_catalog_files(PROJECT_ROOT / "iOSApp" / "Assets.xcassets", "ios")
    watch_icon_path = write_catalog_files(PROJECT_ROOT / "WatchApp" / "Assets.xcassets", "watchos")

    icon_img.save(ios_icon_path, format="PNG", optimize=True)
    icon_img.save(watch_icon_path, format="PNG", optimize=True)

    print(f"GENERATED {ios_icon_path}")
    print(f"GENERATED {watch_icon_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
