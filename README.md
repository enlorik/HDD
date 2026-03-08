# HDD

A React + Vite application for a dynamic timeline calendar dashboard and bounty challenge tracking platform. Key integrations include Codeforces and Timus Online Judge.

## Features

### 1. Codeforces Integrated Timeline Dashboard
- Weekly column layout with dark, calm UI.
- "Today" marker for current alignment.
- Real-time Codeforces API events categorized into CF, IOI, ICPC types.
  - View contest details with active links.

### 2. Advanced Bounty Board
- Timus Online Judge problem sync:
  - Auto-download unsolved problems by category, focused modes available.
- Displaying projects as cards.

## Timus Problem Tracking by Tag

Track your progress on Timus Online Judge problems, grouped by topic tag.

### Supported Tags

| Tag | URL |
|-----|-----|
| Data Structures Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=structure |
| Dynamic Programming Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=dynprog |
| Game Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=game |
| Geometry Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=geometry |
| Graph Theory Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=graphs |
| Hardest Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=hardest |
| Mathematical Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=math |
| Number Theory Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=numbers |
| Problems for Beginners | https://acm.timus.ru/problemset.aspx?space=1&tag=beginners |
| Problems on Palindromes | https://acm.timus.ru/problemset.aspx?space=1&tag=palindromes |
| String Algorithms Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=string |
| Tricky Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=tricky |
| Unusual Problems | https://acm.timus.ru/problemset.aspx?space=1&tag=unusual |

### Data Files

- **`data/problems.json`** – All tagged problems with metadata (ID, title, link, tags). Populated by `scripts/fetch_problems.py`.
- **`data/solved_problems.json`** – Solved problem IDs per user, keyed by Timus Judge ID. Updated by `scripts/update_solved.py`.

### Fetching Problems

Run the following command from the repository root to fetch all tagged problems and store them in `data/problems.json`:

```bash
python scripts/fetch_problems.py
```

This script scrapes each tag page on acm.timus.ru and merges results so that problems appearing under multiple tags retain all their tags.

### Tracking Solved Problems

To update your solved problems and view a progress summary, provide your **Timus Judge ID** (visible on your profile page at `https://acm.timus.ru/author.aspx?id=<your_id>`):

```bash
python scripts/update_solved.py <your_judge_id>
```

Example:

```bash
python scripts/update_solved.py 12345
```

Example output:

```
Tag                                Solved / Total
-------------------------------------------------
Data Structures Problems                5 /     50
Dynamic Programming Problems           10 /     30
Game Problems                           2 /     15
...
```

Solved problem IDs are saved to `data/solved_problems.json` under your judge ID for persistence across runs.

## Project-Structure highlights

Modules Scoped from
/ detailed implementation Runtimes logging Node Scripts+ CI 
Records.