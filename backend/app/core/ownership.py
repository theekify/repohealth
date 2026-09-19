"""
Computes per-file, current-line ownership using `git blame` — reflects who
owns the code that actually exists right now, not historical churn.
"""

from __future__ import annotations

import subprocess
from collections import defaultdict
from dataclasses import dataclass


@dataclass
class FileOwnership:
    path: str
    total_lines: int
    lines_by_author: dict[str, int]  # author email -> line count

    @property
    def dominant_author(self) -> str:
        return max(self.lines_by_author, key=self.lines_by_author.get)

    @property
    def dominant_share(self) -> float:
        if self.total_lines == 0:
            return 0.0
        return self.lines_by_author[self.dominant_author] / self.total_lines

    @property
    def contributor_count(self) -> int:
        return len(self.lines_by_author)


def get_tracked_files(repo_path: str = ".") -> list[str]:
    """All files currently tracked by git (respects .gitignore)."""
    result = subprocess.run(
        ["git", "ls-files"], cwd=repo_path,
        capture_output=True, text=True, check=True,
    )
    return [f for f in result.stdout.splitlines() if f.strip()]


SKIP_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
                    ".lock", ".min.js", ".map"}
SKIP_FILENAMES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml"}


def _should_skip(path: str) -> bool:
    filename = path.rsplit("/", 1)[-1]
    return (any(path.endswith(ext) for ext in SKIP_EXTENSIONS)
            or filename in SKIP_FILENAMES)


def blame_file(repo_path: str, file_path: str) -> FileOwnership | None:
    """Run git blame on one file, return per-author line ownership."""
    try:
        result = subprocess.run(
            ["git", "blame", "--line-porcelain", file_path],
            cwd=repo_path, capture_output=True, text=True, check=True,
        )
    except subprocess.CalledProcessError:
        return None

    lines_by_author: dict[str, int] = defaultdict(int)
    total = 0
    for line in result.stdout.splitlines():
        if line.startswith("author-mail "):
            email = line.removeprefix("author-mail ").strip("<>")
            lines_by_author[email] += 1
            total += 1

    if total == 0:
        return None

    return FileOwnership(path=file_path, total_lines=total,
                          lines_by_author=dict(lines_by_author))


def analyze_repo_ownership(repo_path: str = ".") -> list[FileOwnership]:
    """Blame every tracked file in the repo."""
    files = get_tracked_files(repo_path)
    results = []
    for f in files:
        if _should_skip(f):
            continue
        ownership = blame_file(repo_path, f)
        if ownership is not None:
            results.append(ownership)
    return results


def compute_bus_factor(ownerships: list[FileOwnership]) -> tuple[int, list[str]]:
    """
    Greedy approximation: rank contributors by total lines owned repo-wide,
    find the minimum number who together own >50% of all lines.
    """
    lines_per_author: dict[str, int] = defaultdict(int)
    total_lines = 0
    for f in ownerships:
        for author, count in f.lines_by_author.items():
            lines_per_author[author] += count
        total_lines += f.total_lines

    if total_lines == 0:
        return 0, []

    ranked = sorted(lines_per_author.items(), key=lambda kv: -kv[1])

    covered = 0
    key_people: list[str] = []
    for author, count in ranked:
        covered += count
        key_people.append(author)
        if covered / total_lines > 0.5:
            break

    return len(key_people), key_people