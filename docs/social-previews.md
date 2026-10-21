# Social link previews (Open Graph + Twitter/X Card)

What a pasted link looks like on WhatsApp, Slack, Discord, iMessage,
LinkedIn, Facebook, Bluesky, Mastodon, X… is decided by `<meta>` tags in the
page's `<head>`. This site fills its pages in with JavaScript, but **link
crawlers don't run JavaScript** — so these tags must be in the HTML file
itself. They are written there by a script, from the same JSON that drives
the pages, so they can't drift from the content.

## Day-to-day: three commands

```
python3 scripts/make_share_images.py     # only when you add/replace a card image (needs Pillow)
python3 scripts/sync_social_meta.py      # write/refresh the tags in every page
python3 scripts/sync_social_meta.py --check   # verify; exit 1 if anything is stale or missing
```

`--report` prints, per page, the exact title / description / image / card
type a crawler will see, without writing anything. Run `--check` before
every push; it is cheap and catches the usual mistakes (a new page with no
tags, a description edited in JSON but not re-synced, a typo'd image path).

## Where each preview's text and image come from

| Page | Title | Description | Image |
|---|---|---|---|
| Hub pages (`index.html`, `about`, `archive`, `episodes`, `works`) | the page's `<title>` | `data/site.json` → `social.pages.<file>.description` | `social.defaultImage` (override per page with `image` / `imageAlt`) |
| Broadcast | built as `<title> · <date> — Radio Hectolitre` | `summary` in `data/broadcasts/index.json` | the generated card `assets/img/og/<id>.jpg` (else `hero.shareImage`, else `heroImage`) |
| Episode | the page's `<title>` | `summary` in `data/episodes/index.json` | the generated card `assets/img/og/<slug>.jpg` (else `coverImage`) |
| Work | the page's `<title>` | `summary` in `data/works/index.json` | `coverImage` in `data/works/<slug>.json` (or `assets/img/og/<slug>.jpg` if you make one) |

The script also writes `<meta name="description">` and `<link rel="canonical">`
where a page doesn't already have its own (the homepage keeps its hand-written
description).

## The logo and icons

One master, everything else derived: `assets/img/favicon/radio-hectolitre.png`
(transparent, 1024 px, cut out of the original JPEG). `python3 scripts/make_icons.py`
builds from it the 512 px web-app icon, a *maskable* 512 px icon (opaque, logo
inside the safe zone so Android can crop it round), and the 1500 px podcast
cover. The small favicons are older hand-made files and are left alone.

Where each shows up:

- **Share cards** — a white seal holding the logo, straddling a navy strip
  (name · city · coordinates) along the bottom. The seal is white because the
  logo's navy "H" vanishes on dark art. Built by `make_share_images.py`.
- **Browser tab / bookmarks / iOS home screen** — `favicon.*`, `apple-touch-icon.png`.
- **Android install / "Add to Home screen"** — `manifest.webmanifest` + the 192/512/maskable icons.
- **Chrome address bar, Discord embed edge** — `<meta name="theme-color">`
  (`#18a8c8`, the logo's teal; set in `data/site.json` → `social.themeColor`).
  It is one fixed colour for both site themes on purpose: it only tints browser
  chrome and an embed border, it doesn't restyle the page.
- **Google** — `Organization` + `WebSite` structured data on the homepage
  (logo, `sameAs` profiles), written by `sync_social_meta.py`.
- **Podcast apps** — `<itunes:image>` in `feed.xml` (`scripts/generate_feed.py`
  uses the same file). Apps want a square JPEG/PNG of 1400–3000 px.

The master is raster. If you ever get the vector original, drop a better PNG in
as the master and re-run `make_icons.py` + `make_share_images.py` + `sync_social_meta.py`.

## Image rules (why the script warns)

- **1200 × 630 px, JPEG, under ~600 KB** is the safe card. Squares and huge
  originals get cropped mid-word or skipped by messaging apps.
- Landscape images (≥ 1.6:1) get `twitter:card = summary_large_image`;
  squares get `summary` (a small thumbnail beside the text) so nothing is
  cropped. SoundCloud/Bandcamp covers are square, so episodes use `summary`.
- A *remote* cover image can't be measured offline. If it is wide, set
  `"shareCard": "large"` in its JSON (the Venice work does this).
- `scripts/make_share_images.py` builds the 1200×630 cards into
  `assets/img/og/`. Three kinds, all with the logo seal + info strip:
  **broadcast cards** (poster, date set big, title, venue — built automatically
  from `data/broadcasts/`), **episode cards** (guest name over concentric
  "transmission" rings radiating from the seal, echoing the logo's arcs — built
  automatically from `data/episodes/`), and hand-picked **photo cards** (`CARDS`
  at the top of the file; `"crop"` centre-crops a landscape photo, `"fit"` keeps a
  square image whole over a blurred copy of itself). `--list` shows every card name.
- Guest **works** keep their own artwork (Venice, Bandcamp) as their preview.
  To give one a branded card, put the artwork in the repo, add it to `CARDS`,
  run the script — `sync_social_meta.py` picks up `assets/img/og/<slug>.jpg` by name.
- Always give an `…Alt` text (the script falls back to a generic one).

## Adding a new broadcast

1. Add the poster/photos as usual (see README → "Adding a new broadcast").
2. Make sure the index entry in `data/broadcasts/index.json` has a `summary`
   (1–2 sentences, 50–200 chars) and the manifest's `hero` has `title`,
   `dateLine`, `venueLine`, `eyebrowRight` and a square `heroImage`.
3. `python3 scripts/make_share_images.py` — builds `assets/img/og/<id>.jpg` from that
   data. No code or `CARDS` entry needed.
4. `python3 scripts/sync_social_meta.py`, then `--check`.
5. For a printed poster: `python3 scripts/make_qr_codes.py --verify` (below).

A new episode needs only its `summary`, `subtitle` (the guest's name), and steps 3–4.

## QR codes for posters

`python3 scripts/make_qr_codes.py --verify` writes `assets/img/qr/<name>.png` (1600 px)
and `.svg` (vector; print from this) for the homepage and every broadcast page,
each with the logo in the centre. They encode the page's plain canonical URL, so
what a poster scans to is exactly what a shared link previews. `--verify` decodes
every PNG as a sanity check, but **always scan a proof print before a run**: keep
the code on a light background and don't shrink it below ~2.5 cm. Needs
`pip install "qrcode[pil]"`, and `opencv-python-headless` for `--verify`.

## The "on air" favicon

While the station is audibly playing, the browser tab's icon gets a small red
dot (like a recording light); it goes back to normal when the listener stops.
`station.js` reports "on air" (`syncOnAir()`) and `RadioHecto.setOnAir()` in
`app.js` swaps the `<link rel="icon">` elements. It waits ~3 s before switching
off when audio only drops between tracks, so the icon doesn't blink. It never
affects link previews (crawlers don't play audio) — it's tab-level polish only.

## Platform caches — the step that surprises everyone

Platforms cache a link's preview, often for days. After changing tags or an
image, the *already-shared* URL keeps showing the old card until you re-scrape:

- Facebook / Instagram / WhatsApp: Sharing Debugger — https://developers.facebook.com/tools/debug/ → "Scrape Again"
- LinkedIn: Post Inspector — https://www.linkedin.com/post-inspector/
- X/Twitter: no official validator any more; paste the link into a draft post to see it
- Slack / Discord / iMessage: cache per link; add `?v=2` to force a fresh fetch for a test

Images must be reachable at a public `https://` URL, so previews only work
**after** the files are deployed (GitHub Pages). Publishing the tags without
`assets/img/og/*.jpg` gives a card with a broken image.

## What is deliberately not here

- No `og:type = music.song` / audio tags: most platforms ignore them, and a
  playable card needs a Twitter player-card approval that isn't worth it.
- No `twitter:site` / `twitter:creator`: add them to `build_block()` in
  `sync_social_meta.py` if the project gets an X handle.
