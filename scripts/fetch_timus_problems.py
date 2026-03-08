#!/usr/bin/env python3
"""
Scraper for Timus Online Judge problems.

Fetches the full problem list from https://acm.timus.ru/problemset.aspx,
extracts problem metadata (ID, title, difficulty, solved count, volume/category),
and writes the result to public/timus-problems.json.

When run without --no-statements (the default), each problem's individual page is
also fetched to extract the full plain-text problem statement, which is stored
under the "statement" key in each problem object.  This allows the front-end to
render problem statements inline without redirecting to the Timus website.

Run this script from the repository root:
    python scripts/fetch_timus_problems.py           # full run with statements
    python scripts/fetch_timus_problems.py --no-statements   # metadata only (faster)
"""

import argparse
import html as html_module
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
TIMUS_PROBLEM_URL = "https://acm.timus.ru/problem.aspx?space=1&num={num}&locale=en"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "timus-problems.json"
REQUEST_TIMEOUT = 30
STATEMENT_REQUEST_TIMEOUT = 10
STATEMENT_RATE_LIMIT = 0.4  # seconds between individual problem fetches
USER_AGENT = "Mozilla/5.0 (compatible; HDD-Timus-Scraper/1.0)"

VOLUME_SIZE = 100  # Timus volumes group problems in sets of 100 (1001-1100, 1101-1200, …)


def problem_volume(problem_id: int) -> str:
    """Return the volume name for a given Timus problem ID."""
    volume_num = (problem_id - 1001) // VOLUME_SIZE + 1
    return f"Volume {volume_num}"


class TimusProblemParser(HTMLParser):
    """Parse the Timus problemset HTML page and extract problem rows."""

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

            # Column layout (0-indexed) observed on Timus problemset page:
            # 0: problem number (also parsed from link href)
            # 1: problem title
            # 2: time limit
            # 3: memory limit
            # 4: accepted count (solutions AC'd)
            # 5: difficulty rating (1-10 scale on Timus)
            if self._col_index == 2:
                self._current.setdefault("title", text)
            elif self._col_index == 5:
                try:
                    self._current["solved"] = int(text.replace(",", "").replace(" ", ""))
                except ValueError:
                    self._current["solved"] = 0
            elif self._col_index == 6:
                try:
                    raw = float(text)
                    # Timus difficulty is 1-10; we bucket it into 4 levels for the UI
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
                    "link": f"https://acm.timus.ru/problem.aspx?space=1&num={pid}",
                })

    def handle_data(self, data):
        if self._capture:
            self._buffer += data


def _bucket_difficulty(raw: float) -> int:
    """Map Timus 1-10 difficulty scale to 4-level UI buckets."""
    if raw <= 3:
        return 1  # Easy
    if raw <= 5:
        return 2  # Medium
    if raw <= 7:
        return 3  # Hard
    return 4  # Expert


class TimusProblemStatementParser(HTMLParser):
    """
    Parse a single Timus problem page and extract the problem statement as plain text.

    The statement lives inside the first ``<div class="problem_text">`` element on
    the page.  All HTML tags within that block are stripped; only visible text
    content is collected.  Consecutive whitespace is collapsed to produce a clean,
    readable plain-text result.
    """

    # Tags whose closing tag signals the end of a logical block (used for spacing)
    _BLOCK_TAGS = {
        "p", "div", "br", "h1", "h2", "h3", "h4",
        "li", "tr", "ul", "ol", "table", "pre", "blockquote", "hr", "dd",
    }

    def __init__(self):
        super().__init__()
        self._in_statement = False
        self._depth = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        if not self._in_statement:
            attrs_dict = dict(attrs)
            css = attrs_dict.get("class", "")
            if tag == "div" and "problem_text" in css:
                self._in_statement = True
                self._depth = 1
        else:
            if tag == "div":
                self._depth += 1
            if tag in self._BLOCK_TAGS:
                self._parts.append("\n")

    def handle_endtag(self, tag: str):
        if not self._in_statement:
            return
        if tag in self._BLOCK_TAGS:
            self._parts.append("\n")
        if tag == "div":
            self._depth -= 1
            if self._depth <= 0:
                self._in_statement = False

    def handle_data(self, data: str):
        if self._in_statement:
            self._parts.append(data)

    def handle_entityref(self, name: str):
        if self._in_statement:
            self._parts.append(html_module.unescape(f"&{name};"))

    def handle_charref(self, name: str):
        if self._in_statement:
            self._parts.append(html_module.unescape(f"&#{name};"))

    def get_statement(self) -> str:
        """Return the extracted statement as cleaned plain text."""
        raw = "".join(self._parts)
        # Collapse runs of whitespace (keep at most two consecutive newlines)
        lines = [line.strip() for line in raw.splitlines()]
        # Remove empty lines at the start/end; collapse multiple blank lines to one
        result_lines: list[str] = []
        blank_run = 0
        for line in lines:
            if line:
                blank_run = 0
                result_lines.append(line)
            else:
                blank_run += 1
                if blank_run <= 1 and result_lines:
                    result_lines.append("")
        return "\n".join(result_lines).strip()


def fetch_html(url: str, timeout: int = REQUEST_TIMEOUT) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=timeout) as resp:
            charset = "utf-8"
            ct = resp.headers.get_content_type()
            if ct:
                cs = resp.headers.get_param("charset")
                if cs:
                    charset = cs
            return resp.read().decode(charset, errors="replace")
    except URLError as exc:
        print(f"[ERROR] Failed to fetch {url}: {exc}", file=sys.stderr)
        raise


def fetch_problem_statement(problem_id: int) -> str:
    """
    Fetch and return the plain-text problem statement for a single Timus problem.

    Returns an empty string if the page cannot be fetched or the statement
    cannot be located, so the caller can degrade gracefully.
    """
    url = TIMUS_PROBLEM_URL.format(num=problem_id)
    try:
        html = fetch_html(url, timeout=STATEMENT_REQUEST_TIMEOUT)
        parser = TimusProblemStatementParser()
        parser.feed(html)
        return parser.get_statement()
    except Exception as exc:
        print(f"[WARN] Could not fetch statement for problem {problem_id}: {exc}", file=sys.stderr)
        return ""


def scrape_problems(with_statements: bool = True) -> tuple[list[dict], list[str]]:
    print(f"[INFO] Fetching problem list from {TIMUS_PROBLEMSET_URL}")
    html = fetch_html(TIMUS_PROBLEMSET_URL)

    parser = TimusProblemParser()
    parser.feed(html)
    problems = parser.problems

    if not problems:
        print("[WARN] No problems parsed — the page structure may have changed.", file=sys.stderr)

    # Derive sorted unique categories
    categories = sorted(
        set(p["category"] for p in problems),
        key=lambda v: int(v.split()[-1]) if v.split()[-1].isdigit() else 0,
    )

    print(f"[INFO] Scraped {len(problems)} problems across {len(categories)} categories.")

    if with_statements:
        print(f"[INFO] Fetching problem statements (this may take a while)…")
        for i, problem in enumerate(problems):
            if i > 0:
                time.sleep(STATEMENT_RATE_LIMIT)
            statement = fetch_problem_statement(problem["id"])
            problem["statement"] = statement
            if (i + 1) % 20 == 0 or (i + 1) == len(problems):
                print(f"[INFO] Fetched statements for {i + 1}/{len(problems)} problems…")
    else:
        for problem in problems:
            problem["statement"] = ""

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
    parser = argparse.ArgumentParser(description="Scrape Timus Online Judge problems.")
    parser.add_argument(
        "--no-statements",
        action="store_true",
        help="Skip fetching individual problem statements (faster, metadata only).",
    )
    args = parser.parse_args()

    start = time.monotonic()
    try:
        problems, categories = scrape_problems(with_statements=not args.no_statements)
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
