# Radio Hectolitre

Artists-run broadcasting at Hectolitre — web radio pages that combine:
- a live stream link/button
- a "listen shelf" (SoundCloud embeds now, local audio later)
- a photo documentation strip + lightbox
- spoken words / liner notes
- an audio library list for track selection
- a scrolling ticker + footer

## Architecture

Static, framework-free, data-driven multi-page site. GitHub Pages requires
`/index.html` at the repo root to serve `/`, so that's the canonical
homepage — it's a thin shell (see below) rather than a hand-authored page.

- `index.html` — homepage / archive hub. Thin: mostly empty containers,
  populated by `render-archive.js` from `data/broadcasts/index.json`.
- `pages/index.html` — a static redirect back to `/`, kept only so
  `/pages/index.html` resolves somewhere instead of 404ing (it mirrors the
  URL pattern of `/pages/about.html` and `/pages/archive.html`).
- `pages/about.html` — about page. Static content + shared nav/footer chrome.
- `pages/archive.html` — full broadcast listing (`render-archive.js`, `filter: "all"`).
- `pages/broadcasts/<id>.html` — one page per broadcast. Thin shell,
  populated by `render-page.js` from `data/broadcasts/<id>.json`.
- `data/site.json` — site-wide config: nav links, footer, live stream URL.
- `data/broadcasts/index.json` — lightweight index of every broadcast, used
  to build the home/archive grids. Add an entry here whenever you add a broadcast.
- `data/broadcasts/<id>.json` — full manifest for one broadcast (see schema below).
- `assets/css/styles.css` — the only stylesheet. Every page shares it.
- `assets/js/app.js` — shared site chrome: reads `site.json`, renders the
  nav bar and footer into `#site-nav-mount` / `#site-footer-mount`.
- `assets/js/render-archive.js` — renders broadcast-card grids (home + archive).
- `assets/js/render-page.js` — renders a single broadcast page: hero, sticky
  player, program text, listen embed + track list, spoken words, photo
  strip + lightbox, ticker.
- `assets/img/photos/<broadcast-id>/...` — documentation photos.

### Base-path convention

There's no fixed deployment root (works from a custom domain root or a
GitHub Pages project subpath), so every page sets `window.SITE_BASE` before
loading `app.js`, and all internal fetches/links go through
`RadioHecto.withBase(path)` rather than using leading-slash `/assets/...`
paths:

| Page location              | `SITE_BASE` |
|---|---|
| `/index.html`               | `""` |
| `/pages/*.html`             | `"../"` |
| `/pages/broadcasts/*.html`  | `"../../"` |

## Broadcast manifest schema (`data/broadcasts/<id>.json`)

```jsonc
{
  "id": "2026-05-31",
  "status": "current",           // "current" | "archived" — drives the homepage grid
  "hero": {
    "eyebrowLeft": "...", "eyebrowRight": "...",
    "title": "...", "dateLine": "...", "timeLine": "...", "venueLine": "...",
    "shortDescription": "...", "heroImage": "assets/img/photos/<id>/poster.jpg"
  },
  "program": { "heading": "...", "paragraphs": ["..."], "tags": ["..."] },
  "live": { "liveLabel": "Live stream", "liveStreamUrl": "https://..." },
  "tracks": [
    { "num": "01", "title": "...", "sub": "...", "dur": "1:00:00", "active": true,
      "listen": { "type": "soundcloud", "embedUrl": "https://w.soundcloud.com/player/?url=..." } },
    { "num": "02", "title": "...", "sub": "...", "dur": "—", "active": false, "listen": null }
  ],
  "spokenWords": [
    { "attribution": "...", "variant": "default", "text": "...", "links": [] },
    { "attribution": "...", "variant": "highlight", "text": "...", "note": "...", "links": [{ "label": "...", "href": "..." }] }
  ],
  "photos": [
    { "src": "assets/img/photos/<id>/01.jpg", "w": 2500, "h": 1670, "alt": "...", "caption": "..." }
  ],
  "ticker": ["..."],
  "credits": { "madeFor": "...", "producer": "...", "design": "...", "infrastructure": "..." }
}
```

`tracks[].listen` can be `null` for recordings that aren't published yet —
the player shows "Recording not published yet for this track."
`spokenWords[].variant: "highlight"` renders with the amber accent border
(used for the Refaat Al-Areer tribute block) instead of the default
green-accent border, and supports an optional `note` paragraph underneath.

## Adding a new broadcast

1. Add images to `assets/img/photos/<broadcast-id>/`.
2. Create `data/broadcasts/<broadcast-id>.json` (schema above).
3. Add an entry to `data/broadcasts/index.json` (`status: "current"` for
   the new one; flip the previous entry to `"archived"`).
4. Copy `pages/broadcasts/2026-05-31.html`, rename it, and update the two
   inline `window.BROADCAST_ID` / `<title>` values.
5. When local audio replaces a SoundCloud embed, set
   `tracks[].listen = { "type": "file", "src": "assets/audio/<id>/track.mp3" }`.

## Known gaps / things still to fill in

- Several `tracks[]` entries in `data/broadcasts/2026-05-31.json` have
  `"listen": null` — real SoundCloud URLs (or local files) for those
  individual tracks weren't available in the source content and still
  need to be added.
- `pages/about.html` has structural copy only, pulled from the footer
  credits already in the codebase — it needs real "about" writing.
- Real playback: pressing Play reloads the active track's SoundCloud
  embed with `auto_play=true`. There's no live progress/volume sync back
  into the sticky player — that would need SoundCloud's Widget JS API
  (postMessage-based), which isn't wired up yet.
