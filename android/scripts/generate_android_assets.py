#!/usr/bin/env python3
"""Generate clean studio PBR assets, Cyber Circuit PCB maps, 3-layer parallax PNGs, and launcher icons."""

import math
import shutil
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
APPLE_PBR_DIR = (
    ROOT.parent
    / "重力表盘_AppleWatch壁纸软件_iOS与watchOS双端_2026-11-21"
    / "Shared"
    / "Resources"
    / "PBRTextures"
)
TEX_OUT = ROOT / "app" / "src" / "main" / "assets" / "textures"
DRAWABLE_OUT = ROOT / "app" / "src" / "main" / "res" / "drawable-nodpi"
RES_DIR = ROOT / "app" / "src" / "main" / "res"

PBR_COPY_FILES = [
    "rubber_diff.jpg",
    "rubber_nor.jpg",
    "felt_diff.jpg",
    "felt_nor.jpg",
    "maple_diff.jpg",
    "maple_nor.jpg",
    "bball_leather_diff.jpg",
    "bball_leather_nor.jpg",
    "marble_diff.jpg",
    "marble_nor.jpg",
    "metal_nor.jpg",
    "grass_diff.jpg",
    "grass_nor.jpg",
    "velvet_diff.jpg",
    "velvet_nor.jpg",
    "leather_white_nor.jpg",
]

MIPMAP_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def copy_clean_pbr_textures() -> None:
    TEX_OUT.mkdir(parents=True, exist_ok=True)
    if not APPLE_PBR_DIR.is_dir():
        raise FileNotFoundError(f"Clean PBR source folder not found: {APPLE_PBR_DIR}")

    for fname in PBR_COPY_FILES:
        src = APPLE_PBR_DIR / fname
        if not src.is_file():
            raise FileNotFoundError(f"Missing source PBR texture: {src}")
        dst = TEX_OUT / fname
        # Re-save at 512px clean JPEG (already 512 in Apple repo, copy directly if <= 512)
        with Image.open(src) as im:
            im_rgb = im.convert("RGB")
            if max(im_rgb.size) > 512:
                im_rgb.thumbnail((512, 512), Image.Resampling.LANCZOS)
            im_rgb.save(dst, format="JPEG", quality=88, optimize=True)


def draw_rounded_chamfer(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int], radius: int, **kwargs) -> None:
    draw.rounded_rectangle(rect, radius=radius, **kwargs)


def draw_pcb_traces(
    draw_diff: ImageDraw.ImageDraw,
    draw_glow: ImageDraw.ImageDraw,
    w: int,
    h: int,
    scale: float,
) -> None:
    cx, cy = int(w * 0.50), int(h * 0.45)

    def s(val: float) -> int:
        return max(1, int(round(val * scale)))

    # Crisp subtle coordinate grid lines
    step = s(42)
    for x in range(0, w, step):
        draw_diff.line([(x, 0), (x, h)], fill=(18, 25, 42), width=1)
    for y in range(0, h, step):
        draw_diff.line([(0, y), (w, y)], fill=(18, 25, 42), width=1)

    # Architectural recessed chassis bays
    bay_w, bay_h = s(440), s(740)
    bay_rect = (cx - bay_w // 2, cy - bay_h // 2 - s(20), cx + bay_w // 2, cy + bay_h // 2 + s(20))
    draw_diff.rounded_rectangle(bay_rect, radius=s(38), fill=(11, 16, 29), outline=(34, 48, 76), width=s(2))

    # Secondary sub-bay around SoC
    soc_pad = s(146)
    soc_rect = (cx - soc_pad, cy - soc_pad, cx + soc_pad, cy + soc_pad)
    draw_diff.rounded_rectangle(soc_rect, radius=s(26), fill=(15, 22, 39), outline=(56, 82, 126), width=s(2))

    # Copper-gold & cyan 45-degree routed trace paths radiating from central SoC
    cyan_paths = [
        [(cx - s(140), cy - s(48)), (cx - s(205), cy - s(48)), (cx - s(248), cy - s(92)), (cx - s(248), cy - s(360)), (cx - s(165), cy - s(440))],
        [(cx - s(140), cy - s(22)), (cx - s(225), cy - s(22)), (cx - s(275), cy - s(72)), (cx - s(275), cy - s(410))],
        [(cx + s(140), cy - s(48)), (cx + s(205), cy - s(48)), (cx + s(248), cy - s(92)), (cx + s(248), cy - s(360)), (cx + s(165), cy - s(440))],
        [(cx + s(140), cy - s(22)), (cx + s(225), cy - s(22)), (cx + s(275), cy - s(72)), (cx + s(275), cy - s(410))],
        [(cx - s(44), cy + s(140)), (cx - s(44), cy + s(220)), (cx - s(105), cy + s(280)), (cx - s(105), cy + s(460))],
        [(cx + s(44), cy + s(140)), (cx + s(44), cy + s(220)), (cx + s(105), cy + s(280)), (cx + s(105), cy + s(460))],
        [(cx - s(140), cy + s(54)), (cx - s(220), cy + s(54)), (cx - s(265), cy + s(98)), (cx - s(265), cy + s(320))],
        [(cx + s(140), cy + s(54)), (cx + s(220), cy + s(54)), (cx + s(265), cy + s(98)), (cx + s(265), cy + s(320))],
    ]
    amber_paths = [
        [(cx - s(24), cy - s(140)), (cx - s(24), cy - s(230)), (cx - s(72), cy - s(278)), (cx - s(72), cy - s(470))],
        [(cx + s(24), cy - s(140)), (cx + s(24), cy - s(230)), (cx + s(72), cy - s(278)), (cx + s(72), cy - s(470))],
        [(cx, cy + s(140)), (cx, cy + s(390))],
        [(cx - s(140), cy + s(18)), (cx - s(195), cy + s(18)), (cx - s(235), cy + s(58)), (cx - s(235), cy + s(210))],
        [(cx + s(140), cy + s(18)), (cx + s(195), cy + s(18)), (cx + s(235), cy + s(58)), (cx + s(235), cy + s(210))],
    ]

    for pts in cyan_paths:
        draw_diff.line(pts, fill=(48, 128, 168), width=s(3.5), joint="curve")
        draw_glow.line(pts, fill=(255, 0, 0), width=s(5.0), joint="curve")
        for vx, vy in (pts[0], pts[-1]):
            r = s(5)
            draw_diff.ellipse((vx - r, vy - r, vx + r, vy + r), fill=(198, 166, 98), outline=(36, 94, 130), width=1)
            draw_glow.ellipse((vx - r, vy - r, vx + r, vy + r), fill=(255, 40, 0))

    for pts in amber_paths:
        draw_diff.line(pts, fill=(166, 126, 56), width=s(3.0), joint="curve")
        draw_glow.line(pts, fill=(0, 255, 0), width=s(4.5), joint="curve")
        for vx, vy in (pts[0], pts[-1]):
            r = s(4.5)
            draw_diff.ellipse((vx - r, vy - r, vx + r, vy + r), fill=(224, 184, 102))
            draw_glow.ellipse((vx - r, vy - r, vx + r, vy + r), fill=(0, 255, 0))

    # Magnetic induction ring silhouette in lower half (transparent chassis aesthetic)
    coil_cy = int(h * 0.72)
    r_outer, r_inner = s(124), s(94)
    draw_diff.ellipse(
        (cx - r_outer, coil_cy - r_outer, cx + r_outer, coil_cy + r_outer),
        outline=(54, 72, 106),
        width=s(10),
    )
    draw_diff.ellipse(
        (cx - r_inner, coil_cy - r_inner, cx + r_inner, coil_cy + r_inner),
        outline=(118, 94, 52),
        width=s(3),
    )
    draw_glow.ellipse(
        (cx - r_outer, coil_cy - r_outer, cx + r_outer, coil_cy + r_outer),
        outline=(0, 0, 255),
        width=s(8),
    )

    # Central glowing core die rings
    core_r1, core_r2 = s(86), s(58)
    draw_diff.ellipse((cx - core_r1, cy - core_r1, cx + core_r1, cy + core_r1), outline=(66, 184, 224), width=s(3))
    draw_diff.ellipse((cx - core_r2, cy - core_r2, cx + core_r2, cy + core_r2), fill=(18, 30, 52), outline=(212, 174, 88), width=s(2.5))
    draw_glow.ellipse((cx - core_r1, cy - core_r1, cx + core_r1, cy + core_r1), outline=(255, 120, 255), width=s(5))
    draw_glow.ellipse((cx - core_r2, cy - core_r2, cx + core_r2, cy + core_r2), outline=(140, 220, 255), width=s(4))

    # Corner titanium chassis screws & SMD pads
    screw_pts = [
        (int(w * 0.14), int(h * 0.10)),
        (int(w * 0.86), int(h * 0.10)),
        (int(w * 0.14), int(h * 0.90)),
        (int(w * 0.86), int(h * 0.90)),
    ]
    sr = s(12)
    for sx, sy in screw_pts:
        draw_diff.ellipse((sx - sr, sy - sr, sx + sr, sy + sr), fill=(36, 44, 62), outline=(96, 110, 138), width=s(2))
        draw_diff.line((sx - sr // 2, sy, sx + sr // 2, sy), fill=(16, 20, 30), width=s(2))


def generate_circuit_3d_textures() -> None:
    w, h = 512, 640
    diff = Image.new("RGB", (w, h), (7, 10, 18))
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d_diff = ImageDraw.Draw(diff)
    d_glow = ImageDraw.Draw(glow)

    # Radial chassis depth gradient
    px = diff.load()
    for y in range(h):
        ny = (y / h - 0.45) * 2.0
        for x in range(w):
            nx = (x / w - 0.5) * 2.0
            d2 = nx * nx + ny * ny
            fall = max(0.0, 1.0 - d2 * 0.36)
            px[x, y] = (
                int(6 + 11 * fall),
                int(9 + 16 * fall),
                int(17 + 28 * fall),
            )

    draw_pcb_traces(d_diff, d_glow, w, h, scale=0.68)
    # Soft bloom on glow channel mask while preserving trace crispness
    glow_soft = glow.filter(ImageFilter.GaussianBlur(radius=3.5))
    glow_mix = ImageChops.lighter(glow, glow_soft)

    diff.save(TEX_OUT / "circuit_board_diff.jpg", format="JPEG", quality=92, optimize=True)
    glow_mix.save(TEX_OUT / "circuit_board_glow.jpg", format="JPEG", quality=90, optimize=True)


def generate_cyber_parallax_suite() -> Image.Image:
    DRAWABLE_OUT.mkdir(parents=True, exist_ok=True)
    w, h = 720, 1600

    # 1. Background (opaque RGB deep transparent-chassis motherboard)
    bg = Image.new("RGB", (w, h), (5, 7, 14))
    px = bg.load()
    for y in range(h):
        ny = (y / h - 0.45) * 2.0
        for x in range(w):
            nx = (x / w - 0.5) * 2.0
            rad = max(0.0, 1.0 - (nx * nx + ny * ny) * 0.32)
            px[x, y] = (int(5 + 10 * rad), int(8 + 16 * rad), int(16 + 32 * rad))

    d_bg = ImageDraw.Draw(bg)
    glow_mask = Image.new("RGB", (w, h), (0, 0, 0))
    d_mask = ImageDraw.Draw(glow_mask)
    draw_pcb_traces(d_bg, d_mask, w, h, scale=1.0)
    bg.save(DRAWABLE_OUT / "parallax_cyber_bg.png", format="PNG", optimize=True)

    # 2. Glow layer (RGBA cyan + violet + champagne volumetric glow bloom for breathing pulse)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d_glow = ImageDraw.Draw(glow)
    cx, cy = w // 2, int(h * 0.45)

    # Central processor halo
    d_glow.ellipse((cx - 210, cy - 210, cx + 210, cy + 210), fill=(36, 210, 255, 115))
    d_glow.ellipse((cx - 125, cy - 125, cx + 125, cy + 125), fill=(115, 245, 255, 175))
    # Lower magnetic ring aura
    ring_cy = int(h * 0.72)
    d_glow.ellipse((cx - 165, ring_cy - 165, cx + 165, ring_cy + 165), outline=(72, 165, 255, 150), width=26)
    d_glow.ellipse((cx - 140, ring_cy - 140, cx + 140, ring_cy + 140), outline=(255, 198, 92, 115), width=10)
    # Upper diagonal power rail glow
    d_glow.line([(cx - 170, cy - 160), (cx - 248, cy - 260), (cx - 248, cy - 460)], fill=(54, 232, 255, 160), width=14)
    d_glow.line([(cx + 170, cy - 160), (cx + 248, cy - 260), (cx + 248, cy - 460)], fill=(255, 196, 86, 150), width=12)

    glow = glow.filter(ImageFilter.GaussianBlur(radius=34))
    glow.save(DRAWABLE_OUT / "parallax_cyber_glow.png", format="PNG", optimize=True)

    # 3. Foreground layer (RGBA crisp floating glass SoC & chamfered optical modules)
    fg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d_fg = ImageDraw.Draw(fg)

    # Central floating smoked-glass processor deck
    cw, ch = 264, 264
    card = (cx - cw // 2, cy - ch // 2, cx + cw // 2, cy + ch // 2)
    d_fg.rounded_rectangle(card, radius=38, fill=(18, 28, 48, 226), outline=(120, 238, 255, 215), width=4)
    inner = (cx - cw // 2 + 18, cy - ch // 2 + 18, cx + cw // 2 - 18, cy + ch // 2 - 18)
    d_fg.rounded_rectangle(inner, radius=26, fill=(10, 17, 32, 238), outline=(255, 208, 108, 195), width=3)

    # Gold contact pins on all 4 sides of floating SoC
    for idx in range(-4, 5):
        px_off = idx * 20
        d_fg.rounded_rectangle((cx + px_off - 4, card[1] - 12, cx + px_off + 4, card[1] + 2), radius=2, fill=(238, 192, 92, 240))
        d_fg.rounded_rectangle((cx + px_off - 4, card[3] - 2, cx + px_off + 4, card[3] + 12), radius=2, fill=(238, 192, 92, 240))
        d_fg.rounded_rectangle((card[0] - 12, cy + px_off - 4, card[0] + 2, cy + px_off + 4), radius=2, fill=(120, 232, 255, 225))
        d_fg.rounded_rectangle((card[2] - 2, cy + px_off - 4, card[2] + 12, cy + px_off + 4), radius=2, fill=(120, 232, 255, 225))

    # Central faceted crystalline core inside the floating SoC
    oct_pts = []
    for k in range(8):
        ang = k * math.pi / 4.0 + math.pi / 8.0
        r = 66
        oct_pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    d_fg.polygon(oct_pts, fill=(32, 96, 138, 235), outline=(165, 248, 255, 255))
    inner_pts = [(cx + (x - cx) * 0.52, cy + (y - cy) * 0.52) for (x, y) in oct_pts]
    d_fg.polygon(inner_pts, fill=(116, 242, 255, 245), outline=(255, 255, 255, 240))

    # Diagonal sapphire glass sheen clipped onto central module
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d_sh = ImageDraw.Draw(sheen)
    d_sh.polygon([(cx - 150, cy - 150), (cx - 45, cy - 150), (cx + 150, cy + 45), (cx + 150, cy + 150)], fill=(255, 255, 255, 34))
    mask_chip = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask_chip).rounded_rectangle(card, radius=38, fill=255)
    sheen_masked = Image.composite(sheen, Image.new("RGBA", (w, h), (0, 0, 0, 0)), mask_chip)
    fg = Image.alpha_composite(fg, sheen_masked)
    d_fg = ImageDraw.Draw(fg)

    # Upper & lower floating optical pill modules for rich vertical depth distribution
    top_pill = (cx - 178, int(h * 0.21), cx + 178, int(h * 0.28))
    d_fg.rounded_rectangle(top_pill, radius=24, fill=(20, 30, 50, 210), outline=(110, 224, 255, 195), width=3)
    d_fg.ellipse((top_pill[0] + 24, (top_pill[1] + top_pill[3]) // 2 - 14, top_pill[0] + 52, (top_pill[1] + top_pill[3]) // 2 + 14), fill=(92, 242, 255, 245))
    d_fg.rounded_rectangle((top_pill[0] + 74, top_pill[1] + 34, top_pill[2] - 28, top_pill[1] + 50), radius=6, fill=(215, 232, 250, 200))
    d_fg.rounded_rectangle((top_pill[0] + 74, top_pill[1] + 64, top_pill[2] - 88, top_pill[1] + 76), radius=5, fill=(240, 196, 98, 210))

    # Lower floating titanium ring medallion
    ring_cy = int(h * 0.72)
    d_fg.ellipse((cx - 104, ring_cy - 104, cx + 104, ring_cy + 104), fill=(14, 20, 34, 216), outline=(235, 192, 98, 225), width=4)
    d_fg.ellipse((cx - 64, ring_cy - 64, cx + 64, ring_cy + 64), fill=(26, 40, 66, 220), outline=(112, 236, 255, 220), width=3)

    # Side floating crystal accent cubes
    for bx, by, col in [
        (cx - 210, cy + 165, (86, 228, 255, 220)),
        (cx + 210, cy - 175, (248, 200, 96, 225)),
    ]:
        d_fg.rounded_rectangle((bx - 34, by - 34, bx + 34, by + 34), radius=14, fill=(20, 30, 50, 218), outline=col, width=3)
        d_fg.ellipse((bx - 11, by - 11, bx + 11, by + 11), fill=col)

    fg.save(DRAWABLE_OUT / "parallax_cyber_fg.png", format="PNG", optimize=True)

    # Composite preview image for visual QA
    comp = bg.convert("RGBA")
    comp = Image.alpha_composite(comp, glow)
    shadow = fg.split()[3].point(lambda a: int(a * 0.55))
    sh_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sh_img.paste((0, 0, 0, 255), (20, 26), shadow)
    sh_img = sh_img.filter(ImageFilter.GaussianBlur(radius=16))
    comp = Image.alpha_composite(comp, sh_img)
    comp = Image.alpha_composite(comp, fg)
    return comp.convert("RGB")


def generate_gold_parallax_suite() -> None:
    w, h = 720, 1600
    cx, cy = w // 2, int(h * 0.48)

    # 1. Warm alabaster cream ceramic backdrop with gold hairline dial geometry
    bg = Image.new("RGB", (w, h), (242, 237, 226))
    px = bg.load()
    for y in range(h):
        ny = (y / h - 0.35)
        for x in range(w):
            nx = (x / w - 0.5)
            rad = max(0.0, 1.0 - (nx * nx + ny * ny) * 0.45)
            px[x, y] = (
                int(228 + 20 * rad),
                int(221 + 21 * rad),
                int(208 + 20 * rad),
            )
    d_bg = ImageDraw.Draw(bg)
    for r in (160, 235, 310):
        d_bg.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(212, 198, 170), width=2)
    for step in range(0, w, 90):
        d_bg.line([(step, 0), (step, h)], fill=(224, 217, 203), width=1)
    bg.save(DRAWABLE_OUT / "parallax_gold_bg.png", format="PNG", optimize=True)

    # 2. Warm champagne bloom glow layer
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d_glow = ImageDraw.Draw(glow)
    d_glow.ellipse((cx - 240, cy - 240, cx + 240, cy + 240), fill=(255, 220, 132, 145))
    d_glow.ellipse((cx - 130, int(h * 0.25) - 130, cx + 130, int(h * 0.25) + 130), fill=(255, 238, 185, 135))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=42))
    glow.save(DRAWABLE_OUT / "parallax_gold_glow.png", format="PNG", optimize=True)

    # 3. Foreground satin-gold & ivory sculpted floating horology medallions
    fg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d_fg = ImageDraw.Draw(fg)

    # Upper sleek ivory/gold architectural header card
    d_fg.rounded_rectangle((cx - 210, int(h * 0.19), cx + 210, int(h * 0.30)), radius=34, fill=(250, 247, 240, 242), outline=(206, 166, 84, 235), width=4)
    d_fg.rounded_rectangle((cx - 170, int(h * 0.22), cx - 50, int(h * 0.27)), radius=14, fill=(32, 34, 42, 238))
    d_fg.rounded_rectangle((cx - 24, int(h * 0.225), cx + 170, int(h * 0.242)), radius=7, fill=(208, 168, 86, 235))
    d_fg.rounded_rectangle((cx - 24, int(h * 0.254), cx + 120, int(h * 0.268)), radius=6, fill=(154, 146, 132, 190))

    # Central brushed gold & obsidian floating timepiece bezel
    d_fg.ellipse((cx - 148, cy - 148, cx + 148, cy + 148), fill=(248, 244, 236, 246), outline=(212, 168, 78, 255), width=8)
    d_fg.ellipse((cx - 118, cy - 118, cx + 118, cy + 118), fill=(26, 28, 36, 242), outline=(228, 188, 102, 220), width=2)
    for k in range(12):
        ang = k * math.pi / 6.0
        r1, r2 = (86, 104) if k % 3 == 0 else (94, 104)
        w_tick = 5 if k % 3 == 0 else 2
        d_fg.line(
            (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1, cx + math.cos(ang) * r2, cy + math.sin(ang) * r2),
            fill=(232, 194, 106, 245),
            width=w_tick,
        )
    # Minimalist gold watch hands (10:09 hero pose)
    d_fg.line((cx, cy, cx - 44, cy - 32), fill=(238, 200, 114, 255), width=7)
    d_fg.line((cx, cy, cx + 62, cy - 52), fill=(250, 242, 220, 255), width=5)
    d_fg.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=(238, 196, 102, 255))

    # Bottom row of 4 satin gold minimal tile icons
    tile_y = int(h * 0.71)
    for idx, fill_col in enumerate([(224, 182, 92, 242), (34, 36, 44, 240), (224, 182, 92, 242), (249, 246, 239, 245)]):
        tx = cx - 180 + idx * 120
        d_fg.rounded_rectangle((tx - 44, tile_y - 44, tx + 44, tile_y + 44), radius=22, fill=fill_col, outline=(204, 162, 78, 225), width=3)
        inner_col = (24, 26, 32, 220) if idx in (0, 2, 3) else (232, 192, 102, 235)
        d_fg.ellipse((tx - 15, tile_y - 15, tx + 15, tile_y + 15), outline=inner_col, width=4)

    fg.save(DRAWABLE_OUT / "parallax_gold_fg.png", format="PNG", optimize=True)


def generate_launcher_icons() -> Image.Image:
    size = 1024
    base = Image.new("RGB", (size, size), (8, 11, 20))
    px = base.load()
    for y in range(size):
        ny = (y / size - 0.45) * 2.0
        for x in range(size):
            nx = (x / size - 0.5) * 2.0
            rad = max(0.0, 1.0 - (nx * nx + ny * ny) * 0.45)
            px[x, y] = (int(9 + 18 * rad), int(14 + 28 * rad), int(26 + 48 * rad))

    d = ImageDraw.Draw(base)
    cx, cy = size // 2, size // 2
    # Crisp cyan + gold gyroscopic rings
    d.ellipse((cx - 340, cy - 340, cx + 340, cy + 340), outline=(72, 224, 255), width=14)
    d.ellipse((cx - 260, cy - 260, cx + 260, cy + 260), fill=(14, 22, 40), outline=(244, 198, 96), width=10)

    # Central faceted crystalline gem
    outer = []
    for k in range(8):
        ang = k * math.pi / 4.0 + math.pi / 8.0
        outer.append((cx + math.cos(ang) * 165, cy + math.sin(ang) * 165))
    mid = [(cx + (x - cx) * 0.58, cy + (y - cy) * 0.58) for (x, y) in outer]
    facet_cols = [
        (110, 236, 255), (64, 178, 240), (140, 246, 255), (242, 206, 126),
        (82, 210, 248), (44, 134, 212), (176, 250, 255), (218, 172, 86),
    ]
    for i in range(8):
        ni = (i + 1) % 8
        d.polygon([outer[i], outer[ni], mid[ni], mid[i]], fill=facet_cols[i])
    d.polygon(mid, fill=(214, 248, 255), outline=(255, 255, 255))

    for mip_dir, px_size in MIPMAP_SIZES.items():
        out_dir = RES_DIR / mip_dir
        out_dir.mkdir(parents=True, exist_ok=True)
        # Square icon with rounded corners cleanly composited
        sq = base.resize((px_size, px_size), Image.Resampling.LANCZOS).convert("RGBA")
        sq_mask = Image.new("L", (px_size, px_size), 0)
        ImageDraw.Draw(sq_mask).rounded_rectangle(
            (0, 0, px_size - 1, px_size - 1),
            radius=max(6, int(px_size * 0.22)),
            fill=255,
        )
        sq.putalpha(sq_mask)
        sq.save(out_dir / "ic_launcher.png", format="PNG", optimize=True)

        # Circular icon
        rd = base.resize((px_size, px_size), Image.Resampling.LANCZOS).convert("RGBA")
        rd_mask = Image.new("L", (px_size, px_size), 0)
        ImageDraw.Draw(rd_mask).ellipse((0, 0, px_size - 1, px_size - 1), fill=255)
        rd.putalpha(rd_mask)
        rd.save(out_dir / "ic_launcher_round.png", format="PNG", optimize=True)

    return base


def main() -> int:
    copy_clean_pbr_textures()
    generate_circuit_3d_textures()
    cyber_preview = generate_cyber_parallax_suite()
    generate_gold_parallax_suite()
    icon_master = generate_launcher_icons()

    preview_path = Path(__file__).resolve().parent / "preview_cyber_parallax.png"
    cyber_preview.save(preview_path, format="PNG")
    icon_preview = Path(__file__).resolve().parent / "preview_icon_1024.png"
    icon_master.resize((512, 512), Image.Resampling.LANCZOS).save(icon_preview, format="PNG")

    print(
        f"ANDROID ASSETS READY: {len(list(TEX_OUT.iterdir()))} textures · "
        f"{len(list(DRAWABLE_OUT.iterdir()))} parallax layers · "
        f"{len(MIPMAP_SIZES)} mipmap densities"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
