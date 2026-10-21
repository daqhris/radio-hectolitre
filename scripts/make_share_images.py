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

Three kinds of card:
  * photo / poster cards  — CARDS below ("crop" a landscape photo, or "fit" a
                            square poster on a blurred copy of itself)
  * broadcast cards       — built automatically for every entry in
                            data/broadcasts/index.json: poster, big date, title,
                            venue (so a new broadcast needs no code, only its JSON)
  * episode cards         — built automatically for every Hectolitre.FM episode:
                            guest name over concentric "transmission" rings that
                            radiate from the logo seal, echoing the logo's arcs

Usage:
    python3 scripts/make_share_images.py                 # build everything
    python3 scripts/make_share_images.py 2026-05-31      # build one by name
    python3 scripts/make_share_images.py --list          # show every card name

Fonts are in scripts/fonts/ (see the README there). After changing a card,
run scripts/sync_social_meta.py — it re-measures the images and rewrites tags.
"""
import json
import math
import os
import re
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

# Hand-picked cards. name -> (source image relative to repo root, mode)
#   "crop": scale to fill the artwork area, then centre-crop (landscape photos)
#   "fit":  show the whole image on a blurred copy of itself (square posters
#           whose lettering must not be cropped)
CARDS = {
    "radio-hectolitre": ("assets/img/photos/2026-05-31/Hecto-May31-2026-WEB.jpg", "crop"),
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


# ---------------------------------------------------------------- text helpers

def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def fit_font(draw, text, name, max_w, start, minimum=28):
    """Largest size (<= start) at which `text` fits max_w."""
    size = start
    while size > minimum and draw.textlength(text, font=font(name, size)) > max_w:
        size -= 2
    return font(name, size)


def wrap(draw, text, fnt, max_w, max_lines=2):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(" ,;:—-") + "…"
    return lines


def split_date(date_line):
    """'31 May 2026' -> ('31 MAY', '2026'); anything else -> (the whole line, '')."""
    m = re.match(r"^\s*(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})\s*$", date_line or "")
    return (f"{m.group(1)} {m.group(2).upper()}", m.group(3)) if m else ((date_line or "").upper(), "")


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


def card_broadcast(hero, poster):
    """Blurred poster as the room, the poster itself on the right, the date set big on the left."""
    card = Image.new("RGB", (W, H), NAVY)
    card.paste(blurred_backdrop(poster, W, BODY_H, dim=0.45), (0, 0))
    d = ImageDraw.Draw(card)

    side, px, py = 500, 650, (BODY_H - 500) // 2
    shadow = Image.new("L", (W, BODY_H), 0)
    ImageDraw.Draw(shadow).rectangle([px + 6, py + 10, px + side + 6, py + side + 10], fill=170)
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    card.paste(Image.new("RGB", (W, BODY_H), (0, 0, 0)), (0, 0), shadow)
    card.paste(poster.resize((side, side), Image.LANCZOS), (px, py))
    d.rectangle([px - 1, py - 1, px + side, py + side], outline=(255, 255, 255), width=2)

    x, max_w = 64, 540
    eyebrow = (hero.get("eyebrowRight") or hero.get("eyebrowLeft") or "").upper()
    spaced(d, (x, 40), eyebrow, font("IBMPlexMono-SemiBold.ttf", 22), TEAL, tracking=3)
    day_month, year = split_date(hero.get("dateLine", ""))
    big = fit_font(d, day_month, "BebasNeue-Regular.ttf", max_w, 168)
    d.text((x, 62), day_month, font=big, fill=WHITE)
    y = 62 + big.getbbox(day_month)[3] + 6
    if year:
        d.text((x + 4, y), year, font=font("BebasNeue-Regular.ttf", 76), fill=TEAL)
        y += 86
    title_font = font("BebasNeue-Regular.ttf", 50)
    for line in wrap(d, hero.get("title", ""), title_font, max_w):
        d.text((x, y + 6), line.upper(), font=title_font, fill=WHITE)
        y += 54
    venue = hero.get("venueLine") or ""
    if venue:
        d.text((x, y + 14), venue, font=font("IBMPlexMono-Regular.ttf", 21), fill=(170, 205, 218))
    return brand(card)


def card_episode(detail, summary=""):
    """Concentric rings radiating from the logo seal (the logo's own arcs, writ large) behind the guest's name."""
    ss = 2
    cx, cy = 36 + 70, BODY_H + 2   # the seal's centre (see brand())
    base = Image.linear_gradient("L").resize((1, BODY_H)).resize((W, BODY_H))
    top, bottom = (11, 30, 44), (13, 74, 98)
    card = Image.new("RGB", (W, H), NAVY)
    card.paste(Image.merge("RGB", [base.point(lambda v, a=a, b=b: round(a + (b - a) * v / 255)) for a, b in zip(top, bottom)]), (0, 0))

    rings = Image.new("RGBA", (W * ss, BODY_H * ss), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rings)
    r, i = 150, 0
    while r < 1500:
        alpha = max(16, round(190 * math.exp(-i * 0.30)))
        rd.ellipse([(cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss], outline=TEAL + (alpha,), width=5 * ss)
        r += 78
        i += 1
    rings = rings.resize((W, BODY_H), Image.LANCZOS)
    card.paste(rings, (0, 0), rings)

    d = ImageDraw.Draw(card)
    subtitle = detail.get("subtitle", "")
    # An episode's subtitle is the guest's name; the trailer's is a sentence, so lead with its title.
    # Underneath goes the index summary, never a repeat of the name above it.
    lead = subtitle if 0 < len(subtitle) <= 30 else detail["title"]
    sub = summary
    x, max_w = 70, 1060
    spaced(d, (x, 74), (detail.get("eyebrow") or "").upper(), font("IBMPlexMono-SemiBold.ttf", 26), TEAL, tracking=3)
    big = fit_font(d, lead.upper(), "BebasNeue-Regular.ttf", max_w, 190)
    d.text((x, 118), lead.upper(), font=big, fill=WHITE)
    y = 118 + big.getbbox(lead.upper())[3] + 26
    if sub:
        sub_font = font("IBMPlexMono-Regular.ttf", 26)
        for line in wrap(d, sub, sub_font, max_w, 2):
            d.text((x, y), line, font=sub_font, fill=(190, 222, 232))
            y += 38
    if detail.get("dateLine"):
        d.text((x, y + 10), detail["dateLine"], font=font("IBMPlexMono-Regular.ttf", 22), fill=(120, 170, 190))
    return brand(card)


# ---------------------------------------------------------------- the card list

def all_cards():
    """name -> zero-argument function returning the finished card."""
    cards = {}

    def photo(rel, mode):
        def make():
            with Image.open(os.path.join(ROOT, rel)) as im:
                return LAYOUTS[mode](im.convert("RGB"))
        return make

    for name, (rel, mode) in CARDS.items():
        cards[name] = photo(rel, mode)

    for b in load_json("data/broadcasts/index.json")["broadcasts"]:
        hero = load_json(f"data/broadcasts/{b['id']}.json")["hero"]

        def make(hero=hero):
            with Image.open(os.path.join(ROOT, hero["heroImage"])) as im:
                return card_broadcast(hero, im.convert("RGB"))
        cards[b["id"]] = make

    for e in load_json("data/episodes/index.json")["episodes"]:
        detail = load_json(f"data/episodes/{e['slug']}.json")
        cards[e["slug"]] = lambda detail=detail, s=e.get("summary", ""): card_episode(detail, s)
    return cards


def save(card, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{name}.jpg")
    card.save(out, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"  {os.path.relpath(out, ROOT)}  {W}x{H}  {os.path.getsize(out) // 1024} KB")


def main():
    cards = all_cards()
    args = sys.argv[1:]
    if args == ["--list"]:
        print("\n".join(cards))
        return
    unknown = [n for n in args if n not in cards]
    if unknown:
        sys.exit(f"Unknown card(s): {', '.join(unknown)}. Known: {', '.join(cards)}")
    print("Share images:")
    for name in args or cards:
        save(cards[name](), name)


if __name__ == "__main__":
    main()
