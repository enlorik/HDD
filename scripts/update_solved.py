#!/usr/bin/env python3
"""
Update solved Timus problems for a user and display progress by tag.

Fetches the list of accepted submissions from a user's Timus profile page,
merges the result into data/solved_problems.json keyed by judge ID, then
prints a summary of solved vs total problems for each tag.

Run this script from the repository root:
    python scripts/update_solved.py <judge_id>

Example:
    python scripts/update_solved.py 12345
"""

import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

TIMUS_BASE_URL = "https://acm.timus.ru"
REQUEST_TIMEOUT = 30
USER_AGENT = "Mozilla/5.0 (compatible; HDD-Timus-Scraper/1.0)"

PROBLEMS_PATH = Path(__file__).parent.parent / "data" / "problems.json"
SOLVED_PATH = Path(__file__).parent.parent / "data" / "solved_problems.json"


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


def fetch_solved_ids(judge_id: str) -> set[int]:
    """Fetch the set of problem IDs solved by the given Timus judge ID."""
    url = f"{TIMUS_BASE_URL}/author.aspx?id={judge_id}&space=1&action=getstat"
    print(f"[INFO] Fetching solved problems for judge ID {judge_id} from {url}")
    html = fetch_html(url)
    matches = re.findall(r"problem\.aspx\?space=1&num=(\d+)", html)
    solved = {int(m) for m in matches}
    print(f"[INFO] Found {len(solved)} solved problems.")
    return solved


def load_problems() -> dict:
    if not PROBLEMS_PATH.exists():
        print(
            f"[ERROR] {PROBLEMS_PATH} not found. Run 'python scripts/fetch_problems.py' first.",
            file=sys.stderr,
        )
        sys.exit(1)
    return json.loads(PROBLEMS_PATH.read_text(encoding="utf-8"))


def load_solved() -> dict:
    if SOLVED_PATH.exists():
        return json.loads(SOLVED_PATH.read_text(encoding="utf-8"))
    return {}


def save_solved(data: dict) -> None:
    SOLVED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SOLVED_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def print_progress(problems_data: dict, solved_ids: set[int]) -> None:
    """Print a summary table of solved / total problems per tag."""
    tags: list[str] = problems_data.get("tags", [])
    problems: list[dict] = problems_data.get("problems", [])

    # Build a mapping from tag -> set of problem IDs
    tag_total: dict[str, int] = {t: 0 for t in tags}
    tag_solved: dict[str, int] = {t: 0 for t in tags}

    for prob in problems:
        for tag in prob.get("tags", []):
            if tag in tag_total:
                tag_total[tag] += 1
                if prob["id"] in solved_ids:
                    tag_solved[tag] += 1

    col_width = max((len(t) for t in tags), default=30) + 2
    header = f"{'Tag':<{col_width}} Solved / Total"
    print()
    print(header)
    print("-" * len(header))
    for tag in tags:
        total = tag_total[tag]
        solved = tag_solved[tag]
        print(f"{tag:<{col_width}} {solved:>6} / {total}")
    print()


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/update_solved.py <judge_id>", file=sys.stderr)
        return 1

    judge_id = sys.argv[1].strip()
    if not judge_id.isdigit():
        print(f"[ERROR] judge_id must be numeric, got: {judge_id!r}", file=sys.stderr)
        return 1

    problems_data = load_problems()
    solved_ids = fetch_solved_ids(judge_id)

    # Update solved_problems.json
    solved_data = load_solved()
    solved_data[judge_id] = sorted(solved_ids)
    save_solved(solved_data)
    print(f"[INFO] Updated {SOLVED_PATH} for judge ID {judge_id}.")

    # Print progress summary
    print_progress(problems_data, solved_ids)
    return 0


if __name__ == "__main__":
    sys.exit(main())
