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

## Deliberately not built

- **A "skip" control.** This isn't a gap to fill in later — it's a
  permanent design decision. A station has one frequency; a listener
  tunes in or doesn't. There's no "next" without turning it into an
  on-demand playlist, which is a different, already-covered thing (the
  archive pages, `feed.xml`, `station.m3u`). Please don't add a skip
  button here.
- **Periodic resync while idle.** If a listener leaves the tab open past
  a track boundary, the next `ended`/`FINISH` event recomputes and
  resyncs automatically — but there's no separate timer forcing a
  resync mid-track. Only matters for very long-lived tabs.
- **Real audio-reactive VU meter.** The hero animation is still the
  original decorative `Math.sin()` loop, not driven by actual playback.
  Wiring it to a Web Audio `AnalyserNode` is a nice later upgrade, and
  would need CORS headers enabled on daqhris.com's audio files.

## Playback robustness (why the SoundCloud path looks the way it does)

The SoundCloud side of this went through two real bugs before landing
where it is now, both from the same root cause: SoundCloud's Widget API
can't be tested from a sandboxed/offline environment, so the fixes had to
be verified against the *documented* behavior plus defensive redundancy,
not against the real SDK running live. Both are worth understanding
before touching `playSoundcloud()`/`attemptScStart()` again:

**Bug 1 — playback broke after ~2 track changes.** The original code
created a fresh `SC.Widget(iframe)` wrapper on every track. Each wrapper
registers its own internal `postMessage` listener on the iframe that
`unbind()` never tears down (`unbind()` only removes the specific
callbacks *you* added). A few track changes in, multiple stale wrappers
were all reacting to the same iframe's messages at once. Fixed by
creating the widget wrapper exactly once and reusing it via `load()` for
every later track — the pattern SoundCloud's own docs use for this exact
"auto-advance a playlist" case.

**Bug 2 — the fix for bug 1 introduced a new one:** the UI would update
to show the next track "playing," but no audio played. Root cause: the
code trusted `load()`'s `options.callback` as the *only* way to know a
newly loaded track was ready to seek and play, and also never passed
`auto_play` (which `load()`'s `options` documentedly accepts) — so if
that callback didn't fire reliably, nothing ever called `.play()`, and
the track just sat loaded-but-paused. Meanwhile the "now playing" UI had
already updated optimistically the moment we *asked* the track to start,
regardless of whether it actually did.

Fixed with two changes, not one:
1. **Redundant restart paths.** `READY` is bound once, permanently, and
   its handler (`attemptScStart`) is idempotent — it reads whatever's
   currently in `state.scPendingOffsetMs` rather than a value baked in at
   bind time. If `load()`'s `callback` fires, that calls
   `attemptScStart()`. If SoundCloud's SDK re-fires `READY` on reload
   instead (plausible, unverified), the same persistent handler catches
   that too. Both paths converge on the same function, so it doesn't
   matter which one actually fires.
2. **Honest UI state.** `state.playing` (the listener has the station on)
   and `state.confirmed` (audio is *actually* audible right now, based on
   a real `PLAY`/`playing` event) are now separate. The play/pause button
   reflects the former; the live-dot dims to show "buffering" rather than
   blinking as if audio were flowing when it isn't. If nothing confirms
   within `WATCHDOG_MS` (6s), one retry, then — if that also fails —
   `advance()` moves on rather than sitting there indefinitely showing
   "playing" with no sound. This is failure recovery, not a listener-facing
   skip control (see above) — the distinction matters, don't repurpose it
   into one.

If you're changing this code again: the honest thing to do, given the
testing constraint, is keep the redundancy rather than trimming it back
down to "whichever mechanism seems to be the real one" — there's no way
to confirm which one actually fires in production SoundCloud without a
live browser test, which you should do (tune in, let it run through at
least 4-5 SoundCloud tracks) before considering this settled.

## Automatic duration probing

```
python3 scripts/probe_durations.py           # measure + write changes
python3 scripts/probe_durations.py --dry-run # report only
```

Requires `ffprobe` (part of ffmpeg) on `PATH`. For every `"type": "file"`
track, downloads it to a temp file and measures the real duration,
updating `durationSec` and clearing `durationIsEstimate` in `queue.json`.

Downloads before probing rather than pointing `ffprobe` at the URL
directly — testing turned up that `ffprobe` falls back to an unreliable
bitrate-based estimate for Ogg files read live over HTTP (off by 5-6x on
a real test file), because getting an Ogg file's real duration requires
seeking to its last page, which doesn't reliably happen against a live
HTTP stream. A local copy gives it full random access, so this is
accurate regardless of container format — at the cost of downloading
each file once per run, which is a fine trade for a handful of tracks.

**SoundCloud tracks are out of scope for this script** — SoundCloud's
oEmbed endpoint (the only unauthenticated way to query track info)
doesn't return a duration field, confirmed against their own oEmbed docs.
Confirmed again directly: fetching a track's page and checking every
metadata field (`og:`, `twitter:`, meta tags) turns up nothing — the
duration only renders once the page's JavaScript runs client-side, which
nothing outside an actual browser can see. Real SoundCloud durations
still mean checking the track's page manually and entering the value:

```
python3 scripts/set_duration.py --list          # see what's still estimated
python3 scripts/set_duration.py ep-02 10:06      # mm:ss or h:mm:ss
```

Validates the track id and timecode before writing anything, so a typo
reports an error instead of corrupting `queue.json`. This matters less
than it used to, though: `attemptScStart()` in `station.js` now calls the
widget's own `getDuration()` once a track has actually loaded, and clamps
the seek target against that real number rather than trusting
`queue.json`'s estimate for the seek itself — so a wrong SoundCloud
estimate mainly affects which track the wall-clock math picks as
"current," not whether the seek within that track lands somewhere
invalid.
