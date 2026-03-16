#!/usr/bin/env python3
"""
Scraper for Timus Online Judge problems.

Fetches the full problem list from https://acm.timus.ru/problemset.aspx in a
single HTTP request, extracts problem metadata (ID, title, difficulty, solved
count, volume/category), and writes the result to public/timus-problems.json.

Run this script from the repository root:
    python scripts/fetch_timus_problems.py
"""

import gzip
import json
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

TIMUS_PROBLEMSET_URL = "https://acm.timus.ru/problemset.aspx?space=1&page=all&locale=en"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "timus-problems.json"
REQUEST_TIMEOUT = 30
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

VOLUME_SIZE = 100  # Timus volumes group problems in sets of 100 (1001-1100, …)
DEFAULT_DIFFICULTY_RATING = 2.0  # Fallback when difficulty cannot be determined


def problem_volume(problem_id: int) -> str:
    """Return the volume name for a given Timus problem ID."""
    volume_num = max(1, (problem_id - 1001) // VOLUME_SIZE + 1)
    return f"Volume {volume_num}"


def _bucket_difficulty(raw: float) -> int:
    """Map Timus 1-10 difficulty scale to 4-level UI buckets."""
    if raw <= 3:
        return 1  # Easy
    if raw <= 5:
        return 2  # Medium
    if raw <= 7:
        return 3  # Hard
    return 4  # Expert


def _clean_numeric_text(text: str) -> str:
    """Strip whitespace, commas, and non-breaking spaces from a numeric string."""
    return text.replace(",", "").replace("\xa0", "").replace(" ", "")


class TimusProblemParser(HTMLParser):
    """Parse the Timus problemset HTML page and extract problem rows.

    Looks for ``<tr class="problem ...">`` rows which is the standard
    Timus table structure.  Each row has columns:
      1 – problem number (also parsed from the href link)
      2 – problem title
      3 – time limit
      4 – memory limit
      5 – accepted/solved count
      6 – difficulty rating (1-10 Timus scale)
    """

    def __init__(self):
        super().__init__()
        self.problems: list[dict] = []
        self._in_prob_row = False
        self._current = {}
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

        # Grab the problem-detail href to extract the numeric ID
        if self._in_prob_row and tag == "a" and "href" in attrs_dict:
            href = attrs_dict["href"]
            m = re.search(r"num=(\d+)", href)
            if m:
                self._current["id"] = int(m.group(1))

    def handle_endtag(self, tag):
        if not self._in_prob_row:
            return

        if tag == "td" and self._capture:
            text = self._buffer.strip()
            self._capture = False
            self._buffer = ""
            self._col_index += 1

            # Column indices after increment (1-based):
            # 1: problem number (also parsed from link href)
            # 2: problem title
            # 3: time limit
            # 4: memory limit
            # 5: accepted count (solutions AC'd)
            # 6: difficulty rating (1-10 scale on Timus)
            if self._col_index == 2:
                self._current.setdefault("title", text)
            elif self._col_index == 5:
                try:
                    self._current["solved"] = int(_clean_numeric_text(text))
                except ValueError:
                    self._current["solved"] = 0
            elif self._col_index == 6:
                try:
                    raw = float(text)
                    self._current["difficulty"] = _bucket_difficulty(raw)
                except ValueError:
                    self._current["difficulty"] = 1

        if tag == "tr" and self._in_prob_row:
            self._in_prob_row = False
            prob = self._current
            if prob.get("id") and prob.get("title"):
                pid = prob["id"]
                self.problems.append({
                    "id": pid,
                    "title": prob.get("title", ""),
                    "difficulty": prob.get("difficulty", 1),
                    "solved": prob.get("solved", 0),
                    "category": problem_volume(pid),
                    "tags": [],
                })

    def handle_data(self, data):
        if self._capture:
            self._buffer += data


class TimusFallbackParser(HTMLParser):
    """Fallback parser that finds problem links in any ``<tr>`` element.

    Used when the primary ``TimusProblemParser`` returns zero results, which
    can happen if Timus alters their CSS class names.  This parser scans
    every table row for an anchor pointing to ``problem.aspx?…num=N`` and
    then reads the surrounding ``<td>`` cells to extract the title and any
    numeric fields that look like difficulty or solved-count values.
    """

    def __init__(self):
        super().__init__()
        self.problems: list[dict] = []
        self._in_row = False
        self._current: dict = {}
        self._col_index = 0
        self._capture = False
        self._buffer = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == "tr":
            self._in_row = True
            self._current = {}
            self._col_index = 0
            return

        if self._in_row and tag == "td":
            self._capture = True
            self._buffer = ""
            return

        if self._in_row and tag == "a" and "href" in attrs_dict:
            href = attrs_dict["href"]
            if "problem.aspx" in href:
                m = re.search(r"num=(\d+)", href)
                if m:
                    self._current["id"] = int(m.group(1))

    def handle_endtag(self, tag):
        if not self._in_row:
            return

        if tag == "td" and self._capture:
            text = self._buffer.strip()
            self._capture = False
            self._buffer = ""
            self._col_index += 1

            if self._col_index == 2 and "id" in self._current:
                self._current.setdefault("title", text)

            # Heuristic: pick up any plausible difficulty (1.0-10.0) or
            # solved count (> 100) from remaining columns.
            if text:
                try:
                    val = float(_clean_numeric_text(text))
                    if 1.0 <= val <= 10.0:
                        self._current.setdefault("difficulty_raw", val)
                    elif val > 100:
                        self._current.setdefault("solved", int(val))
                except ValueError:
                    pass

        if tag == "tr" and self._in_row:
            self._in_row = False
            prob = self._current
            if prob.get("id") and prob.get("title"):
                pid = prob["id"]
                self.problems.append({
                    "id": pid,
                    "title": prob["title"],
                    "difficulty": _bucket_difficulty(prob.get("difficulty_raw", DEFAULT_DIFFICULTY_RATING)),
                    "solved": prob.get("solved", 0),
                    "category": problem_volume(pid),
                    "tags": [],
                })

    def handle_data(self, data):
        if self._capture:
            self._buffer += data


def _detect_charset(raw_bytes: bytes, http_charset: str | None) -> str:
    """Return the best charset guess for the given raw HTML bytes.

    Priority:
    1. Charset declared in HTTP Content-Type header.
    2. Charset declared in an HTML ``<meta>`` tag (handles windows-1251).
    3. Fall back to UTF-8.
    """
    if http_charset:
        return http_charset
    # Scan the first 2 KB for a meta charset declaration
    snippet = raw_bytes[:2048].decode("ascii", errors="replace")
    m = re.search(r'charset=["\']?([\w-]+)', snippet, re.IGNORECASE)
    if m:
        return m.group(1)
    return "utf-8"


def fetch_html(url: str) -> str:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
    }
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read()
            # Handle gzip-compressed responses
            content_encoding = resp.headers.get("Content-Encoding", "")
            if content_encoding == "gzip":
                raw = gzip.decompress(raw)
            http_charset = resp.headers.get_param("charset")
            charset = _detect_charset(raw, http_charset)
            return raw.decode(charset, errors="replace")
    except URLError as exc:
        print(f"[ERROR] Failed to fetch {url}: {exc}", file=sys.stderr)
        raise


def scrape_problems() -> tuple[list[dict], list[str]]:
    print(f"[INFO] Fetching problem list from {TIMUS_PROBLEMSET_URL}")
    html = fetch_html(TIMUS_PROBLEMSET_URL)

    if len(html) < 1000:
        print(
            f"[WARN] Response suspiciously short ({len(html)} chars) — may be an error page.",
            file=sys.stderr,
        )
        print(f"[DEBUG] First 500 chars: {html[:500]!r}", file=sys.stderr)

    parser = TimusProblemParser()
    parser.feed(html)
    problems = parser.problems

    if not problems:
        print(
            "[WARN] Primary parser (tr.problem) found 0 problems — trying fallback parser.",
            file=sys.stderr,
        )
        print(
            f"[DEBUG] HTML length: {len(html)}, first 300 chars: {html[:300]!r}",
            file=sys.stderr,
        )
        fallback = TimusFallbackParser()
        fallback.feed(html)
        problems = fallback.problems
        if problems:
            print(f"[INFO] Fallback parser found {len(problems)} problems.")
        else:
            print(
                "[WARN] Fallback parser also found 0 problems — the page structure may have changed.",
                file=sys.stderr,
            )

    # Derive sorted unique categories ordered by volume number
    categories = sorted(
        set(p["category"] for p in problems),
        key=lambda v: int(v.split()[-1]) if v.split()[-1].isdigit() else 0,
    )

    print(f"[INFO] Scraped {len(problems)} problems across {len(categories)} categories.")
    return problems, categories


def write_output(problems: list[dict], categories: list[str]) -> None:
    output = {
        "lastUpdated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "categories": categories,
        "problems": problems,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[INFO] Written {len(problems)} problems to {OUTPUT_PATH}")


def main() -> int:
    start = time.monotonic()
    try:
        problems, categories = scrape_problems()
        if problems:
            write_output(problems, categories)
        else:
            print("[ERROR] No problems scraped — output not updated.", file=sys.stderr)
            return 1
    except Exception as exc:
        print(f"[ERROR] Scraping failed: {exc}", file=sys.stderr)
        return 1

    elapsed = time.monotonic() - start
    print(f"[INFO] Done in {elapsed:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
