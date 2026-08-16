# Radio Hectolitre

Artists-run broadcasting at Hectolitre — web radio pages that combine:
- a live stream link/button
- a "listen shelf" (SoundCloud embeds now, local audio later)
- a photo documentation strip + lightbox
- spoken words / liner notes
- an audio library list for track selection
- a scrolling ticker + footer
- a shared **virtual station** — a fixed, wall-clock-synced program of the
  whole archive, played from a persistent bar on every page
- a podcast **RSS feed** and **M3U playlist** for the self-hosted portion
  of the archive

## Orientation for new contributors (human or agent)

- No build step, no framework, no dependencies. Every `.html`/`.js`/`.json`
  file is meant to be read directly — there's nothing compiled or
  generated except `feed.xml` / `station.m3u` (see below).
- Two documents to read before changing anything: this README (site
  structure and content schemas) and `docs/station-notes.md` (the
  station's sync logic and how to feed it new content). Skim both before
  your first edit.
- Almost all routine changes are *data* changes — adding a JSON entry
  and/or copying an existing HTML template — not new logic. If a task
  seems to require new JS, check the "Architecture" list below first;
  there's likely already a generic renderer that just needs a new
  manifest.
- **Read the base-path section below before adding any page or link.**
  This is the one thing that silently breaks if skipped — a hardcoded
  `/assets/...` or `"pages/foo.html"` string will 404 depending on which
  folder the page loading it lives in.
- There's no test suite or CI. Sanity-check changes by serving the repo
  root over HTTP and clicking through — `fetch()` of local JSON won't
  work over a bare `file://` URL:
  ```
  python3 -m http.server 8000
  # then open http://localhost:8000/
  ```

## Architecture

Static, framework-free, data-driven multi-page site. GitHub Pages requires
`/index.html` at the repo root to serve `/`, so that's the canonical
homepage — it's a thin shell (see below) rather than a hand-authored page.

- `index.html` — homepage. Thin: mostly empty containers, populated by
  `render-archive.js` from `data/broadcasts/index.json`,
  `data/episodes/index.json`, and `data/works/index.json` — one labeled
  section per content type (Currently transmitting, Past broadcasts,
  Interviews, Guest works).
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
- `pages/works.html` — index of standalone guest works
  (`render-archive.js`'s `renderWorksGrid`, from `data/works/index.json`).
- `pages/works/<slug>.html` — one page per standalone guest work (e.g. the
  Venice piece), same `render-feature.js` renderer, different manifest.
- `data/site.json` — site-wide config: nav links, footer, live stream URL.
- `data/broadcasts/index.json` — lightweight index of every broadcast, used
  to build the home/archive grids. Add an entry here whenever you add a broadcast.
- `data/broadcasts/<id>.json` — full manifest for one broadcast (see schema below).
- `data/episodes/index.json` + `data/episodes/<slug>.json` — Hectolitre.FM
  interview series: one lightweight index entry per episode, one full
  manifest per episode (same shape as `data/works/*.json`, see below).
- `data/works/index.json` + `data/works/<slug>.json` — standalone guest
  works: one lightweight index entry per work (card shape, same pattern as
  broadcasts/episodes), one full manifest per work for its own page.
- `data/station/queue.json` — the shared station's fixed program: an
  ordered list of tracks (drawn from the collections above) plus an
  `epoch` reference point. See "The shared station" below and
  `docs/station-notes.md` for the full explanation.
- `assets/css/styles.css` — the only stylesheet. Every page shares it.
- `assets/js/app.js` — shared site chrome: reads `site.json`, renders the
  nav bar and footer into `#site-nav-mount` / `#site-footer-mount`, exposes
  `buildCardGrid()` (the one card-grid builder used by every archive/index
  grid on the site), and — if `station.js` has been loaded on the page —
  boots the station player as part of `initChrome()`.
- `assets/js/station.js` — the shared station player. Persistent bottom
  bar, mounted on every page automatically (see "The shared station"
  below). Loaded via its own `<script>` tag after `app.js` on every page;
  `app.js` calls `window.initStationPlayer()` if present, so no other
  per-page wiring is needed.
- `assets/js/render-archive.js` — renders broadcast-card, episode-card,
  and works-card grids (`renderBroadcastGrid`, `renderEpisodeGrid`,
  `renderWorksGrid` — same underlying `buildCardGrid()`, different
  index.json source).
- `assets/js/render-page.js` — renders a single broadcast page: hero, sticky
  player, program text, listen embed + track list, spoken words, photo
  strip + lightbox, ticker, related-content strip.
- `assets/js/render-feature.js` — generic renderer for one episode or one
  standalone work: hero, embed (SoundCloud / audio file / external link),
  synopsis, credits, links, back-link. One renderer, one manifest shape,
  reused by both content types.
- `assets/img/photos/<broadcast-id>/...` — documentation photos.
- `feed.xml`, `station.m3u` — generated files, not hand-edited. Run
  `scripts/generate_feed.py` to regenerate after adding self-hosted audio
  (see "Podcast feed & playlist" below).
- `scripts/generate_feed.py` — regenerates `feed.xml` and `station.m3u`
  from `data/station/queue.json`.
- `scripts/probe_durations.py` — measures real durations for self-hosted
  (`"type": "file"`) tracks via `ffprobe` and updates `queue.json` in
  place. SoundCloud tracks are out of scope (see `docs/station-notes.md`
  for why); those still need a manual duration check.
- `scripts/set_duration.py` — safely enters a manually-checked duration
  (`mm:ss`) into `queue.json` for one track, for the SoundCloud tracks
  `probe_durations.py` can't reach. Validates before writing.
- `docs/station-notes.md` — the station's sync algorithm explained, how to
  add content to the program, and why durations/enclosure sizes are
  currently estimates.
- `docs/audio-hosting-guide.md` — what audio hosting needs to support
  (direct URLs, `HEAD`, byte-range, CORS) to work in `feed.xml`/
  `station.m3u`, and how to tell a bot-protection block from an actual
  hosting gap. Written to be reusable by anyone at Hectolitre hosting
  sound work elsewhere, not just this repo.

### Base-path convention

There's no fixed deployment root (works from a custom domain root or a
GitHub Pages project subpath), so every page sets `window.SITE_BASE` before
loading `app.js`, and all internal fetches/links go through
`RadioHecto.withBase(path)` rather than using leading-slash `/assets/...`
paths:

| Page location                                          | `SITE_BASE` |
|---|---|
| `/index.html`                                          | `""` |
| `/pages/*.html`                                        | `"../"` |
| `/pages/broadcasts/*.html`, `/episodes/*.html`, `/works/*.html` | `"../../"` |

`station.js` follows the same convention (it destructures `withBase` from
`RadioHecto`, same as `render-page.js`/`render-feature.js` do) — the one
exception is track `src`/`embedUrl` values in `queue.json`, which are
already absolute URLs (SoundCloud, or the audio host) and pass through
`withBase()` unchanged. Only `href` (the "more about this track" link)
needs base-path resolution.

## The shared station

GitHub Pages can't run a server, so there's no way to produce one
continuous shared audio stream the way a real internet-radio setup
(Icecast/Azuracast) does. What ships instead: every listener's browser
independently computes *"what should be playing right now"* from a fixed
program (`data/station/queue.json`) and the wall clock —
`(Date.now() - epoch) mod totalDuration` — landing on the same track and
the same offset without any server or listener-to-listener coordination.

The player (`assets/js/station.js`) is mounted as global site chrome: a
persistent bar fixed to the bottom of every page, rendered by
`initStationPlayer()`, which `app.js`'s `initChrome()` calls automatically
if `station.js` has been loaded. Tapping play seeks to the current
computed position and starts playback — swapping between a real
`<audio>` element and the SoundCloud Widget API depending on the track's
`type`. On track end, it recomputes fresh from the wall clock rather than
just stepping to the next index, so any drift from an inaccurate
`durationSec` self-corrects at the next boundary instead of compounding.

Full details — the algorithm, the SoundCloud Widget API integration (and
why it reuses one widget instance rather than creating a new one per
track — see the comment in `playSoundcloud()` in `station.js` for a bug
that pattern caused and how it was fixed), how to add tracks, and why
durations are currently estimates — are in `docs/station-notes.md`.

Browsers block audio autoplay until a user gesture, so the station never
starts on page load by itself — the Play tap is that gesture. This is
standard behavior for any streaming site, not a gap specific to this one.

## Podcast feed & playlist

`feed.xml` (RSS 2.0 + iTunes podcast tags) and `station.m3u` (plain
playlist) are generated from `data/station/queue.json` by
`scripts/generate_feed.py`, and only include tracks with `"type": "file"`
— i.e. self-hosted audio with a real, redistributable URL. SoundCloud's
embed widget doesn't expose one, so SoundCloud-only tracks can't appear in
either format; they're still discoverable via SoundCloud's own feed for
the account. This means both files are small today (one item) and grow
automatically as broadcast recordings get self-hosted rather than
SoundCloud-only — no code changes needed, just add the track to
`queue.json` with `"type": "file"` and re-run the script.

```
python3 scripts/generate_feed.py
```

Run this from a machine that can actually reach the audio host — it
attempts an HTTP HEAD request per track to populate the RSS
`<enclosure length>` (bytes). See `docs/station-notes.md` and "Known gaps"
below for what to check on the hosting side if that comes back empty.

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

Note: this per-broadcast track player is separate from the shared station
(above) — pressing its Play button reloads the active track's SoundCloud
embed with `auto_play=true` but has no live progress/volume sync back into
the sticky player UI. That would need the same SoundCloud Widget JS API
integration `station.js` now uses; not wired up here yet.

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
update its two `window.FEATURE_DATA` / back-link values. A new guest work:
same pattern, but add the index entry to `data/works/index.json` and copy
`pages/works/god-bless-usa.html` instead. Either way, if the track has a
real, self-hosted audio file (not just a SoundCloud embed), also add it to
`data/station/queue.json` with `"type": "file"` to get it into the shared
station, `feed.xml`, and `station.m3u` automatically.

## Adding a new broadcast

1. Add images to `assets/img/photos/<broadcast-id>/`.
2. Create `data/broadcasts/<broadcast-id>.json` (schema above).
3. Add an entry to `data/broadcasts/index.json` (`status: "current"` for
   the new one; flip the previous entry to `"archived"`).
4. Copy `pages/broadcasts/2026-05-31.html`, rename it, and update the two
   inline `window.BROADCAST_ID` / `<title>` values.
5. When local audio replaces a SoundCloud embed, set
   `tracks[].listen = { "type": "file", "src": "assets/audio/<id>/track.mp3" }`.
6. If that recording should join the shared station, add it to
   `data/station/queue.json` too (`"type": "file"`, real `durationSec` if
   you have it) — this also gets it into `feed.xml`/`station.m3u` the next
   time `scripts/generate_feed.py` runs.

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
- Self-hosted track durations can be measured automatically with
  `python3 scripts/probe_durations.py` (see `docs/station-notes.md`).
  SoundCloud track durations still need a manual check — no scriptable
  way to get those without SoundCloud's authenticated API.
- `feed.xml`'s `<enclosure length>` is currently `0` — the host returned
  an error on a HEAD request when the feed was last generated. See
  `docs/audio-hosting-guide.md` for how to diagnose and fix this (it's
  usually a bot-protection rule blocking non-browser requests, not a
  fundamental hosting problem).

## Possible future direction

- **Per-broadcast sticky player parity.** Give the broadcast-page track
  player (`render-page.js`) the same Widget-API integration `station.js`
  has, for real progress/volume sync instead of just reloading the embed.
  Deferred for now — see reasoning below.

Not a future direction, decided against: the hero used to run a
decorative `Math.sin()` VU-bar animation, unrelated to actual playback.
Removed rather than made real — basic protocol correctness (playback,
feed, per-broadcast parity above) takes priority over decorative polish,
and a fake meter wasn't worth keeping around as a placeholder for a real
one built later.

Not a future direction, permanent policy: the station has no skip
control. See `docs/station-notes.md` — a station has one frequency, and
skipping has no equivalent in that metaphor.
