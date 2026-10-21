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
| Broadcast | built as `<title> · <date> — Radio Hectolitre` | `summary` in `data/broadcasts/index.json` | `hero.shareImage` in `data/broadcasts/<id>.json` (falls back to `heroImage`) |
| Episode / work | the page's `<title>` | `summary` in the type's `index.json` | `coverImage` in `data/<type>/<slug>.json` |

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
  `assets/img/og/` from artwork already in the repo (`CARDS` at the top of the
  file). `"fit"` keeps a square poster whole over a blurred copy of itself;
  `"crop"` centre-crops a landscape photo.
- Always give an `…Alt` text (the script falls back to a generic one).

## Adding a new broadcast

1. Add the poster/photos as usual (see README → "Adding a new broadcast").
2. Add a line to `CARDS` in `make_share_images.py` for the poster, run it.
3. In `data/broadcasts/<id>.json` set `hero.shareImage` (`assets/img/og/<id>.jpg`)
   and `hero.shareImageAlt`.
4. Make sure the index entry has a `summary` (1–2 sentences, 50–200 chars).
5. `python3 scripts/sync_social_meta.py`, then `--check`.

A new episode or work needs only its `summary` and `coverImage`, then step 5.

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
