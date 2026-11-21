#!/usr/bin/env python3
"""Static validator for GravityWatchStudio dual-target iOS + watchOS project on Windows."""

import json
import plistlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PBR_DIR = ROOT / "Shared" / "Resources" / "PBRTextures"


class ValidationError(Exception):
    pass


def check_plists_and_privacy(errors: list[str]) -> None:
    plist_paths = [
        ROOT / "iOSApp" / "Info.plist",
        ROOT / "iOSApp" / "PrivacyInfo.xcprivacy",
        ROOT / "WatchApp" / "Info.plist",
        ROOT / "WatchApp" / "PrivacyInfo.xcprivacy",
    ]
    for path in plist_paths:
        if not path.is_file():
            errors.append(f"Missing plist/xcprivacy file: {path}")
            continue
        try:
            with path.open("rb") as f:
                data = plistlib.load(f)
        except Exception as exc:
            errors.append(f"Invalid XML/plist {path}: {exc}")
            continue

        if path == ROOT / "WatchApp" / "Info.plist":
            if not data.get("WKApplication"):
                errors.append("WatchApp/Info.plist missing WKApplication=true")
            if not data.get("WKCompanionAppBundleIdentifier"):
                errors.append("WatchApp/Info.plist missing WKCompanionAppBundleIdentifier")
        if path == ROOT / "iOSApp" / "Info.plist":
            for key in ("NSMotionUsageDescription", "NSPhotoLibraryAddUsageDescription"):
                if not data.get(key):
                    errors.append(f"iOSApp/Info.plist missing {key}")


def check_asset_catalogs(errors: list[str]) -> None:
    for catalog in (ROOT / "iOSApp" / "Assets.xcassets", ROOT / "WatchApp" / "Assets.xcassets"):
        if not catalog.is_dir():
            errors.append(f"Missing asset catalog: {catalog}")
            continue
        for json_file in catalog.rglob("Contents.json"):
            try:
                content = json.loads(json_file.read_text(encoding="utf-8"))
            except Exception as exc:
                errors.append(f"Invalid JSON in {json_file}: {exc}")
                continue
            for img in content.get("images", []):
                filename = img.get("filename")
                if filename:
                    img_path = json_file.parent / filename
                    if not img_path.is_file() or img_path.stat().st_size == 0:
                        errors.append(f"Missing/empty icon referenced by {json_file}: {img_path}")


def check_bundled_pbr_references(errors: list[str]) -> None:
    if not PBR_DIR.is_dir():
        errors.append(f"Missing PBRTextures dir: {PBR_DIR}")
        return

    tex_gen = (ROOT / "Shared" / "Services" / "ProceduralTextureGenerator.swift").read_text(encoding="utf-8")
    img_refs = re.findall(r'loadBundledCGImage\(named:\s*"([^"]+)"', tex_gen)
    url_refs = re.findall(r'loadBundledURL\(named:\s*"([^"]+)",\s*ext:\s*"([^"]+)"', tex_gen)

    if not img_refs:
        errors.append("No loadBundledCGImage references parsed in ProceduralTextureGenerator.swift")
    for name in img_refs:
        expected = PBR_DIR / f"{name}.jpg"
        if not expected.is_file():
            errors.append(f"Referenced texture missing: {expected}")
    for name, ext in url_refs:
        expected = PBR_DIR / f"{name}.{ext}"
        if not expected.is_file():
            errors.append(f"Referenced URL resource missing: {expected}")


def strip_swift_strings_and_comments(src: str) -> tuple[str, list[str]]:
    """Strip comments while extracting triple-quoted Metal shader blocks cleanly."""
    shaders = re.findall(r'"""(.*?)"""', src, flags=re.DOTALL)
    # Remove single-line // comments
    no_line = re.sub(r"//.*", "", src)
    # Remove multi-line /* */ comments
    no_block = re.sub(r"/\*.*?\*/", "", no_line, flags=re.DOTALL)
    return no_block, shaders


def strip_if_block(src: str, guard: str) -> str:
    """Naive line-level removal of `#if os(...)` ... `#endif` blocks to test cross-platform leakage."""
    out_lines: list[str] = []
    skip_stack: list[bool] = []
    skipping = False
    for line in src.splitlines():
        stripped = line.strip()
        if stripped.startswith("#if "):
            is_guard = guard in stripped
            skip_stack.append(is_guard)
            skipping = any(skip_stack)
            continue
        if stripped.startswith("#else"):
            if skip_stack:
                skip_stack[-1] = not skip_stack[-1]
                skipping = any(skip_stack)
            continue
        if stripped.startswith("#endif"):
            if skip_stack:
                skip_stack.pop()
            skipping = any(skip_stack)
            continue
        if not skipping:
            out_lines.append(line)
    return "\n".join(out_lines)


def check_swift_and_metal(errors: list[str]) -> None:
    swift_files = sorted(ROOT.rglob("*.swift"))
    if len(swift_files) < 12:
        errors.append(f"Expected >= 12 Swift files, found {len(swift_files)}")

    ios_only_patterns = [
        r"\bUIImpactFeedbackGenerator\b",
        r"\bUISelectionFeedbackGenerator\b",
        r"\bPHPhotoLibrary\b",
        r"\bSCNRenderer\b",
        r"\.isPaired\b",
        r"\.isWatchAppInstalled\b",
        r"\bsessionDidBecomeInactive\b",
        r"\bsessionDidDeactivate\b",
    ]
    watch_only_patterns = [
        r"\bWKInterfaceDevice\b",
        r"\.digitalCrownRotation\b",
    ]
    glsl_forbidden = [
        r"\bvec2\b",
        r"\bvec3\b",
        r"\bvec4\b",
        r"\bmat3\b",
        r"\bmat4\b",
        r"\btexture2D\b",
        r"\bgl_FragColor\b",
    ]

    for sf in swift_files:
        rel = sf.relative_to(ROOT).as_posix()
        raw = sf.read_text(encoding="utf-8")

        # Balanced braces check outside string literals (quick syntax sanity check)
        cleaned, shaders = strip_swift_strings_and_comments(raw)
        # Replace string literals `"..."` carefully on single lines
        code_no_str = re.sub(r'"""[\s\S]*?"""', '""', cleaned)
        code_no_str = re.sub(r'"(?:\\.|[^"\\])*"', '""', code_no_str)
        if code_no_str.count("{") != code_no_str.count("}"):
            errors.append(f"Unbalanced curly braces in {rel}: open={code_no_str.count('{')}, close={code_no_str.count('}')}")
        if code_no_str.count("(") != code_no_str.count(")"):
            errors.append(f"Unbalanced parentheses in {rel}: open={code_no_str.count('(')}, close={code_no_str.count(')')}")

        # Platform API isolation checks
        if rel.startswith("WatchApp/"):
            for pat in ios_only_patterns:
                if re.search(pat, strip_if_block(cleaned, "os(iOS)")):
                    errors.append(f"iOS-only symbol {pat} leaked into {rel}")
        elif rel.startswith("iOSApp/"):
            for pat in watch_only_patterns:
                if re.search(pat, strip_if_block(cleaned, "os(watchOS)")):
                    errors.append(f"watchOS-only symbol {pat} leaked into {rel}")
        elif rel.startswith("Shared/"):
            no_ios = strip_if_block(cleaned, "os(iOS)")
            no_watch = strip_if_block(cleaned, "os(watchOS)")
            for pat in ios_only_patterns:
                if re.search(pat, no_ios):
                    errors.append(f"Unguarded iOS-only symbol {pat} in Shared file {rel}")
            for pat in watch_only_patterns:
                if re.search(pat, no_watch):
                    errors.append(f"Unguarded watchOS-only symbol {pat} in Shared file {rel}")

        # MSL shader checks
        for idx, sh in enumerate(shaders):
            if "#pragma body" in sh:
                if sh.count("{") != sh.count("}") or sh.count("(") != sh.count(")"):
                    errors.append(f"Unbalanced brackets in Metal shader #{idx + 1} of {rel}")
                for gpat in glsl_forbidden:
                    if re.search(gpat, sh):
                        errors.append(f"Forbidden GLSL keyword {gpat} in Metal shader #{idx + 1} of {rel}")
                if re.search(r"float4\s+u_\w+\s*\[\s*\d+\s*\]", sh):
                    errors.append(f"SceneKit KVC does not bind C-array float4 uniforms in {rel}")


def check_project_yml_and_ci(errors: list[str]) -> None:
    yml_path = ROOT / "project.yml"
    ci_candidates = [
        ROOT / ".github" / "workflows" / "apple-ci.yml",
        ROOT.parent / ".github" / "workflows" / "apple-ci.yml",
    ]
    ci_path = next((p for p in ci_candidates if p.is_file()), None)
    if not yml_path.is_file():
        errors.append("Missing project.yml")
        return
    if ci_path is None:
        errors.append("Missing .github/workflows/apple-ci.yml")
        return

    yml_text = yml_path.read_text(encoding="utf-8")
    ci_text = ci_path.read_text(encoding="utf-8")

    for target_name in ("GravityWatchStudio", "GravityWatchFaceWatch"):
        if f"{target_name}:" not in yml_text:
            errors.append(f"Target {target_name} missing in project.yml")
        if f"-scheme {target_name}" not in ci_text:
            errors.append(f"Scheme {target_name} build step missing in apple-ci.yml")

    for req_path in ("iOSApp/Info.plist", "WatchApp/Info.plist", "Shared/Resources/PBRTextures"):
        if req_path not in yml_text:
            errors.append(f"Path {req_path} missing in project.yml")
        if not (ROOT / req_path).exists():
            errors.append(f"Referenced path {req_path} does not exist on disk")


def main() -> int:
    errors: list[str] = []
    check_plists_and_privacy(errors)
    check_asset_catalogs(errors)
    check_bundled_pbr_references(errors)
    check_swift_and_metal(errors)
    check_project_yml_and_ci(errors)

    if errors:
        print(f"VALIDATION FAILED ({len(errors)} error(s)):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    swift_count = len(list(ROOT.rglob("*.swift")))
    pbr_count = len(list(PBR_DIR.iterdir())) if PBR_DIR.is_dir() else 0
    print(f"ALL CHECKS PASSED (0 errors) · {swift_count} Swift files · {pbr_count} PBR resources · iOS + watchOS isolation OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
