#!/usr/bin/env python3
"""
Builds the 1200x630 link-preview ("share") images in assets/img/og/ from
artwork already in the repo, so social cards never point at a multi-megabyte
original or get cropped by a platform.

Every card carries the same branding: a white "seal" holding the logo that
straddles a navy info strip along the bottom edge (name, city, coordinates —
the same line the site's ticker shows). The seal is white because the logo's
navy "H" disappears on dark backgrounds.

Needs Pillow (dev-time only — the site itself has no dependencies):
    pip install pillow

Usage:
    python3 scripts/make_share_images.py          # build everything in CARDS
    python3 scripts/make_share_images.py default  # build one by name

Fonts are in scripts/fonts/ (see the README there). After changing a card,
run scripts/sync_social_meta.py — it re-measures the images and rewrites tags.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "img", "og")
FONT_DIR = os.path.join(ROOT, "scripts", "fonts")
LOGO = os.path.join(ROOT, "assets", "img", "favicon", "radio-hectolitre.png")

W, H = 1200, 630
STRIP_H = 68
BODY_H = H - STRIP_H          # 562 px of artwork above the strip
NAVY = (14, 36, 51)
TEAL = (24, 168, 200)
WHITE = (255, 255, 255)
STRIP_LEFT = "RADIO HECTOLITRE · BRUSSELS"
STRIP_RIGHT = "50.8503°N 4.3517°E"

# name -> (source image relative to repo root, mode)
#   "crop": scale to fill the artwork area, then centre-crop (landscape photos)
#   "fit":  show the whole image on a blurred copy of itself (square posters
#           whose lettering must not be cropped)
CARDS = {
    "radio-hectolitre": ("assets/img/photos/2026-05-31/Hecto-May31-2026-WEB.jpg", "crop"),
    "2026-05-31": ("assets/img/posters/2026-05-31/IMG_2134.png", "fit"),
}


# ---------------------------------------------------------------- building blocks

def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


def spaced(draw, xy, text, fnt, fill, tracking=0.0, anchor="l"):
    """Draw text with letter-spacing; anchor "l" starts at x, "r" ends at x."""
    x, y = xy
    widths = [draw.textlength(ch, font=fnt) + tracking for ch in text]
    if anchor == "r":
        x -= sum(widths) - tracking
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w


def cover(src, w, h):
    """Scale to fill w x h and centre-crop."""
    scale = max(w / src.width, h / src.height)
    r = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    left, top = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((left, top, left + w, top + h))


def blurred_backdrop(src, w, h, dim=0.7):
    return ImageEnhance.Brightness(cover(src, w, h).filter(ImageFilter.GaussianBlur(28))).enhance(dim)


def seal(diameter):
    """White disc with a soft shadow, the logo inside. Returns an RGBA tile (with margin)."""
    ss, pad = 4, 14
    size = diameter + 2 * pad
    shadow = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(shadow).ellipse([pad * ss, (pad + 4) * ss, (pad + diameter) * ss, (pad + diameter + 4) * ss], fill=110)
    shadow = shadow.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(5))
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile.paste(Image.new("RGBA", (size, size), (0, 0, 0, 255)), (0, 0), shadow)
    disc = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(disc).ellipse([pad * ss, pad * ss, (pad + diameter) * ss, (pad + diameter) * ss], fill=255)
    disc = disc.resize((size, size), Image.LANCZOS)
    tile.paste(Image.new("RGBA", (size, size), WHITE + (255,)), (0, 0), disc)
    logo = Image.open(LOGO).convert("RGBA")
    inner = round(diameter * 0.78)
    logo = logo.resize((inner, inner), Image.LANCZOS)
    tile.paste(logo, ((size - inner) // 2, (size - inner) // 2), logo)
    return tile


def brand(card, seal_d=140):
    """Navy info strip along the bottom, with the logo seal straddling its top-left."""
    d = ImageDraw.Draw(card)
    d.rectangle([0, BODY_H, W, H], fill=NAVY)
    d.rectangle([0, BODY_H, W, BODY_H + 3], fill=TEAL)
    tile = seal(seal_d)
    cx, cy = 36 + seal_d // 2, BODY_H + 2
    card.paste(tile, (cx - tile.width // 2, cy - tile.height // 2), tile)
    text_x = 36 + seal_d + 26
    ty = BODY_H + (STRIP_H - 26) // 2 + 4
    spaced(d, (text_x, ty), STRIP_LEFT, font("IBMPlexMono-SemiBold.ttf", 24), WHITE, tracking=2.5)
    spaced(d, (W - 40, ty), STRIP_RIGHT, font("IBMPlexMono-Regular.ttf", 22), (150, 196, 210), tracking=1, anchor="r")
    return card


# ---------------------------------------------------------------- layouts

def card_crop(src):
    card = Image.new("RGB", (W, H), NAVY)
    card.paste(cover(src, W, BODY_H), (0, 0))
    return brand(card)


def card_fit(src):
    card = Image.new("RGB", (W, H), NAVY)
    card.paste(blurred_backdrop(src, W, BODY_H), (0, 0))
    card.paste(src.resize((BODY_H, BODY_H), Image.LANCZOS), ((W - BODY_H) // 2, 0))
    return brand(card)


LAYOUTS = {"crop": card_crop, "fit": card_fit}


def save(card, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{name}.jpg")
    card.save(out, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"  {os.path.relpath(out, ROOT)}  {W}x{H}  {os.path.getsize(out) // 1024} KB")


def build(name):
    rel, mode = CARDS[name]
    with Image.open(os.path.join(ROOT, rel)) as im:
        src = im.convert("RGB")
    save(LAYOUTS[mode](src), name)


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
