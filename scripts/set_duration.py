#!/usr/bin/env python3
"""
Safely updates one track's durationSec in data/station/queue.json from a
mm:ss (or h:mm:ss) value you read off SoundCloud's own page — for tracks
where scripts/probe_durations.py can't help (SoundCloud doesn't expose
duration anywhere a script can read it; see docs/station-notes.md).

Usage:
    python3 scripts/set_duration.py <track-id> <mm:ss or h:mm:ss>
    python3 scripts/set_duration.py --list          # show every track and its current value
    python3 scripts/set_duration.py ep-02 10:06

Sets durationIsEstimate to false for the track you update. Validates the
track id exists and the time format parses before writing anything, so a
typo reports an error instead of corrupting the file.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE_PATH = os.path.join(ROOT, "data", "station", "queue.json")


def parse_timecode(s):
    """'10:06' -> 606, '1:02:03' -> 3723. Raises ValueError on anything else."""
    parts = s.strip().split(":")
    if not (1 <= len(parts) <= 3) or not all(p.isdigit() for p in parts):
        raise ValueError(f"'{s}' isn't a valid m:ss / h:mm:ss timecode")
    parts = [int(p) for p in parts]
    while len(parts) < 3:
        parts.insert(0, 0)
    h, m, sec = parts
    if m >= 60 or sec >= 60:
        raise ValueError(f"'{s}': minutes/seconds must be under 60")
    return h * 3600 + m * 60 + sec


def main():
    with open(QUEUE_PATH) as f:
        data = json.load(f)
    tracks = data.get("tracks", [])
    by_id = {t["id"]: t for t in tracks}

    if len(sys.argv) == 2 and sys.argv[1] == "--list":
        for t in tracks:
            flag = " (estimate)" if t.get("durationIsEstimate") else ""
            print(f"{t['id']:18s} {t.get('durationSec', '?'):>5}s{flag}  {t['title']}")
        return

    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    track_id, timecode = sys.argv[1], sys.argv[2]

    if track_id not in by_id:
        print(f"No track with id '{track_id}'. Known ids:", file=sys.stderr)
        for t in tracks:
            print(" ", t["id"], "-", t["title"], file=sys.stderr)
        sys.exit(1)

    try:
        seconds = parse_timecode(timecode)
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        sys.exit(1)

    track = by_id[track_id]
    old = track.get("durationSec")
    track["durationSec"] = seconds
    track["durationIsEstimate"] = False

    with open(QUEUE_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"{track_id}: {old}s -> {seconds}s ({timecode}). durationIsEstimate set to false.")

    remaining = [t["id"] for t in tracks if t.get("durationIsEstimate")]
    if remaining:
        print(f"Still estimated: {', '.join(remaining)}")
    else:
        print("All tracks now have real durations.")


if __name__ == "__main__":
    main()
