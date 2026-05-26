"""Workspace packaging: zip with .tenxoignore support and requirements.txt check."""

import os
import re
import zipfile
from pathlib import Path


def load_ignore_patterns(directory: Path) -> list[str] | None:
    """Read .tenxoignore patterns, falling back to .gitignore."""
    for name in (".tenxoignore", ".gitignore"):
        path = directory / name
        if path.is_file():
            return _parse_ignore_file(path)
    return None


def _parse_ignore_file(path: Path) -> list[str]:
    patterns: list[str] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        patterns.append(line)
    return patterns


def _translate_pattern(pat: str) -> str:
    """Convert a gitignore-style pattern to a regex."""
    parts = []
    i = 0
    n = len(pat)
    while i < n:
        c = pat[i]
        if c == "*":
            if i + 1 < n and pat[i + 1] == "*":
                parts.append(".*")
                i += 2
                if i < n and pat[i] == "/":
                    i += 1
            else:
                parts.append("[^/]*")
            i += 1
        elif c == "?":
            parts.append("[^/]")
            i += 1
        elif c in ".+^${}()|\\[]":
            parts.append("\\" + c)
            i += 1
        else:
            parts.append(c)
            i += 1
    return "".join(parts)


def _pattern_matches(rel_path: str, pattern: str) -> bool:
    """Check if a relative path matches a single gitignore-style pattern.
    Returns True if the raw pattern (without negation prefix) matches.
    """
    is_dir_only = pattern.endswith("/")
    pattern = pattern.rstrip("/")
    check_path = rel_path.rstrip("/")

    if pattern.startswith("/"):
        pattern = pattern[1:]
        anchored = True
    else:
        anchored = False

    regex = _translate_pattern(pattern)
    if anchored:
        return bool(re.fullmatch(regex, check_path))

    if re.fullmatch(regex, check_path):
        return True

    if "/" in check_path or is_dir_only:
        base = check_path.rsplit("/", 1)[-1]
        if re.fullmatch(regex, base):
            return True

    if is_dir_only and check_path.startswith(pattern + "/"):
        return True

    return False


def _matches_any(rel_path: str, patterns: list[str]) -> bool:
    """Return True if rel_path is excluded (matches a non-negated pattern and
    no later negation pattern re-includes it)."""
    excluded = False
    for p in patterns:
        negate = p.startswith("!")
        raw = p[1:].strip() if negate else p
        if _pattern_matches(rel_path, raw):
            if negate:
                return False
            excluded = True
    return excluded


def check_requirements(directory: Path):
    """Warn if requirements.txt is missing from the workspace root."""
    if not (directory / "requirements.txt").is_file():
        print(
            "WARNING: requirements.txt not found at workspace root.\n"
            "Create one so the edge agent installs your Python dependencies.\n"
        )


def pack_workspace(
    directory: str | Path = ".",
    output: str | Path = "workspace.zip",
) -> Path:
    """Zip a workspace directory, respecting .tenxoignore patterns.

    Args:
        directory: Root directory to package.
        output: Destination zip path.

    Returns:
        Absolute path to the created zip file.
    """
    root = Path(directory).resolve()
    out = Path(output).resolve()

    if not root.is_dir():
        raise NotADirectoryError(f"Not a directory: {root}")

    patterns = load_ignore_patterns(root)

    check_requirements(root)

    if patterns:
        print(f"Ignoring files matching {len(patterns)} pattern(s)")
    else:
        print("No .tenxoignore or .gitignore found — including all files")

    try:
        out_resolved = out.resolve()
    except (OSError, ValueError):
        out_resolved = out

    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(root):
            for d in list(dirnames):
                rel = os.path.relpath(os.path.join(dirpath, d), root)
                if patterns and _matches_any(rel + "/", patterns):
                    dirnames.remove(d)

            for f in filenames:
                full = os.path.join(dirpath, f)
                rel = os.path.relpath(full, root)
                # Don't include the output zip itself
                try:
                    if out_resolved.samefile(full):
                        continue
                except (OSError, ValueError):
                    pass
                if patterns and _matches_any(rel, patterns):
                    continue
                zf.write(full, rel)

    print(f"Packaged {root.name} -> {out} ({out.stat().st_size / 1024:.1f} KB)")
    return out
