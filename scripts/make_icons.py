#!/usr/bin/env python3
"""
Derives every icon-sized asset from ONE master: the transparent logo at
assets/img/favicon/radio-hectolitre.png (1024x1024, RGBA).

Writes:
  assets/img/favicon/icon-512.png            web-app icon, transparent ("any" purpose)
  assets/img/favicon/icon-maskable-512.png   opaque, logo inside the central safe zone,
                                             so Android can crop it to a circle/squircle
  assets/img/podcast/radio-hectolitre-1500.jpg   podcast cover (apps want a square
                                             1400-3000 px JPEG/PNG; used by feed.xml)

The existing small icons (favicon.ico, favicon-32.png, icon-192.png,
apple-touch-icon.png) are left as they are.

Needs Pillow (dev-time only):  pip install pillow
Usage:  python3 scripts/make_icons.py

Note: the master was cut out of the original 1254 px JPEG, so the podcast cover
(1500 px) is an upscale of flat-colour art — fine for artwork like this, but a
vector or larger original would be sharper. Swap the master and re-run to upgrade.
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "assets", "img", "favicon", "radio-hectolitre.png")
BG = (255, 255, 255)  # the logo's navy "H" needs a light ground to read


def fitted(master, size, scale):
    """The logo scaled to `scale` of `size`, as an RGBA tile."""
    side = round(size * scale)
    return master.resize((side, side), Image.LANCZOS)


def on_canvas(size, tile, bg=None):
    mode = "RGB" if bg else "RGBA"
    canvas = Image.new(mode, (size, size), bg or (0, 0, 0, 0))
    canvas.paste(tile, ((size - tile.width) // 2, (size - tile.height) // 2), tile)
    return canvas


def save(img, rel, **kw):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True, **kw)
    print(f"  {rel}  {img.width}x{img.height}  {os.path.getsize(path) // 1024} KB")


def main():
    master = Image.open(MASTER).convert("RGBA")
    print("Icons:")
    save(on_canvas(512, fitted(master, 512, 0.94)), "assets/img/favicon/icon-512.png")
    # Maskable: all important content inside the central 80% circle -> ~62% wide logo.
    save(on_canvas(512, fitted(master, 512, 0.62), BG), "assets/img/favicon/icon-maskable-512.png")
    save(on_canvas(1500, fitted(master, 1500, 0.74), BG).convert("RGB"),
         "assets/img/podcast/radio-hectolitre-1500.jpg", quality=90)


if __name__ == "__main__":
    main()
