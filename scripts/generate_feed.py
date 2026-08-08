#!/usr/bin/env python3
"""
Regenerates /feed.xml (podcast RSS) and /station.m3u from
data/station/queue.json — run this locally after adding self-hosted
audio to the queue. Only entries with "type": "file" go into either
output; SoundCloud-only tracks have no redistributable direct URL, so
they can't be enclosed in a podcast feed or listed in an M3U (see
docs/station-notes.md for why).

Usage:
    python3 scripts/generate_feed.py

Requires only the standard library. Attempts an HTTP HEAD request per
track to fill in the RSS <enclosure length> (bytes) — run this from a
machine that can actually reach the audio host (daqhris.com), not from
an offline/sandboxed environment.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE_PATH = os.path.join(ROOT, "data", "station", "queue.json")
FEED_PATH = os.path.join(ROOT, "feed.xml")
M3U_PATH = os.path.join(ROOT, "station.m3u")

SITE_URL = "https://daqhris.com/radio-hectolitre/"
SITE_TITLE = "Radio Hectolitre"
SITE_DESCRIPTION = (
    "Artists-run broadcasting at Hectolitre, Brussels — self-hosted recordings "
    "and guest works, as they're published. SoundCloud-only episodes aren't "
    "included here yet; see https://soundcloud.com/user-816404246 for those."
)
FEED_IMAGE = "https://daqhris.com/god-bless-usa/og-image.png"


def content_length(url):
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.headers.get("Content-Length", "0")
    except Exception as err:
        print(f"  ! could not HEAD {url}: {err}", file=sys.stderr)
        return "0"


def mime_for(url):
    ext = url.rsplit(".", 1)[-1].lower()
    return {
        "ogg": "audio/ogg",
        "opus": "audio/opus",
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "wav": "audio/wav",
    }.get(ext, "application/octet-stream")


def fmt_duration(seconds):
    seconds = int(seconds or 0)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def pub_date_for(track):
    raw = track.get("publishedAt")
    if not raw:
        print(f"  ! {track['id']} has no publishedAt — using today's date. "
              f"Add a fixed publishedAt in queue.json so re-running this script "
              f"doesn't make podcast apps think it's a new episode each time.",
              file=sys.stderr)
        dt = datetime.now(timezone.utc)
    else:
        dt = datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
    return format_datetime(dt, usegmt=True)


def build_feed(file_tracks):
    items = []
    for t in file_tracks:
        length = content_length(t["src"])
        title = escape(t["title"])
        link = f"{SITE_URL}{t.get('href', '')}"
        desc = escape(t.get("sub", ""))
        items.append(f"""  <item>
    <title>{title}</title>
    <link>{escape(link)}</link>
    <guid isPermaLink="false">radio-hectolitre-{escape(t['id'])}</guid>
    <pubDate>{pub_date_for(t)}</pubDate>
    <description>{desc}</description>
    <enclosure url="{escape(t['src'])}" type="{mime_for(t['src'])}" length="{length}"/>
    <itunes:duration>{fmt_duration(t.get('durationSec'))}</itunes:duration>
  </item>""")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>{escape(SITE_TITLE)}</title>
  <link>{escape(SITE_URL)}</link>
  <atom:link href="{escape(SITE_URL)}feed.xml" rel="self" type="application/rss+xml"/>
  <description>{escape(SITE_DESCRIPTION)}</description>
  <language>en</language>
  <itunes:author>{escape(SITE_TITLE)}</itunes:author>
  <itunes:explicit>false</itunes:explicit>
  <itunes:category text="Arts"/>
  <itunes:image href="{escape(FEED_IMAGE)}"/>
{chr(10).join(items)}
</channel>
</rss>
"""


def build_m3u(file_tracks):
    lines = ["#EXTM3U"]
    for t in file_tracks:
        lines.append(f"#EXTINF:{int(t.get('durationSec') or 0)},{t['title']}")
        lines.append(t["src"])
    return "\n".join(lines) + "\n"


def main():
    with open(QUEUE_PATH) as f:
        data = json.load(f)

    all_tracks = data.get("tracks", [])
    file_tracks = [t for t in all_tracks if t.get("type") == "file"]

    skipped = len(all_tracks) - len(file_tracks)
    if skipped:
        print(f"Skipping {skipped} SoundCloud-only track(s) — no redistributable URL to enclose.")

    estimates = [t["id"] for t in file_tracks if t.get("durationIsEstimate")]
    if estimates:
        print(f"Note: duration is an ESTIMATE for: {', '.join(estimates)} — consider correcting in queue.json.")

    with open(FEED_PATH, "w") as f:
        f.write(build_feed(file_tracks))
    print(f"Wrote {FEED_PATH} ({len(file_tracks)} item(s))")

    with open(M3U_PATH, "w") as f:
        f.write(build_m3u(file_tracks))
    print(f"Wrote {M3U_PATH} ({len(file_tracks)} entr{'y' if len(file_tracks) == 1 else 'ies'})")


if __name__ == "__main__":
    main()
