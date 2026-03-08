#!/usr/bin/env python3
"""
Fetch Timus Online Judge problems grouped by tags.

Scrapes each tag page from acm.timus.ru and stores all problem metadata
(ID, title, tags, link) in data/problems.json.

Run this script from the repository root:
    python scripts/fetch_problems.py
"""

import json
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

TIMUS_BASE_URL = "https://acm.timus.ru"
REQUEST_TIMEOUT = 30
USER_AGENT = "Mozilla/5.0 (compatible; HDD-Timus-Scraper/1.0)"

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "problems.json"

# Tags to fetch with their display names and URL slugs
TAGS = [
    ("Data Structures Problems", "structure"),
    ("Dynamic Programming Problems", "dynprog"),
    ("Game Problems", "game"),
    ("Geometry Problems", "geometry"),
    ("Graph Theory Problems", "graphs"),
    ("Hardest Problems", "hardest"),
    ("Mathematical Problems", "math"),
    ("Number Theory Problems", "numbers"),
    ("Problems for Beginners", "beginners"),
    ("Problems on Palindromes", "palindromes"),
    ("String Algorithms Problems", "string"),
    ("Tricky Problems", "tricky"),
    ("Unusual Problems", "unusual"),
]


def tag_url(tag_slug: str) -> str:
    return f"{TIMUS_BASE_URL}/problemset.aspx?space=1&tag={tag_slug}&locale=en"


class TimusTagParser(HTMLParser):
    """Parse a Timus tag page and extract problem rows."""

    def __init__(self):
        super().__init__()
        self.problems: list[dict] = []
        self._in_prob_row = False
        self._current: dict = {}
        self._col_index = 0
        self._capture = False
        self._buffer = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        css = attrs_dict.get("class", "")

        if tag == "tr" and "problem" in css:
            self._in_prob_row = True
            self._current = {}
            self._col_index = 0
            return

        if self._in_prob_row and tag == "td":
            self._capture = True
            self._buffer = ""
            return

        if self._in_prob_row and tag == "a" and "href" in attrs_dict:
            href = attrs_dict["href"]
            if "problem.aspx" in href and "num=" in href:
                for part in href.split("&"):
                    if part.startswith("num="):
                        try:
                            self._current["id"] = int(part[4:])
                        except ValueError:
                            print(f"[WARN] Could not parse problem ID from href: {href}", file=sys.stderr)

    def handle_endtag(self, tag):
        if not self._in_prob_row:
            return

        if tag == "td" and self._capture:
            text = self._buffer.strip()
            self._capture = False
            self._buffer = ""
            self._col_index += 1

            # Column layout (0-indexed) on Timus tag pages:
            # 0: problem number
            # 1: problem title
            # 2: time limit
            # 3: memory limit
            # 4: accepted count
            # 5: difficulty rating
            if self._col_index == 2:
                self._current.setdefault("title", text)

        if tag == "tr" and self._in_prob_row:
            self._in_prob_row = False
            prob = self._current
            if prob.get("id") and prob.get("title"):
                pid = prob["id"]
                self.problems.append({
                    "id": pid,
                    "title": prob["title"],
                    "link": f"{TIMUS_BASE_URL}/problem.aspx?space=1&num={pid}",
                })

    def handle_data(self, data):
        if self._capture:
            self._buffer += data


def fetch_html(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            charset = "utf-8"
            cs = resp.headers.get_param("charset")
            if cs:
                charset = cs
            return resp.read().decode(charset, errors="replace")
    except URLError as exc:
        print(f"[ERROR] Failed to fetch {url}: {exc}", file=sys.stderr)
        raise


def fetch_tag_problems(tag_name: str, tag_slug: str) -> list[dict]:
    url = tag_url(tag_slug)
    print(f"[INFO] Fetching '{tag_name}' from {url}")
    html = fetch_html(url)
    parser = TimusTagParser()
    parser.feed(html)
    problems = parser.problems
    print(f"[INFO]   -> {len(problems)} problems found.")
    return problems


def main() -> int:
    start = time.monotonic()

    # Collect problems per tag, then merge by problem ID
    problems_by_id: dict[int, dict] = {}
    tag_names: list[str] = []

    for tag_name, tag_slug in TAGS:
        tag_names.append(tag_name)
        try:
            tag_problems = fetch_tag_problems(tag_name, tag_slug)
        except Exception as exc:
            print(f"[ERROR] Could not fetch tag '{tag_name}': {exc}", file=sys.stderr)
            continue

        for prob in tag_problems:
            pid = prob["id"]
            if pid not in problems_by_id:
                problems_by_id[pid] = {
                    "id": pid,
                    "title": prob["title"],
                    "link": prob["link"],
                    "tags": [],
                }
            if tag_name not in problems_by_id[pid]["tags"]:
                problems_by_id[pid]["tags"].append(tag_name)

        # Be polite to the server
        time.sleep(0.5)

    problems = sorted(problems_by_id.values(), key=lambda p: p["id"])

    if not problems:
        print("[ERROR] No problems scraped — output not updated.", file=sys.stderr)
        return 1

    output = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "tags": tag_names,
        "problems": problems,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    elapsed = time.monotonic() - start
    print(f"[INFO] Written {len(problems)} problems ({len(tag_names)} tags) to {OUTPUT_PATH}")
    print(f"[INFO] Done in {elapsed:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
