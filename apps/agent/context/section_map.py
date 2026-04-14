"""Parse LaTeX document structure into a compact section map.

Extracts \\section/\\subsection hierarchy, \\label definitions,
\\cite keys, and environment info from .tex files.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class SectionNode:
    level: int  # 0=chapter, 1=section, 2=subsection, 3=subsubsection
    title: str
    label: str | None = None
    children: list[SectionNode] = field(default_factory=list)
    citations: list[str] = field(default_factory=list)
    environments: list[str] = field(default_factory=list)


SECTION_COMMANDS = {
    r"\chapter": 0,
    r"\section": 1,
    r"\subsection": 2,
    r"\subsubsection": 3,
}

SECTION_RE = re.compile(
    r"\\(chapter|section|subsection|subsubsection)\*?\{([^}]*)\}"
)
LABEL_RE = re.compile(r"\\label\{([^}]+)\}")
CITE_RE = re.compile(r"\\(?:cite|citep|citet|citeauthor|citeyear|autocite|textcite)\{([^}]+)\}")
ENV_RE = re.compile(r"\\begin\{(figure|table|equation|algorithm|align|lstlisting)\}")
INPUT_RE = re.compile(r"\\(?:input|include)\{([^}]+)\}")


def parse_section_map(files: list[dict[str, str | None]]) -> str:
    """Build a compact text representation of the document structure.

    Args:
        files: list of dicts with 'path' and 'content' keys.

    Returns:
        A string suitable for inclusion in the system prompt.
    """
    lines: list[str] = []

    for f in files:
        path = f.get("path", "")
        content = f.get("content") or ""
        if not path or not content:
            continue

        file_lines = _parse_file(path, content)
        if file_lines:
            lines.append(f"\n{path}:")
            lines.extend(file_lines)

    if not lines:
        return "(No document structure found)"

    return "Document structure:\n" + "\n".join(lines)


def _parse_file(path: str, content: str) -> list[str]:
    """Parse a single file and return indented structure lines."""
    lines: list[str] = []
    all_labels: list[str] = []
    all_cites: set[str] = set()
    all_envs: list[str] = []

    for line_text in content.splitlines():
        sec_match = SECTION_RE.search(line_text)
        if sec_match:
            cmd = sec_match.group(1)
            title = sec_match.group(2).strip()
            level = SECTION_COMMANDS.get(f"\\{cmd}", 1)
            indent = "  " * level
            label_match = LABEL_RE.search(content[content.index(line_text):content.index(line_text) + 200])
            label_str = ""
            if label_match:
                label_str = f" (\\label{{{label_match.group(1)}}})"
            prefix = {0: "Ch", 1: "§", 2: "§§", 3: "§§§"}.get(level, "§")
            lines.append(f"{indent}{prefix} {title}{label_str}")

        for cite_match in CITE_RE.finditer(line_text):
            keys = [k.strip() for k in cite_match.group(1).split(",")]
            all_cites.update(keys)

        for env_match in ENV_RE.finditer(line_text):
            all_envs.append(env_match.group(1))

        for label_match in LABEL_RE.finditer(line_text):
            if not SECTION_RE.search(line_text):
                all_labels.append(label_match.group(1))

    if all_labels:
        lines.append(f"  Labels: {', '.join(all_labels[:20])}")
    if all_cites:
        lines.append(f"  Citations: {', '.join(sorted(all_cites)[:20])}")
    if all_envs:
        from collections import Counter
        env_counts = Counter(all_envs)
        env_str = ", ".join(f"{k}×{v}" for k, v in env_counts.most_common(10))
        lines.append(f"  Environments: {env_str}")

    return lines
