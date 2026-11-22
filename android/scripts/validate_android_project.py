#!/usr/bin/env python3
"""Static validator for GravityLiveWallpaper3D (Android Gradle + Kotlin + GLSL ES 3.0 + Assets)."""

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "app" / "src" / "main"
TEX_DIR = APP_DIR / "assets" / "textures"
DRAWABLE_DIR = APP_DIR / "res" / "drawable-nodpi"

REQUIRED_TEXTURES = [
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
    "circuit_board_diff.jpg",
    "circuit_board_glow.jpg",
]

REQUIRED_DRAWABLES = [
    "parallax_cyber_bg.png",
    "parallax_cyber_glow.png",
    "parallax_cyber_fg.png",
    "parallax_gold_bg.png",
    "parallax_gold_glow.png",
    "parallax_gold_fg.png",
]


def check_gradle_and_ci(errors: list[str]) -> None:
    for rel in (
        "settings.gradle.kts",
        "build.gradle.kts",
        "gradle.properties",
        "gradle/wrapper/gradle-wrapper.properties",
        "app/build.gradle.kts",
    ):
        if not (ROOT / rel).is_file():
            errors.append(f"Missing Gradle file: {rel}")

    ci_candidates = [
        ROOT / ".github" / "workflows" / "android-ci.yml",
        ROOT.parent / ".github" / "workflows" / "android-ci.yml",
    ]
    if not any(p.is_file() for p in ci_candidates):
        errors.append("Missing .github/workflows/android-ci.yml")


def check_xml_resources(errors: list[str]) -> None:
    xml_files = [
        APP_DIR / "AndroidManifest.xml",
        APP_DIR / "res" / "xml" / "gravity_wallpaper.xml",
        APP_DIR / "res" / "values" / "strings.xml",
        APP_DIR / "res" / "values" / "colors.xml",
        APP_DIR / "res" / "values" / "themes.xml",
    ]
    for xf in xml_files:
        if not xf.is_file():
            errors.append(f"Missing XML file: {xf.relative_to(ROOT)}")
            continue
        try:
            ET.parse(xf)
        except Exception as exc:
            errors.append(f"Invalid XML {xf.relative_to(ROOT)}: {exc}")

    manifest_text = (APP_DIR / "AndroidManifest.xml").read_text(encoding="utf-8")
    if "BIND_WALLPAPER" not in manifest_text or "WallpaperService" not in manifest_text:
        errors.append("AndroidManifest.xml missing BIND_WALLPAPER or WallpaperService intent-filter")
    if "0x00030000" not in manifest_text:
        errors.append("AndroidManifest.xml missing OpenGL ES 3.0 uses-feature")


def check_assets_and_drawables(errors: list[str]) -> None:
    for tex in REQUIRED_TEXTURES:
        p = TEX_DIR / tex
        if not p.is_file() or p.stat().st_size == 0:
            errors.append(f"Missing or empty texture: {p.relative_to(ROOT)}")

    for dr in REQUIRED_DRAWABLES:
        p = DRAWABLE_DIR / dr
        if not p.is_file() or p.stat().st_size == 0:
            errors.append(f"Missing or empty parallax drawable: {p.relative_to(ROOT)}")

    for density in ("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"):
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            icon = APP_DIR / "res" / f"mipmap-{density}" / name
            if not icon.is_file() or icon.stat().st_size == 0:
                errors.append(f"Missing launcher icon: {icon.relative_to(ROOT)}")


def check_kotlin_and_shaders(errors: list[str]) -> None:
    kt_files = sorted((ROOT / "app" / "src").rglob("*.kt"))
    if len(kt_files) < 10:
        errors.append(f"Expected >= 10 Kotlin files, found {len(kt_files)}")

    for kf in kt_files:
        rel = kf.relative_to(ROOT).as_posix()
        raw = kf.read_text(encoding="utf-8")

        shaders = re.findall(r'"""(.*?)"""', raw, flags=re.DOTALL)
        no_shaders = re.sub(r'"""[\s\S]*?"""', '""', raw)
        no_comments = re.sub(r"//.*", "", no_shaders)
        no_comments = re.sub(r"/\*[\s\S]*?\*/", "", no_comments)
        no_strings = re.sub(r'"(?:\\.|[^"\\])*"', '""', no_comments)

        if no_strings.count("{") != no_strings.count("}"):
            errors.append(
                f"Unbalanced braces in {rel}: open={no_strings.count('{')}, close={no_strings.count('}')}"
            )
        if no_strings.count("(") != no_strings.count(")"):
            errors.append(
                f"Unbalanced parens in {rel}: open={no_strings.count('(')}, close={no_strings.count(')')}"
            )

        for idx, sh in enumerate(shaders):
            if "#version 300 es" in sh:
                if sh.count("{") != sh.count("}") or sh.count("(") != sh.count(")"):
                    errors.append(f"Unbalanced brackets in GLSL shader #{idx + 1} of {rel}")
                if "texture2D" in sh:
                    errors.append(f"Forbidden GLSL ES 1.00 texture2D() in shader #{idx + 1} of {rel}")
                if "gl_FragColor" in sh:
                    errors.append(f"Forbidden gl_FragColor in #version 300 es shader #{idx + 1} of {rel}")


def main() -> int:
    errors: list[str] = []
    check_gradle_and_ci(errors)
    check_xml_resources(errors)
    check_assets_and_drawables(errors)
    check_kotlin_and_shaders(errors)

    if errors:
        print(f"ANDROID VALIDATION FAILED ({len(errors)} error(s)):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    kt_count = len(list((ROOT / "app" / "src").rglob("*.kt")))
    tex_count = len(list(TEX_DIR.iterdir())) if TEX_DIR.is_dir() else 0
    dr_count = len(list(DRAWABLE_DIR.iterdir())) if DRAWABLE_DIR.is_dir() else 0
    print(
        f"ANDROID VALIDATION PASSED (0 errors) · {kt_count} Kotlin files · "
        f"{tex_count} textures · {dr_count} parallax layers"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
