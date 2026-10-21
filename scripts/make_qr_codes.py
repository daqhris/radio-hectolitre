#!/usr/bin/env python3
"""
Makes print-ready QR codes, with the logo in the middle, for the homepage and
for every broadcast page — so a poster on a wall leads to the same page (and
the same link-preview card) that a shared link does.

Writes, per code, into assets/img/qr/:
  <name>.png   1600x1600, for raster print workflows and quick sharing
  <name>.svg   vector (modules as one path, logo embedded) — use this for print

Design notes
  * Error-correction level H (~30% of the code can be damaged), which is what
    lets the logo sit in the centre. The logo's white seal covers about 5% of
    the area, far inside that margin.
  * Navy modules on white, with the standard 4-module quiet zone. Keep it on a
    light background when printing; a QR on a dark poster needs a white frame.
  * The URL is the page's canonical address (site.json -> social.siteUrl), with
    no tracking parameters, so the printed code never goes stale on its own.
  * Always scan a proof print before a run. `--verify` decodes every PNG with
    OpenCV (pip install opencv-python-headless) as a quick sanity check.

Needs:  pip install "qrcode[pil]" pillow        (dev-time only)
Usage:  python3 scripts/make_qr_codes.py [--verify]
"""
import base64
import io
import json
import os
import sys

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "img", "qr")
LOGO = os.path.join(ROOT, "assets", "img", "favicon", "radio-hectolitre.png")
NAVY = (14, 36, 51)
SIZE = 1600
QUIET = 4            # modules of white border
SEAL = 0.24          # logo seal diameter as a share of the whole code's width


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def targets():
    """name -> URL: the homepage plus each broadcast page."""
    base = load_json("data/site.json")["social"]["siteUrl"].rstrip("/")
    out = {"home": f"{base}/"}
    for b in load_json("data/broadcasts/index.json")["broadcasts"]:
        out[b["id"]] = f"{base}/{b['href'].lstrip('/')}"
    return out


def matrix(url):
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, border=0, box_size=1)
    qr.add_data(url)
    qr.make(fit=True)
    return qr.get_matrix()


def make_png(m):
    n = len(m)
    total = n + 2 * QUIET
    cell = SIZE / total
    img = Image.new("RGB", (SIZE, SIZE), "white")
    d = ImageDraw.Draw(img)
    for y, row in enumerate(m):
        for x, on in enumerate(row):
            if on:
                x0, y0 = (x + QUIET) * cell, (y + QUIET) * cell
                d.rectangle([x0, y0, x0 + cell, y0 + cell], fill=NAVY)
    # Logo seal: white disc (anti-aliased via 4x supersampling) + the logo.
    disc_d = round(SIZE * SEAL)
    ss = 4
    disc = Image.new("L", (disc_d * ss, disc_d * ss), 0)
    ImageDraw.Draw(disc).ellipse([0, 0, disc_d * ss - 1, disc_d * ss - 1], fill=255)
    disc = disc.resize((disc_d, disc_d), Image.LANCZOS)
    pos = ((SIZE - disc_d) // 2, (SIZE - disc_d) // 2)
    img.paste(Image.new("RGB", (disc_d, disc_d), "white"), pos, disc)
    logo = Image.open(LOGO).convert("RGBA")
    inner = round(disc_d * 0.8)
    logo = logo.resize((inner, inner), Image.LANCZOS)
    img.paste(logo, ((SIZE - inner) // 2, (SIZE - inner) // 2), logo)
    return img


def make_svg(m):
    n = len(m)
    total = n + 2 * QUIET
    path = []
    for y, row in enumerate(m):
        x = 0
        while x < n:                      # merge horizontal runs into one rect each
            if row[x]:
                start = x
                while x < n and row[x]:
                    x += 1
                path.append(f"M{start + QUIET} {y + QUIET}h{x - start}v1h-{x - start}z")
            else:
                x += 1
    disc_d = total * SEAL
    c = total / 2
    logo = Image.open(LOGO).convert("RGBA").resize((256, 256), Image.LANCZOS)
    buf = io.BytesIO()
    logo.save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    inner = disc_d * 0.8
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" width="{total * 10}" height="{total * 10}" '
        f'shape-rendering="crispEdges">\n'
        f'  <rect width="{total}" height="{total}" fill="#fff"/>\n'
        f'  <path d="{"".join(path)}" fill="rgb{NAVY}"/>\n'
        f'  <circle cx="{c}" cy="{c}" r="{disc_d / 2:.3f}" fill="#fff"/>\n'
        f'  <image x="{c - inner / 2:.3f}" y="{c - inner / 2:.3f}" width="{inner:.3f}" height="{inner:.3f}" '
        f'href="data:image/png;base64,{b64}"/>\n'
        f'</svg>\n'
    )


def verify(path, url):
    import cv2
    img = cv2.imread(path)
    text, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    ok = text == url
    print(f"  {'ok  ' if ok else 'FAIL'} {os.path.relpath(path, ROOT)} -> {text or '(no decode)'}")
    return ok


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    codes = targets()
    print("QR codes:")
    for name, url in codes.items():
        m = matrix(url)
        make_png(m).save(os.path.join(OUT_DIR, f"{name}.png"), optimize=True)
        with open(os.path.join(OUT_DIR, f"{name}.svg"), "w", encoding="utf-8") as f:
            f.write(make_svg(m))
        print(f"  assets/img/qr/{name}.png + .svg   {url}  ({len(m)}x{len(m)} modules)")
    if "--verify" in sys.argv:
        print("Decode check:")
        if not all(verify(os.path.join(OUT_DIR, f"{n}.png"), u) for n, u in codes.items()):
            sys.exit(1)


if __name__ == "__main__":
    main()
