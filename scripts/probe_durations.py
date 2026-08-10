#!/usr/bin/env python3
"""
Probes real durations for self-hosted ("type": "file") tracks in
data/station/queue.json using ffprobe, and updates the file in place —
setting durationSec to the measured value and durationIsEstimate to
false.

Why only "file" tracks: SoundCloud's oEmbed endpoint (the only
unauthenticated way to query track info) doesn't return a duration field
— confirmed against SoundCloud's own oEmbed docs, which show the full
response shape (title, description, html, provider info — no duration).
Getting real SoundCloud durations without the authenticated REST API
still means checking the track's SoundCloud page manually (shown under
the waveform) and editing queue.json by hand. The station player itself
also self-corrects for this at runtime — see the getDuration() call in
station.js's attemptScStart(), which clamps the seek target against the
widget's actual reported duration once the track has loaded, rather than
trusting queue.json's value for that specific seek.

Requires ffprobe (part of ffmpeg) on PATH.

Usage:
    python3 scripts/probe_durations.py           # probe + write changes
    python3 scripts/probe_durations.py --dry-run # report only, don't write
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE_PATH = os.path.join(ROOT, "data", "station", "queue.json")


def check_ffprobe():
    try:
        subprocess.run(
            ["ffprobe", "-version"],
            capture_output=True, check=True, timeout=10,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def probe_duration_seconds(url, timeout=60):
    """
    Returns an int number of seconds, or None if the probe failed.

    Downloads to a temp file first rather than pointing ffprobe at the URL
    directly — confirmed by testing that ffprobe falls back to an
    unreliable bitrate-based duration estimate for Ogg files read over
    HTTP (it can end up off by 5-6x on a real file), because getting an
    Ogg file's real duration requires seeking to its last page, which
    doesn't reliably happen when ffprobe reads a live HTTP stream. A local
    file gives ffprobe full random access, so this is accurate regardless
    of container format.
    """
    suffix = os.path.splitext(url.split("?")[0])[1] or ".audio"
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp_path = tmp.name
        try:
            urllib.request.urlretrieve(url, tmp_path)
        except Exception as err:
            print(f"  ! could not download {url}: {err}", file=sys.stderr)
            return None

        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "csv=p=0",
                tmp_path,
            ],
            capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        print(f"  ! timed out probing {url}", file=sys.stderr)
        return None
    finally:
        if "tmp_path" in dir() and os.path.exists(tmp_path):
            os.remove(tmp_path)

    if result.returncode != 0 or not result.stdout.strip():
        stderr = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "unknown error"
        print(f"  ! ffprobe failed for {url}: {stderr}", file=sys.stderr)
        return None
    try:
        return round(float(result.stdout.strip()))
    except ValueError:
        print(f"  ! could not parse ffprobe output for {url}: {result.stdout!r}", file=sys.stderr)
        return None


def main():
    dry_run = "--dry-run" in sys.argv

    if not check_ffprobe():
        print(
            "ffprobe not found on PATH. Install ffmpeg (which includes ffprobe):\n"
            "  macOS:   brew install ffmpeg\n"
            "  Ubuntu:  sudo apt install ffmpeg\n"
            "  Windows: https://ffmpeg.org/download.html\n"
            "Nothing was changed.",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(QUEUE_PATH) as f:
        data = json.load(f)

    tracks = data.get("tracks", [])
    file_tracks = [t for t in tracks if t.get("type") == "file"]
    sc_tracks = [t for t in tracks if t.get("type") == "soundcloud"]

    if sc_tracks:
        print(
            f"Skipping {len(sc_tracks)} SoundCloud track(s) — no scriptable way to "
            f"get real durations for those (see this script's docstring). "
            f"station.js already self-corrects the seek target for these at "
            f"runtime via the widget's own getDuration()."
        )

    changed = 0
    for t in file_tracks:
        print(f"Probing {t['id']} ({t['src']}) ...")
        measured = probe_duration_seconds(t["src"])
        if measured is None:
            print(f"  skipped (probe failed) — durationSec left as-is: {t.get('durationSec')}")
            continue
        old = t.get("durationSec")
        was_estimate = t.get("durationIsEstimate")
        if old == measured and not was_estimate:
            print(f"  {measured}s — already accurate, no change")
            continue
        print(f"  {old}s ({'estimate' if was_estimate else 'measured'}) -> {measured}s (measured)")
        if not dry_run:
            t["durationSec"] = measured
            t["durationIsEstimate"] = False
        changed += 1

    if dry_run:
        print(f"\nDry run: {changed} track(s) would be updated. No file written.")
        return

    if changed:
        with open(QUEUE_PATH, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"\nUpdated {changed} track(s) in {QUEUE_PATH}.")
        print("Consider re-running scripts/generate_feed.py too — durations feed into <itunes:duration>.")
    else:
        print("\nNo changes needed.")


if __name__ == "__main__":
    main()
