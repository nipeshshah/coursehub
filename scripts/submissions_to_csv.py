#!/usr/bin/env python3
"""
submissions_to_csv.py

Turns reviewed course-submission JSON files (downloaded from the "Submit a
Course" form) into draft rows matching data/courses.csv's schema.

This does NOT touch data/courses.csv directly — it writes to
pending_courses.csv instead, because a submission only tells us about the
course as a whole (title, description, category, tags...), not the
individual videos in the playlist. You still need to open the submitted
playlist, grab each video's ID/title/duration, and fill those into the
generated row(s) before copying anything into data/courses.csv.

Usage:
    1. Drop reviewed submission .json files into the submissions/ folder
       (each one downloads from the site with a name like
       submission-some-course-2026-09-15.json).
    2. Run:  python3 scripts/submissions_to_csv.py
    3. Open pending_courses.csv, fill in one row per video (video_id,
       video_title, video_order, video_duration), then move the finished
       rows into data/courses.csv.
"""

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUBMISSIONS_DIR = ROOT / "submissions"
OUTPUT_CSV = ROOT / "pending_courses.csv"

FIELDNAMES = [
    "course_id", "course_title", "course_description", "category", "tags",
    "instructor", "level", "course_thumbnail", "video_id", "video_title",
    "video_order", "video_duration",
]


def slugify(text, max_len=24):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (slug[:max_len] or "course")


def load_submissions():
    if not SUBMISSIONS_DIR.exists():
        print(f"No submissions/ folder found at {SUBMISSIONS_DIR}")
        return []

    files = sorted(SUBMISSIONS_DIR.glob("*.json"))
    submissions = []
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"  ! Skipping {f.name}: couldn't parse JSON ({e})")
            continue

        # The "export all" button downloads a JSON array; a single
        # submission downloads a JSON object. Handle both.
        if isinstance(data, list):
            submissions.extend((f.name, item) for item in data)
        elif isinstance(data, dict):
            submissions.append((f.name, data))
        else:
            print(f"  ! Skipping {f.name}: unexpected JSON shape")
    return submissions


def submission_to_row(submission):
    course_id = slugify(submission.get("course_title", "course"))
    tags = submission.get("tags") or []
    if isinstance(tags, list):
        tags_str = ";".join(t.strip() for t in tags if t and t.strip())
    else:
        tags_str = str(tags)

    return {
        "course_id": course_id,
        "course_title": submission.get("course_title", ""),
        "course_description": submission.get("description", ""),
        "category": submission.get("category", ""),
        "tags": tags_str,
        "instructor": submission.get("instructor", ""),
        "level": submission.get("level", ""),
        "course_thumbnail": "",
        "video_id": "PASTE_VIDEO_ID_HERE",
        "video_title": "PASTE_VIDEO_TITLE_HERE",
        "video_order": 1,
        "video_duration": "",
    }


def main():
    submissions = load_submissions()
    if not submissions:
        print("Nothing to convert. Drop reviewed *.json submission files into submissions/ first.")
        return 0

    rows = []
    print(f"Found {len(submissions)} submission(s):\n")
    for filename, submission in submissions:
        title = submission.get("course_title", "(untitled)")
        url = submission.get("playlist_url", "(no url)")
        contact = submission.get("submitter_contact") or "(no contact given)"
        notes = submission.get("notes") or ""
        print(f"  - {title}")
        print(f"      from: {filename}")
        print(f"      playlist: {url}")
        print(f"      submitted by: {contact}")
        if notes:
            print(f"      notes: {notes}")
        print()
        rows.append(submission_to_row(submission))

    write_header = not OUTPUT_CSV.exists()
    with OUTPUT_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, quoting=csv.QUOTE_MINIMAL)
        if write_header:
            writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} draft row(s) to {OUTPUT_CSV.relative_to(ROOT)}")
    print("Each row is a placeholder for ONE video — duplicate the row per")
    print("video in the playlist, filling in video_id / video_title /")
    print("video_order / video_duration, before moving finished rows into")
    print("data/courses.csv.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
