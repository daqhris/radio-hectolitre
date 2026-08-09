# Hosting audio so it can be linked, not just embedded

For anyone at Hectolitre adding sound work to this project (or elsewhere)
— what it actually takes for a track to work in an RSS feed, an M3U
playlist, or any tool that expects a real audio URL rather than an embed.

## The one thing that matters: does the platform give you a stable, direct URL?

An **embed** (an iframe/widget you paste into a page) and a **direct
link** (a URL that resolves straight to the audio bytes) are different
things, and a lot of platforms only give you the first.

| Platform | Embeddable? | Stable direct URL for RSS/M3U/hotlinking? |
|---|---|---|
| SoundCloud | Yes, well | **No** — the widget deliberately obfuscates and time-limits the underlying file URL, even for tracks with "download" enabled. There's no way around this from outside SoundCloud. |
| Bandcamp | Yes | **No** — Bandcamp dropped RSS support entirely, and even "free download" links go through a claim flow rather than exposing a permanent public URL. |
| Your own site / a podcast host / object storage (S3, R2, etc.) | Depends on setup | **Yes**, if the file is served at a fixed URL that doesn't require a login, a click-through, or a signed/expiring link. |

This isn't a workaround-able limitation — it's how SoundCloud and
Bandcamp are built (streaming in place, not redistribution), and it's
fine: keep using them for what they're good at, embedding and audience
discovery. Just know that a track living *only* there can never appear in
a podcast app's subscription feed or a "tune in" playlist file, only ever
inside a page that embeds it. If a track should show up in either of
those, it needs a self-hosted copy somewhere, even if the embed stays as
the primary listening experience.

## What "self-hosted" needs to actually support

Once a file lives somewhere you control, four things need to be true for
it to work well in an RSS enclosure or M3U entry, and for a browser to
seek/scrub it properly:

1. **A real, plain URL.** `https://yoursite.com/audio/track.mp3` — not a
   redirect, not a signed URL that expires, not a page you have to click
   through. `curl -IL <url>` should return `200` directly (a redirect
   chain — `301`/`302` — breaks some podcast apps and confuses feed
   generators, per [WordPress's own podcasting notes on this exact
   problem with Archive.org-hosted files](https://codex.wordpress.org/Podcasting)).

2. **`HEAD` requests work, not just `GET`.** Podcast apps and feed
   generators often send a `HEAD` request first to check the file exists
   and read its size before downloading. Test it directly:
   ```
   curl -I https://yoursite.com/audio/track.mp3
   ```
   You want a `200` with a real `Content-Length` header. If you get
   `403`/`405`/a redirect instead, something in front of the file
   (a CDN/WAF/anti-bot layer) is blocking or mishandling `HEAD` — see
   below.

3. **Byte-range requests work (`Accept-Ranges: bytes`).** This is what
   lets a listener scrub to the middle of a long track instead of
   downloading it from the start. Check:
   ```
   curl -I https://yoursite.com/audio/track.mp3 | grep -i accept-ranges
   ```
   Any standard static file server (GitHub Pages, Netlify, Vercel,
   Cloudflare Pages, S3, nginx/Apache serving a plain file) supports this
   automatically — it's not something you configure, but worth confirming
   once per host, since some serverless/edge-function setups that
   *generate* a response rather than serving a static file can silently
   drop it.

4. **The right `Content-Type`.** `.mp3` → `audio/mpeg`, `.ogg`/`.opus` in
   an Ogg container → `audio/ogg`, `.m4a` → `audio/mp4`, `.wav` →
   `audio/wav`. Almost every static host infers this correctly from the
   file extension by default; only worth checking if you're serving audio
   through something unusual (a custom function/route rather than a plain
   static file).

## If `HEAD` comes back blocked or wrong

Two different problems produce the same symptom, so it's worth telling
them apart before "fixing" anything:

- **The host/CDN's bot or WAF protection is blocking the request**,
  because it doesn't look like it came from a normal browser. This is
  common on Cloudflare, Vercel, and similar edge platforms with
  bot-protection turned on. Test with and without a browser-like
  `User-Agent` to tell:
  ```
  curl -I https://yoursite.com/audio/track.mp3                                    # bare curl
  curl -I -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)" https://yoursite.com/audio/track.mp3   # spoofed browser UA
  ```
  If the second one works and the first doesn't, it's a bot-protection
  rule, not a fundamental hosting problem. The fix is host-specific
  (an allowlist rule / turning off aggressive bot protection for the
  audio path), but the diagnosis is the same everywhere.

- **The host genuinely doesn't serve `HEAD` for this path** — more likely
  if the file is served through a function/route rather than as a plain
  static asset (e.g. a serverless function that only implements `GET`).
  The fix there is almost always "serve the file as a static asset
  instead of through custom logic," which also happens to be the simplest
  and cheapest way to serve audio in general.

## Quick reference by host

Not knowing which of these applies to any given artist's setup, but for
whichever one does:

- **GitHub Pages / Cloudflare Pages / Netlify / Vercel (static hosting,
  no custom function in the request path)** — all of the above works out
  of the box for a plain file in the deployed output. Nothing to
  configure.
- **Cloudflare-fronted domain with bot protection or a WAF enabled** —
  check the bot-protection rules aren't catching automated/non-browser
  requests to the audio path specifically; podcast apps and feed
  generators are exactly the kind of client that pattern-matches as "not
  a browser."
- **A custom server (nginx/Apache) or a serverless function serving the
  file** — confirm the audio is served as a static file, not generated
  through a handler that only implements `GET`.

## While we're here: CORS, for anyone who wants audio-reactive visuals

Not needed for RSS/M3U, but related: if you ever want a waveform or
VU-meter visualization that reacts to the *actual* playing audio (rather
than a decorative animation), the browser's Web Audio API needs to read
the raw audio data, which requires the file to be served with
`Access-Control-Allow-Origin` permitting the page's origin (or `*`).
Static hosts generally need this turned on explicitly per-host; it's not
required for playback itself, only for analyzing the waveform.
