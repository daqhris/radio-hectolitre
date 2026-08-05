# Radio Hectolitre

Artists-run broadcasting at Hectolitre — web radio pages that combine:
- a live stream link/button
- a “listen shelf” (SoundCloud embeds now, local audio later)
- a photo documentation strip + lightbox
- spoken words / liner notes
- an audio library list for track selection
- a scrolling ticker + footer

## Current proof-of-concept
- GitHub Pages PoC (static front-end)
- content lives in `data/broadcasts/*.json`
- assets live in `assets/`

## Repository layout

- `index.html`
  - Current landing page / current broadcast page
  - Contains the styling baseline and the DOM structure to render content
- `pages/`
  - `pages/broadcasts/`
  - (Optional) dedicated HTML pages per broadcast
- `data/broadcasts/`
  - One JSON manifest per broadcast:
  - `data/broadcasts/<broadcast-id>.json`
- `assets/`
  - `assets/css/` (global or app-level styles if you split CSS out later)
  - `assets/js/` (site JS, renderer / lightbox / audio handling)
  - `assets/img/posters/`
  - `assets/img/photos/<broadcast-id>/...`

## Broadcast manifest concept

Each broadcast JSON should describe:
- hero text (title/date/venue)
- tags
- live stream URL
- listen shelf:
  - SoundCloud embed(s) (now)
  - local audio files (later)
- photo strip:
  - images + captions
- spoken words blocks:
  - attribution + main text + optional links
- audio library:
  - numbered items with active state + listen source

## Adding a new broadcast (workflow)

1) Add images:
- `assets/img/photos/<broadcast-id>/01.jpg`, `02.jpg`, etc.

2) Create a manifest:
- `data/broadcasts/<broadcast-id>.json`

3) Update front-end:
- If you use the single-page loader: set the broadcast id in the loader.
- If you use per-page HTML: add a page in `pages/broadcasts/` that sets the broadcast id.

4) Add local audio (when ready):
- Put files into `assets/audio/<broadcast-id>/`
- Set `listen.type = "file"` in the manifest.
