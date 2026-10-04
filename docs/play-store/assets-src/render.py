"""Render the Google Play listing artwork from the sources in this folder.

    python docs/play-store/assets-src/render.py

Writes icon.png and featureGraphic.png to
mobile/fastlane/metadata/android/en-US/images/ and checks them against Play's
requirements. Needs Python 3.10+ with Pillow (python -m pip install pillow)
and Chrome, Edge or Chromium; set CHROME to the browser executable if it is
not found.
"""

import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
OUT_DIR = REPO / "mobile" / "fastlane" / "metadata" / "android" / "en-US" / "images"

# (source, output, size, PNG mode, Play's file size limit)
ASSETS = [
    # 32-bit PNG, full-bleed square: Play applies the rounded mask and shadow.
    ("icon.svg", "icon.png", (512, 512), "RGBA", 1024 * 1024),
    # 24-bit PNG, no alpha.
    ("feature-graphic.html", "featureGraphic.png", (1024, 500), "RGB", 15 * 1024 * 1024),
]

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
]


def find_browser():
    for candidate in [os.environ.get("CHROME"), *BROWSERS]:
        if candidate and (Path(candidate).is_file() or shutil.which(candidate)):
            return shutil.which(candidate) or candidate
    sys.exit("No Chrome, Edge or Chromium found: set CHROME to its executable.")


def run_headless(browser, work, *args):
    """Runs the browser headless with a throwaway profile; returns stdout."""
    result = subprocess.run(
        [
            browser,
            "--headless=new",
            f"--user-data-dir={work / 'profile'}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--force-color-profile=srgb",
            # Greyscale text anti-aliasing: ClearType colour fringes look dirty
            # once Play rescales the image.
            "--disable-lcd-text",
            # Lets fonts load and scripts finish before the capture.
            "--virtual-time-budget=10000",
            *args,
        ],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    if result.returncode != 0:
        sys.exit(f"Browser failed ({result.returncode}):\n{result.stderr}")
    return result.stdout


def check_fonts(browser, work, page):
    """Fails unless the page's own check reports data-fonts="ok"."""
    dom = run_headless(browser, work, "--dump-dom", page.as_uri())
    match = re.search(r'<html[^>]*\bdata-fonts="([^"]*)"', dom)
    status = html.unescape(match.group(1)) if match else "no report (did the script run?)"
    if status != "ok":
        sys.exit(f"{page.name}: fonts not ready: {status}")


def render(browser, work, source, output, size, mode, limit):
    page = HERE / source
    if page.suffix == ".html":
        check_fonts(browser, work, page)

    shot = work / f"{page.stem}.png"
    width, height = size
    run_headless(
        browser,
        work,
        f"--window-size={width},{height}",
        f"--screenshot={shot}",
        page.as_uri(),
    )

    with Image.open(shot) as captured:
        if captured.width < width or captured.height < height:
            sys.exit(f"{source}: captured {captured.size}, expected {size}")
        image = captured.crop((0, 0, width, height)).convert(mode)

    target = OUT_DIR / output
    image.save(target, optimize=True)

    with Image.open(target) as saved:
        problems = []
        if saved.size != size:
            problems.append(f"size {saved.size}")
        if saved.mode != mode:
            problems.append(f"mode {saved.mode}")
        if mode == "RGBA" and saved.getchannel("A").getextrema() != (255, 255):
            problems.append("transparent pixels")
        if target.stat().st_size > limit:
            problems.append(f"{target.stat().st_size} bytes")
    if problems:
        sys.exit(f"{output}: {', '.join(problems)}")
    kib = target.stat().st_size / 1024
    print(f"{target.relative_to(REPO).as_posix()}: {width}x{height} {mode}, {kib:.0f} KiB")


def main():
    browser = find_browser()
    print(f"Rendering with {browser}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        for asset in ASSETS:
            render(browser, Path(tmp), *asset)


if __name__ == "__main__":
    main()
