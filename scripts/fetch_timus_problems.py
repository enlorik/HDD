#!/usr/bin/env python3
"""
Scraper for Timus Online Judge problems.

Iterates problem numbers 1000–2227, fetches each individual problem page,
extracts the problem ID, title, URL, and real tags (from tag anchor links on
the page), then writes the result to public/timus-problems.json.

Caching: existing entries in timus-problems.json are NOT re-fetched on each
run; only problems missing from the cache are scraped.  This keeps the daily
CI run fast once the initial population is complete.

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

PROBLEM_URL_TEMPLATE = "https://acm.timus.ru/problem.aspx?space=1&num={num}&locale=en"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "timus-problems.json"
REQUEST_TIMEOUT = 30
REQUEST_DELAY = 0.5  # seconds between requests to be polite to the server
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Range of Timus problem numbers to include (inclusive on both ends)
PROBLEM_RANGE = range(1000, 2228)


class ProblemPageParser(HTMLParser):
    """Parse a single Timus problem page to extract the title and tags.

    Tags are found on anchor elements whose href matches::

        problemset.aspx?space=1&tag=<name>

    The problem title is read from the first ``<h2 class="problem_title">``
    element (or a ``<h2>`` element containing a ``<a>`` with ``num=N`` in its
    href as a fallback), after stripping the leading "NNNN. " prefix.
    """

    def __init__(self):
        super().__init__()
        self.title: str = ""
        self.tags: list[str] = []
        self._in_title = False
        self._in_tag_link = False
        self._buffer = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        css = attrs_dict.get("class", "")

        # Detect the problem title heading: <h2 class="problem_title">
        if tag == "h2" and "problem_title" in css:
            self._in_title = True
            self._buffer = ""
            return

        # Detect tag links: <a href="problemset.aspx?space=1&tag=...">
        if tag == "a" and "href" in attrs_dict:
            href = attrs_dict["href"]
            if "problemset.aspx" in href and "tag=" in href:
                self._in_tag_link = True
                self._buffer = ""

    def handle_endtag(self, tag):
        if tag == "h2" and self._in_title:
            self._in_title = False
            raw = self._buffer.strip()
            # Strip the leading problem-number prefix "NNNN. "
            m = re.match(r"^\d+\.\s+(.+)$", raw, re.DOTALL)
            self.title = m.group(1).strip() if m else raw
            self._buffer = ""
            return

        if tag == "a" and self._in_tag_link:
            self._in_tag_link = False
            # Timus tag labels are already lowercase (e.g. "data structures",
            # "dynamic programming").  Normalising to lowercase ensures
            # consistent deduplication even if the site capitalisation changes.
            tag_text = self._buffer.strip().lower()
            if tag_text and tag_text not in self.tags:
                self.tags.append(tag_text)
            self._buffer = ""

    def handle_data(self, data):
        if self._in_title or self._in_tag_link:
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


def load_cached_problems() -> dict[int, dict]:
    """Load existing problems from the output JSON file, keyed by problem ID."""
    if not OUTPUT_PATH.exists():
        return {}
    try:
        data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        return {p["id"]: p for p in data.get("problems", []) if "id" in p}
    except Exception as exc:
        print(f"[WARN] Could not read cache from {OUTPUT_PATH}: {exc}", file=sys.stderr)
        return {}


def scrape_problem(num: int) -> dict | None:
    """Fetch and parse a single Timus problem page.

    Returns a problem dict with keys ``id``, ``title``, ``url``, ``tags``,
    and ``category`` (the first tag, or ``"Uncategorized"`` if the page has no
    tags).  Returns ``None`` if the problem does not exist or the page cannot
    be parsed.
    """
    url = PROBLEM_URL_TEMPLATE.format(num=num)
    try:
        html = fetch_html(url)
    except Exception:
        return None

    parser = ProblemPageParser()
    parser.feed(html)

    if not parser.title:
        # Problem doesn't exist or has an unexpected page structure
        return None

    return {
        "id": num,
        "title": parser.title,
        "url": url,
        "tags": parser.tags,
        # category = first real tag for UI backward-compat (filter dropdown)
        "category": parser.tags[0] if parser.tags else "Uncategorized",
    }


def write_output(problems: list[dict]) -> None:
    # Derive the categories list from the union of all tags across all problems
    categories = sorted(
        {tag for p in problems for tag in p.get("tags", [p.get("category", "")])}
    )
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

    cached = load_cached_problems()
    print(f"[INFO] Loaded {len(cached)} problems from cache.")

    to_fetch = [num for num in PROBLEM_RANGE if num not in cached]
    print(f"[INFO] Need to fetch {len(to_fetch)} missing problems.")

    if not to_fetch:
        print("[INFO] All problems are cached; nothing to fetch.")
        # Re-write the output so that the categories list stays up to date
        write_output(sorted(cached.values(), key=lambda p: p["id"]))
        elapsed = time.monotonic() - start
        print(f"[INFO] Done in {elapsed:.1f}s.")
        return 0

    new_problems: list[dict] = []
    for i, num in enumerate(to_fetch, 1):
        print(f"[INFO] [{i}/{len(to_fetch)}] Fetching problem {num}…")
        problem = scrape_problem(num)
        if problem:
            new_problems.append(problem)
        else:
            print(f"[WARN] Problem {num} not found or could not be parsed.", file=sys.stderr)
        if i < len(to_fetch):
            time.sleep(REQUEST_DELAY)

    all_problems = sorted(
        list(cached.values()) + new_problems,
        key=lambda p: p["id"],
    )

    print(
        f"[INFO] Total problems: {len(all_problems)} "
        f"({len(new_problems)} newly fetched, "
        f"{len(all_problems) - len(new_problems)} from cache)."
    )

    if all_problems:
        write_output(all_problems)
    else:
        print("[ERROR] No problems available — output not updated.", file=sys.stderr)
        return 1

    elapsed = time.monotonic() - start
    print(f"[INFO] Done in {elapsed:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
