# The station — how it works and how to maintain it

Three things shipped together, all built on the same source of truth
(`data/station/queue.json`):

1. **The in-browser player** (`assets/js/station.js`) — a persistent bar
   at the bottom of every page.
2. **`feed.xml`** — a podcast RSS feed, for podcast apps and RSS readers.
3. **`station.m3u`** — a plain playlist file, for apps that expect a
   station/playlist URL rather than a podcast feed.

## The core idea: a synced station without a server

GitHub Pages can't run a server, so there's no way to produce one
continuous shared audio stream the way Icecast/Azuracast does. What we
can do statically: give every listener's browser the same fixed program
and let it independently compute *"what should be playing right now"*
from the wall clock. No two listeners' browsers talk to each other or to
a server — they just do the same arithmetic and land on the same answer.

The math (`computePosition()` in `station.js`):

```
elapsed = (Date.now() - epoch) mod totalProgramDuration
walk the track list, subtracting each track's duration from `elapsed`,
until you land inside one — that's the current track and offset.
```

Because this is a pure function of wall-clock time, there's no drift to
accumulate across a session, and nothing to keep synced server-side. If
one track's declared duration is wrong, playback self-corrects at the
next track boundary (see "About the estimated durations" below) rather
than compounding the error.

One real constraint: browsers block audio autoplay until a user gesture.
So it's always "tap play, then you're caught up to the live position" —
never audio starting the instant a page loads. That's standard for every
streaming site, not a gap in this design.

## Adding content to the program

Append an entry to the `tracks` array in `data/station/queue.json`. Two
shapes, matching how `render-page.js` already plays tracks elsewhere on
the site:

```json
{
  "id": "unique-short-id",
  "kind": "Broadcast | Interview | Guest work",
  "title": "Shown in the player",
  "sub": "Shown smaller, under the title",
  "type": "file",
  "src": "https://.../recording.ogg",
  "durationSec": 1234,
  "durationIsEstimate": false,
  "publishedAt": "2026-06-01",
  "href": "pages/broadcasts/2026-06-01.html"
}
```

or, for a SoundCloud-embedded track, `"type": "soundcloud"` with an
`"embedUrl"` (same format already used in `data/episodes/*.json`) instead
of `"src"`. SoundCloud tracks don't need `publishedAt` — that field only
matters for the RSS feed, which can't include them anyway (see below).

Order in the array is program order. `epoch` is just a fixed reference
point for the clock math — it can stay put; there's no need to change it
when adding tracks.

## About the estimated durations

Every track currently in `queue.json` has `durationIsEstimate: true` with
a round-number placeholder (60s for the Venice trailer, 720s/12min for
each interview). These are genuinely just guesses — I didn't have a
reliable way to fetch or probe your audio to get exact numbers.

What an estimate being wrong actually costs: the player might seek to an
offset past a track's real end, which clips it short on that particular
tune-in, then immediately advances (self-correcting) to the next
computed position. Not ideal, but not broken.

To fix a duration:
- **Self-hosted file**: `ffprobe -v error -show_entries format=duration
  -of csv=p=0 yourfile.ogg` gives seconds. Round it and set
  `durationIsEstimate: false`.
- **SoundCloud track**: the track's duration is shown on its SoundCloud
  page under the waveform. Round to the nearest second.

## Why `feed.xml` and `station.m3u` only have one item today

Both formats need a direct, redistributable audio URL to point at.
SoundCloud's embed widget doesn't give you one — there's no stable public
URL you're allowed to hand to a podcast app or playlist file, only the
iframe embed. So today, only the Venice trailer (a file you host
yourself) qualifies. This grows automatically as broadcast recordings get
uploaded as files rather than SoundCloud-only — no extra work needed
beyond adding them to `queue.json` with `"type": "file"`.

Your SoundCloud episodes are still aggregable in the meantime — just via
SoundCloud's own feed for the account (soundcloud.com/user-816404246),
not this one.

## Regenerating `feed.xml` and `station.m3u`

```
python3 scripts/generate_feed.py
```

Run this locally (not from a sandboxed/offline environment) after adding
or changing any `"type": "file"` track, so it can reach the audio file to
read its real byte size for the RSS `<enclosure length>`. Standard
library only, no dependencies to install.

If `<enclosure length>` comes out as `0` (HEAD request blocked or
unreachable), most podcast apps still play the episode fine — `length`
is metadata, not a requirement for playback — but it's worth checking
your host allows `HEAD` requests if you want it populated.

## Deliberately not built yet

- **A "skip" control.** A shared station doesn't really have a "next" in
  the way an on-demand playlist does — skipping would mean diverging from
  the synced position. Left out for now rather than half-solved.
- **Periodic resync while idle.** If a listener leaves the tab open past
  a track boundary, the next `ended`/`FINISH` event recomputes and
  resyncs automatically — but there's no separate timer forcing a
  resync mid-track. Only matters for very long-lived tabs.
- **Real audio-reactive VU meter.** The hero animation is still the
  original decorative `Math.sin()` loop, not driven by actual playback.
  Wiring it to a Web Audio `AnalyserNode` is a nice later upgrade, and
  would need CORS headers enabled on daqhris.com's audio files.
- **Automatic duration probing.** `generate_feed.py` reads whatever's in
  `queue.json`; it doesn't try to measure files itself. Could be added
  with `ffprobe` or `mutagen` if useful later.
