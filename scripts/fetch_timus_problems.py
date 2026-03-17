#!/usr/bin/env python3
"""
Scraper for Timus Online Judge problems.

Strategy
--------
1. **Primary** – scrape the problemset *list* page(s) which contain every
   problem in an HTML table.  The all-at-once URL is tried first::

       https://acm.timus.ru/problemset.aspx?space=1&page=all&locale=en

   If it returns no results the scraper falls back to paginated pages
   (page=1, 2, …).  Each table row yields the problem ID, title,
   accepted-submission count ("solved") and difficulty rating.

2. **Tag enrichment** – for problems that have no tags yet, individual
   problem pages are fetched (in batches of up to 50 per run) to extract
   tags from anchor links matching ``problemset.aspx?space=1&tag=<name>``.

Caching: existing entries in ``timus-problems.json`` are preserved; fresh
scrape data takes priority for id/title/solved/difficulty, but cached tags
are kept when the fresh entry has none.

Run this script from the repository root:
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
)

TIMUS_BASE = "https://acm.timus.ru"
TIMUS_PROBLEMSET_URL = f"{TIMUS_BASE}/problemset.aspx?space=1&page=all&locale=en"
PROBLEMSET_PAGE_URL = f"{TIMUS_BASE}/problemset.aspx?space=1&page={{page}}&locale=en"
PROBLEM_URL_TEMPLATE = f"{TIMUS_BASE}/problem.aspx?space=1&num={{num}}&locale=en"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "timus-problems.json"

REQUEST_TIMEOUT = 30
REQUEST_DELAY = 1.0  # seconds between requests – be polite
MAX_RETRIES = 3
MAX_RETRY_SLEEP = 10  # cap for exponential back-off (seconds)
MAX_PAGINATED_PAGES = 20  # safety cap when falling back to paginated scraping
TAG_ENRICHMENT_BATCH_SIZE = 50  # max problems to enrich with tags per run

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

VOLUME_SIZE = 100  # Timus volumes group problems in sets of 100 (1001-1100, …)
DEFAULT_DIFFICULTY_RATING = 2.0  # Fallback when difficulty cannot be determined
DEFAULT_CATEGORY = "Uncategorized"


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

    def handle_starttag(self, tag: str, attrs: list[tuple]) -> None:
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


def fetch_html(url: str, *, retries: int = MAX_RETRIES) -> str:
    """Fetch *url* and return the decoded HTML string.

    Uses a shared cookie jar and retries with exponential back-off on
    transient errors (5xx, timeouts, connection resets).
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
                # Handle gzip-compressed responses
                if resp.headers.get("Content-Encoding", "") == "gzip":
                    raw = gzip.decompress(raw)
                http_charset = resp.headers.get_param("charset")
                charset = _detect_charset(raw, http_charset)
                return raw.decode(charset, errors="replace")
        except HTTPError as exc:
            last_exc = exc
            # Retry on server errors; give up immediately on client errors (4xx)
            if exc.code < 500:
                break
            print(
                f"[WARN] Attempt {attempt}/{retries} for {url}: HTTP {exc.code}",
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

    print(f"[ERROR] Failed to fetch {url}: {last_exc}", file=sys.stderr)
    raise last_exc or RuntimeError(f"Failed to fetch {url}")


def scrape_problems() -> list[dict]:
    """Scrape the Timus problemset page(s) and return a list of problems.

    Tries the all-at-once page first (using ``TimusProblemParser``).  If that
    returns no results, falls back to paginated pages.  The ``TimusFallbackParser``
    is used as a secondary fallback when the primary parser finds nothing on a
    given page.
    """
    # -- attempt 1: single page with all problems ----------------------
    print(f"[INFO] Fetching problem list from {TIMUS_PROBLEMSET_URL}")
    try:
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
                    "[WARN] Fallback parser also found 0 problems — falling back to pagination.",
                    file=sys.stderr,
                )

        if problems:
            print(f"[INFO] Parsed {len(problems)} problems from all-at-once page.")
            return problems

    except Exception as exc:
        print(
            f"[WARN] All-at-once page failed: {exc}; falling back to pagination.",
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

        parser = TimusProblemParser()
        parser.feed(html)
        page_problems = parser.problems

        if not page_problems:
            fallback = TimusFallbackParser()
            fallback.feed(html)
            page_problems = fallback.problems

        if not page_problems:
            print(f"[INFO] Page {page_num} returned 0 problems; stopping.")
            break

        new_on_page = 0
        for p in page_problems:
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


def write_output(problems: list[dict]) -> None:
    # Derive sorted unique categories ordered by volume number
    categories = sorted(
        set(p["category"] for p in problems),
        key=lambda v: int(v.split()[-1]) if v.split()[-1].isdigit() else 0,
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
    print(f"[INFO] Loaded {len(cached)} cached problems.")

    # ---- Step 1: scrape the problemset list page(s) ------------------
    try:
        fresh = scrape_problems()
    except Exception as exc:
        print(f"[ERROR] Scraping failed: {exc}", file=sys.stderr)
        return 1

    if not fresh and not cached:
        print("[ERROR] No problems scraped — output not updated.", file=sys.stderr)
        return 1

    # ---- Step 2: merge fresh + cached --------------------------------
    # Prefer fresh data for id/title/solved/difficulty, but keep cached
    # tags if the fresh entry has none.
    merged: dict[int, dict] = {}
    for p in fresh:
        pid = p["id"]
        old = cached.get(pid, {})
        tags = p.get("tags") or old.get("tags") or []
        merged[pid] = {
            **p,
            "tags": tags,
            # Keep the volume-based category from the fresh scrape; do not
            # override it with tags so that the existing UI filter (which
            # groups problems by volume) continues to work correctly.
            "category": p.get("category", DEFAULT_CATEGORY),
        }

    # Also keep any cached problems that weren't in the fresh scrape
    # (problems may have been de-listed temporarily).
    for pid, old in cached.items():
        if pid not in merged:
            merged[pid] = old

    # ---- Step 3 (optional): enrich tags from individual pages --------
    no_tags = [pid for pid, p in merged.items() if not p.get("tags")]
    if no_tags:
        # Limit per run to avoid hammering the server.
        batch = sorted(no_tags)[:TAG_ENRICHMENT_BATCH_SIZE]
        print(
            f"[INFO] {len(no_tags)} problems have no tags; "
            f"fetching tags for {len(batch)} of them."
        )
        for i, pid in enumerate(batch, 1):
            print(f"[INFO] [{i}/{len(batch)}] Fetching tags for problem {pid}…")
            tags = scrape_tags(pid)
            if tags:
                merged[pid]["tags"] = tags
                # Note: we intentionally keep the volume-based category and
                # do not overwrite it with tags[0].
            if i < len(batch):
                time.sleep(REQUEST_DELAY)

    # ---- Step 4: write output ----------------------------------------
    all_problems = sorted(merged.values(), key=lambda p: p["id"])

    print(
        f"[INFO] Total: {len(all_problems)} problems "
        f"({len(fresh)} from problemset page, "
        f"{len(cached)} previously cached)."
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
