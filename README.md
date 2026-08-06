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
  populated by `render-page.js` from `data/broadcasts/<id>.json`. Its
  "Listen" shelf only holds recordings of that specific performance (the
  live recording, ambient recordings, etc.) — separate series belong in
  their own content type (see Episodes/Works below), linked in from a
  broadcast page via `relatedContent`.
- `pages/episodes.html` — index of the Hectolitre.FM interview series
  (`render-archive.js`'s `renderEpisodeGrid`).
- `pages/episodes/<slug>.html` — one page per episode, rendered by the
  generic `render-feature.js` from `data/episodes/<slug>.json`.
- `pages/works/<slug>.html` — one page per standalone guest work (e.g. the
  Venice piece), same `render-feature.js` renderer, different manifest.
- `data/site.json` — site-wide config: nav links, footer, live stream URL.
- `data/broadcasts/index.json` — lightweight index of every broadcast, used
  to build the home/archive grids. Add an entry here whenever you add a broadcast.
- `data/broadcasts/<id>.json` — full manifest for one broadcast (see schema below).
- `data/episodes/index.json` + `data/episodes/<slug>.json` — Hectolitre.FM
  interview series: one lightweight index entry per episode, one full
  manifest per episode (same shape as `data/works/*.json`, see below).
- `data/works/<slug>.json` — a standalone guest work with its own page
  (not part of a series, so no index file — link to it directly from
  wherever it's relevant, e.g. a broadcast's `relatedContent`).
- `assets/css/styles.css` — the only stylesheet. Every page shares it.
- `assets/js/app.js` — shared site chrome: reads `site.json`, renders the
  nav bar and footer into `#site-nav-mount` / `#site-footer-mount`, and
  exposes `buildCardGrid()`, the one card-grid builder used by the
  broadcast archive, the episode index, and a broadcast page's
  "More from the archive" strip.
- `assets/js/render-archive.js` — renders broadcast-card and episode-card grids.
- `assets/js/render-page.js` — renders a single broadcast page: hero, sticky
  player, program text, listen embed + track list, spoken words, photo
  strip + lightbox, ticker, related-content strip.
- `assets/js/render-feature.js` — generic renderer for one episode or one
  standalone work: hero, embed (SoundCloud / audio file / external link),
  synopsis, credits, links, back-link. One renderer, one manifest shape,
  reused by both content types.
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
  "credits": { "madeFor": "...", "producer": "...", "design": "...", "infrastructure": "..." },
  "relatedContent": [
    { "href": "pages/episodes.html", "poster": "https://...", "dateLine": "9 episodes",
      "title": "Hectolitre.FM", "summary": "..." }
  ]
}
```

`tracks[]` should only hold recordings *of that specific broadcast* (the
live recording, an ambient field recording, etc.) — keep it short. Anything
that's really its own body of work (an interview series, a separate guest
piece) belongs in `relatedContent` instead, pointing at an episode or work
page. `tracks[].listen` can be `null` for recordings that aren't published
yet — the player shows "Recording not published yet for this track."
`spokenWords[].variant: "highlight"` renders with the amber accent border
(used for the Refaat Al-Areer tribute block) instead of the default
green-accent border, and supports an optional `note` paragraph underneath.
`relatedContent[]` items use the same card shape as the broadcast/episode
index grids (`RadioHecto.buildCardGrid`).

## Episode / work manifest schema (`data/episodes/<slug>.json`, `data/works/<slug>.json`)

Both content types share one shape, rendered by `render-feature.js`:

```jsonc
{
  "slug": "episode-01-sofhie-mavroudis",
  "type": "episode",             // "episode" | "work" — informational, not used for branching logic
  "eyebrow": "Hectolitre.FM · Episode 01",
  "title": "...",
  "subtitle": "...",             // guest name, or a short line for a standalone work
  "dateLine": "...",
  "coverImage": "https://... or assets/img/...",
  "synopsis": ["paragraph one", "paragraph two"],
  "embed": {
    "type": "soundcloud",        // or "audio" ({ src }) or "link" ({ href, label })
    "embedUrl": "https://w.soundcloud.com/player/?url=..."
  },
  "credits": ["Hosted by ...", "Production: ..."],
  "links": [{ "label": "Listen on SoundCloud ↗", "href": "https://..." }],
  "backLink": { "label": "← All episodes", "href": "pages/episodes.html" }
}
```

Add a new episode: create `data/episodes/<slug>.json`, add an index entry
to `data/episodes/index.json`, copy `pages/episodes/trailer.html` and
update its two `window.FEATURE_DATA` / back-link values. A standalone work
(no index/listing page) just needs the manifest + a copied
`pages/works/*.html`, and a `relatedContent` entry wherever it should be
discoverable from.

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

- `data/episodes/episode-02-zoe-medard.json` has no real synopsis — no
  description was ever published alongside that recording on SoundCloud,
  so the page just says as much and links out to the track.
- The Venice work's embed uses the confirmed ~1-minute trailer file
  (`assets/audio/trailer.opus.ogg` from the god-bless-usa site). No
  distinct "12:40 extract" asset was found in that project's public file
  listing, so rather than guess a URL that might 404, the page previews
  the trailer and links out to the full ~18-minute ceremony.
- `pages/about.html` has structural copy only, pulled from the footer
  credits already in the codebase — it needs real "about" writing.
- Real playback: pressing Play reloads the active track's SoundCloud
  embed with `auto_play=true`. There's no live progress/volume sync back
  into the sticky player — that would need SoundCloud's Widget JS API
  (postMessage-based), which isn't wired up yet.

## Possible future direction

The live-stream button on a broadcast page currently links out to
whatever radio is carrying the live signal (FRP Radio today). Since
broadcasts, episodes and works are now three separate, uniformly-shaped
content collections, a "mixed archive playlist" feature — a shuffled or
curated queue pulled from all three `data/` collections instead of a
single external stream — is a straightforward addition later: it would
mostly be a new small JS module that concatenates the three `index.json`
files and feeds `tracks`-shaped entries into the existing sticky-player
UI, no changes needed to the manifests above.
