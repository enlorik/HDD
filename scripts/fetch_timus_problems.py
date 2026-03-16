#!/usr/bin/env python3
"""
Scraper for Timus Online Judge problems.

Strategy
--------
1. **Primary** – scrape the problemset *list* page(s) which contain every
   problem in an HTML table.  The all-at-once URL is tried first::

       https://acm.timus.ru/problemset.aspx?space=1&page=all&locale=en

   If it fails the scraper falls back to paginated pages (page=1, 2, …).
   Each table row yields the problem ID, title, accepted-submission count
   ("solved") and difficulty rating.

2. **Tag enrichment** – for problems that have no tags yet, individual
   problem pages are fetched (with caching) to extract tags/categories.

This approach replaces the old per-problem strategy which required 1 200+
HTTP requests and was blocked by Timus with HTTP 405 errors.

Caching: existing entries in ``timus-problems.json`` are preserved; only new
or incomplete entries are re-fetched.

Run from the repository root::

    python scripts/fetch_timus_problems.py
"""

import gzip
import http.cookiejar
import json
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import (
    HTTPCookieProcessor,
    Request,
    build_opener,
    urlopen,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TIMUS_BASE = "https://acm.timus.ru"
PROBLEMSET_ALL_URL = f"{TIMUS_BASE}/problemset.aspx?space=1&page=all&locale=en"
PROBLEMSET_PAGE_URL = (
    f"{TIMUS_BASE}/problemset.aspx?space=1&page={{page}}&locale=en"
)
PROBLEM_URL_TEMPLATE = f"{TIMUS_BASE}/problem.aspx?space=1&num={{num}}&locale=en"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "timus-problems.json"

REQUEST_TIMEOUT = 30
REQUEST_DELAY = 1.0  # seconds between requests – be polite
MAX_RETRIES = 3
MAX_RETRY_SLEEP = 10  # cap for exponential backoff
MAX_PAGINATED_PAGES = 20  # safety cap when paginating
DEFAULT_CATEGORY = "Uncategorized"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# ---------------------------------------------------------------------------
# HTML Parsers
# ---------------------------------------------------------------------------


class ProblemsetParser(HTMLParser):
    """Parse the Timus problemset list page.

    Rows containing a link to ``problem.aspx?…num=N`` are treated as problem
    entries.  For each such row the parser records problem number (from the
    link), title (link text) and up to two trailing numeric cell values which
    map to *solved* (accepted submissions) and *difficulty*.
    """

    def __init__(self) -> None:
        super().__init__()
        self.problems: list[dict] = []

        # Per-row state
        self._cells: list[str] = []
        self._cell_text = ""
        self._link_href = ""
        self._link_text = ""
        self._in_td = False
        self._in_a = False
        self._problem_link_href = ""

    # -- starttag / endtag / data ------------------------------------

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self._cells = []
            self._problem_link_href = ""
            self._link_text = ""
            return

        if tag == "td":
            self._in_td = True
            self._cell_text = ""
            return

        if tag == "a" and self._in_td:
            href = dict(attrs).get("href", "") or ""
            if "problem.aspx" in href and "num=" in href:
                self._in_a = True
                self._link_href = href
                self._link_text = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._in_a:
            self._in_a = False
            if not self._problem_link_href:
                self._problem_link_href = self._link_href
            return

        if tag == "td" and self._in_td:
            self._in_td = False
            self._cells.append(self._cell_text.strip())
            return

        if tag == "tr":
            self._finish_row()

    def handle_data(self, data: str) -> None:
        if self._in_a:
            self._link_text += data
        if self._in_td:
            self._cell_text += data

    # -- row finalisation --------------------------------------------

    def _finish_row(self) -> None:
        href = self._problem_link_href
        if not href:
            return

        m = re.search(r"num=(\d+)", href)
        if not m:
            return

        num = int(m.group(1))
        title = self._link_text.strip()
        if not title:
            return

        # Collect purely-numeric cell values (ignoring the ID cell itself).
        nums: list[int] = []
        for cell in self._cells:
            cleaned = cell.replace(",", "").replace("\xa0", "").strip()
            if cleaned.isdigit():
                val = int(cleaned)
                if val != num:
                    nums.append(val)

        # The last two numeric values in a Timus problemset row are
        # conventionally "Accepted" (solved count) and "Difficulty".
        solved = 0
        difficulty = 0
        if len(nums) >= 2:
            solved = nums[-2]
            difficulty = nums[-1]
        elif len(nums) == 1:
            solved = nums[0]

        self.problems.append(
            {
                "id": num,
                "title": title,
                "url": PROBLEM_URL_TEMPLATE.format(num=num),
                "solved": solved,
                "difficulty": difficulty,
                "tags": [],
                "category": DEFAULT_CATEGORY,
            }
        )


class ProblemPageParser(HTMLParser):
    """Parse a single Timus problem page to extract tags.

    Tags are found on anchor elements whose href matches::

        problemset.aspx?space=1&tag=<name>
    """

    def __init__(self) -> None:
        super().__init__()
        self.tags: list[str] = []
        self._in_tag_link = False
        self._buffer = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            href = dict(attrs).get("href", "") or ""
            if "problemset.aspx" in href and "tag=" in href:
                self._in_tag_link = True
                self._buffer = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._in_tag_link:
            self._in_tag_link = False
            text = self._buffer.strip().lower()
            if text and text not in self.tags:
                self.tags.append(text)
            self._buffer = ""

    def handle_data(self, data: str) -> None:
        if self._in_tag_link:
            self._buffer += data


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

# Shared cookie jar so that session cookies are reused across requests.
_cookie_jar = http.cookiejar.CookieJar()
_opener = build_opener(HTTPCookieProcessor(_cookie_jar))


def _detect_charset(raw_bytes: bytes, http_charset: str | None) -> str:
    """Return the best charset for *raw_bytes*."""
    if http_charset:
        return http_charset
    snippet = raw_bytes[:2048].decode("ascii", errors="replace")
    m = re.search(r'charset=["\']?([\w-]+)', snippet, re.IGNORECASE)
    if m:
        return m.group(1)
    return "utf-8"


def fetch_html(url: str, *, retries: int = MAX_RETRIES) -> str:
    """Fetch *url* and return the decoded HTML string.

    Uses a shared cookie jar and retries with exponential back-off on
    transient errors (5xx, timeouts, connection resets).
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Referer": f"{TIMUS_BASE}/",
        "Connection": "keep-alive",
    }
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        req = Request(url, headers=headers)
        try:
            with _opener.open(req, timeout=REQUEST_TIMEOUT) as resp:
                raw = resp.read()
                if resp.headers.get("Content-Encoding", "") == "gzip":
                    raw = gzip.decompress(raw)
                charset = _detect_charset(
                    raw, resp.headers.get_param("charset")
                )
                return raw.decode(charset, errors="replace")
        except HTTPError as exc:
            last_exc = exc
            # Retry on server errors; give up on client errors (4xx)
            if exc.code < 500:
                break
            print(
                f"[WARN] Attempt {attempt}/{retries} for {url}: "
                f"HTTP {exc.code}",
                file=sys.stderr,
            )
        except (URLError, OSError) as exc:
            last_exc = exc
            print(
                f"[WARN] Attempt {attempt}/{retries} for {url}: {exc}",
                file=sys.stderr,
            )
        if attempt < retries:
            time.sleep(min(2 ** attempt, MAX_RETRY_SLEEP))

    raise last_exc or RuntimeError(f"Failed to fetch {url}")


# ---------------------------------------------------------------------------
# Scraping functions
# ---------------------------------------------------------------------------


def scrape_problemset() -> list[dict]:
    """Scrape the Timus problemset page(s) and return a list of problems.

    Tries the all-at-once page first, then falls back to paginated pages.
    """

    # -- attempt 1: single page with all problems ----------------------
    try:
        print(f"[INFO] Fetching problemset (all-at-once): {PROBLEMSET_ALL_URL}")
        html = fetch_html(PROBLEMSET_ALL_URL)
        parser = ProblemsetParser()
        parser.feed(html)
        if parser.problems:
            print(
                f"[INFO] Parsed {len(parser.problems)} problems from "
                f"all-at-once page."
            )
            return parser.problems
        print("[WARN] All-at-once page returned no problems.", file=sys.stderr)
    except Exception as exc:
        print(
            f"[WARN] All-at-once page failed: {exc}; "
            f"falling back to pagination.",
            file=sys.stderr,
        )

    # -- attempt 2: paginated pages ------------------------------------
    all_problems: list[dict] = []
    seen_ids: set[int] = set()

    for page_num in range(1, MAX_PAGINATED_PAGES + 1):
        url = PROBLEMSET_PAGE_URL.format(page=page_num)
        print(f"[INFO] Fetching problemset page {page_num}: {url}")
        try:
            html = fetch_html(url)
        except Exception as exc:
            print(f"[WARN] Page {page_num} failed: {exc}", file=sys.stderr)
            break

        parser = ProblemsetParser()
        parser.feed(html)

        if not parser.problems:
            # No more problems – we've gone past the last page.
            print(f"[INFO] Page {page_num} returned 0 problems; stopping.")
            break

        new_on_page = 0
        for p in parser.problems:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                all_problems.append(p)
                new_on_page += 1

        print(f"[INFO] Page {page_num}: {new_on_page} new problems.")
        if page_num < MAX_PAGINATED_PAGES:
            time.sleep(REQUEST_DELAY)

    print(f"[INFO] Total from paginated pages: {len(all_problems)} problems.")
    return all_problems


def scrape_tags(num: int) -> list[str]:
    """Fetch tags for problem *num* from its individual page.

    Uses a single retry attempt (rather than MAX_RETRIES) because tags are
    fetched in bulk and failures are non-critical — missing tags will be
    retried on the next CI run.
    """
    url = PROBLEM_URL_TEMPLATE.format(num=num)
    try:
        html = fetch_html(url, retries=1)
    except Exception:
        return []

    parser = ProblemPageParser()
    parser.feed(html)
    return parser.tags


# ---------------------------------------------------------------------------
# Cache & output
# ---------------------------------------------------------------------------


def load_cached_problems() -> dict[int, dict]:
    """Load existing problems from the output JSON file, keyed by ID."""
    if not OUTPUT_PATH.exists():
        return {}
    try:
        data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        return {p["id"]: p for p in data.get("problems", []) if "id" in p}
    except Exception as exc:
        print(
            f"[WARN] Could not read cache from {OUTPUT_PATH}: {exc}",
            file=sys.stderr,
        )
        return {}


def write_output(problems: list[dict]) -> None:
    categories = sorted(
        {
            tag
            for p in problems
            for tag in (p.get("tags") or [p.get("category", "")])
            if tag and tag != DEFAULT_CATEGORY
        }
    )
    output = {
        "lastUpdated": datetime.now(timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "categories": categories,
        "problems": problems,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[INFO] Written {len(problems)} problems to {OUTPUT_PATH}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    start = time.monotonic()

    cached = load_cached_problems()
    print(f"[INFO] Loaded {len(cached)} cached problems.")

    # ---- Step 1: scrape the problemset list page(s) ------------------
    fresh = scrape_problemset()

    # Merge: prefer fresh data for id/title/solved/difficulty, but keep
    # cached tags if the fresh entry has none.
    merged: dict[int, dict] = {}
    for p in fresh:
        pid = p["id"]
        old = cached.get(pid, {})
        tags = p.get("tags") or old.get("tags") or []
        merged[pid] = {
            **p,
            "tags": tags,
            "category": tags[0] if tags else DEFAULT_CATEGORY,
        }

    # Also keep any cached problems that weren't in the fresh scrape
    # (problems may have been de-listed temporarily).
    for pid, old in cached.items():
        if pid not in merged:
            merged[pid] = old

    # ---- Step 2 (optional): enrich tags from individual pages --------
    no_tags = [
        pid
        for pid, p in merged.items()
        if not p.get("tags")
    ]
    if no_tags:
        # Limit per run to avoid hammering the server.
        batch = sorted(no_tags)[:50]
        print(
            f"[INFO] {len(no_tags)} problems have no tags; "
            f"fetching tags for {len(batch)} of them."
        )
        for i, pid in enumerate(batch, 1):
            print(f"[INFO] [{i}/{len(batch)}] Fetching tags for problem {pid}…")
            tags = scrape_tags(pid)
            if tags:
                merged[pid]["tags"] = tags
                merged[pid]["category"] = tags[0]
            if i < len(batch):
                time.sleep(REQUEST_DELAY)

    # ---- Step 3: write output ----------------------------------------
    all_problems = sorted(merged.values(), key=lambda p: p["id"])

    print(
        f"[INFO] Total: {len(all_problems)} problems "
        f"({len(fresh)} from problemset page, "
        f"{len(cached)} previously cached)."
    )

    if all_problems:
        write_output(all_problems)
    else:
        print(
            "[ERROR] No problems available — output not updated.",
            file=sys.stderr,
        )
        return 1

    elapsed = time.monotonic() - start
    print(f"[INFO] Done in {elapsed:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
