#!/usr/bin/env python3
"""
Builds the 1200x630 link-preview ("share") images in assets/img/og/ from the
artwork already in the repo, so social cards never have to point at a
multi-megabyte original or get cropped by a platform.

Why this exists: Open Graph / Twitter "large" cards are 1.91:1. The broadcast
poster is a 2048x2048 PNG (~4.6 MB) with hand-lettering near its edges —
shipped as-is it would be cropped mid-word and is far over what messaging apps
will fetch. Here the poster is fitted whole, on a blurred extension of itself.

Needs Pillow (a dev-time tool only — the site itself has no dependencies):
    pip install pillow

Usage:
    python3 scripts/make_share_images.py          # build everything below
    python3 scripts/make_share_images.py default  # build one by name

To add a card for a new broadcast, append a line to CARDS (see the README /
docs/social-previews.md), run this, then run scripts/sync_social_meta.py.
"""
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "img", "og")
W, H = 1200, 630

# name -> (source image relative to repo root, mode)
#   "crop": scale to fill the card, then centre-crop (good for landscape photos)
#   "fit":  show the whole image at full height on a blurred copy of itself
#           (good for square posters with lettering that must not be cropped)
CARDS = {
    "radio-hectolitre": ("assets/img/photos/2026-05-31/Hecto-May31-2026-WEB.jpg", "crop"),
    "2026-05-31": ("assets/img/posters/2026-05-31/IMG_2134.png", "fit"),
}


def card_crop(src):
    scale = W / src.width
    resized = src.resize((W, round(src.height * scale)), Image.LANCZOS)
    top = max(0, (resized.height - H) // 2)
    return resized.crop((0, top, W, top + H))


def card_fit(src):
    backdrop = src.resize((W, round(src.height * W / src.width)), Image.LANCZOS)
    top = max(0, (backdrop.height - H) // 2)
    backdrop = backdrop.crop((0, top, W, top + H)).filter(ImageFilter.GaussianBlur(28))
    backdrop = ImageEnhance.Brightness(backdrop).enhance(0.7)
    side = H
    front = src.resize((side, side), Image.LANCZOS)
    backdrop.paste(front, ((W - side) // 2, 0))
    return backdrop


def build(name):
    rel, mode = CARDS[name]
    with Image.open(os.path.join(ROOT, rel)) as im:
        src = im.convert("RGB")
    card = card_crop(src) if mode == "crop" else card_fit(src)
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{name}.jpg")
    card.save(out, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"  {os.path.relpath(out, ROOT)}  {W}x{H}  {os.path.getsize(out) // 1024} KB  (from {rel})")


def main():
    names = sys.argv[1:] or list(CARDS)
    unknown = [n for n in names if n not in CARDS]
    if unknown:
        sys.exit(f"Unknown card(s): {', '.join(unknown)}. Known: {', '.join(CARDS)}")
    print("Share images:")
    for n in names:
        build(n)


if __name__ == "__main__":
    main()
