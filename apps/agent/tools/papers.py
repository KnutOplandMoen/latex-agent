"""Research tools — search_papers (Semantic Scholar + OpenAlex), add_to_bibliography."""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from agents.types import AgentEvent, EditProposed
from db import get_file_by_path, list_files as db_list_files
from tools.registry import register_tool

logger = logging.getLogger(__name__)

SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1"
OPENALEX_API = "https://api.openalex.org"


async def _search_papers(
    input_data: dict[str, Any],
    project_id: str,
    user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    query = input_data.get("query", "")
    if not query:
        return "Error: 'query' is required", []

    max_results = min(input_data.get("max_results", 10), 20)
    year_min = input_data.get("year_min")

    results: list[dict[str, Any]] = []

    # Search Semantic Scholar
    try:
        ss_results = await _search_semantic_scholar(query, max_results, year_min)
        results.extend(ss_results)
    except Exception as exc:
        logger.warning("Semantic Scholar search failed: %s", exc)

    # Search OpenAlex as supplement
    try:
        oa_results = await _search_openalex(query, max_results, year_min)
        # Deduplicate by DOI
        existing_dois = {r.get("doi") for r in results if r.get("doi")}
        for r in oa_results:
            if r.get("doi") and r["doi"] not in existing_dois:
                results.append(r)
                existing_dois.add(r["doi"])
    except Exception as exc:
        logger.warning("OpenAlex search failed: %s", exc)

    if not results:
        return f"No papers found for '{query}'. Try broadening the search terms.", []

    # Sort by citation count (descending), take top N
    results.sort(key=lambda r: r.get("citation_count", 0), reverse=True)
    results = results[:max_results]

    # Format output
    parts = [f"Found {len(results)} papers:\n"]
    for i, paper in enumerate(results, 1):
        title = paper.get("title", "Untitled")
        authors = paper.get("authors", "Unknown")
        year = paper.get("year", "?")
        citations = paper.get("citation_count", 0)
        doi = paper.get("doi", "")
        abstract = paper.get("abstract", "")

        parts.append(f"{i}. {title}")
        parts.append(f"   Authors: {authors}")
        parts.append(f"   Year: {year} | Citations: {citations}")
        if doi:
            parts.append(f"   DOI: {doi}")
        if abstract:
            parts.append(f"   Abstract: {abstract[:300]}{'...' if len(abstract) > 300 else ''}")

        # Auto-generate BibTeX key and entry
        bibtex_key = _generate_bibtex_key(paper)
        bibtex = _generate_bibtex(paper, bibtex_key)
        parts.append(f"   BibTeX key: {bibtex_key}")
        parts.append(f"   BibTeX:\n{bibtex}")
        parts.append("")

    return "\n".join(parts), []


async def _search_semantic_scholar(
    query: str, limit: int, year_min: int | None
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "query": query,
        "limit": limit,
        "fields": "title,authors,year,citationCount,externalIds,abstract",
    }
    if year_min:
        params["year"] = f"{year_min}-"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{SEMANTIC_SCHOLAR_API}/paper/search", params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for paper in data.get("data", []):
        authors_list = paper.get("authors", [])
        author_names = ", ".join(a.get("name", "") for a in authors_list[:5])
        if len(authors_list) > 5:
            author_names += " et al."

        ext_ids = paper.get("externalIds", {}) or {}
        doi = ext_ids.get("DOI", "")

        results.append({
            "title": paper.get("title", ""),
            "authors": author_names,
            "authors_list": [a.get("name", "") for a in authors_list],
            "year": paper.get("year"),
            "citation_count": paper.get("citationCount", 0),
            "doi": doi,
            "abstract": paper.get("abstract", ""),
            "source": "semantic_scholar",
        })

    return results


async def _search_openalex(
    query: str, limit: int, year_min: int | None
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "search": query,
        "per_page": limit,
        "select": "title,authorships,publication_year,cited_by_count,doi,abstract_inverted_index",
    }
    if year_min:
        params["filter"] = f"from_publication_date:{year_min}-01-01"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{OPENALEX_API}/works", params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for work in data.get("results", []):
        authorships = work.get("authorships", [])
        author_names = ", ".join(
            a.get("author", {}).get("display_name", "")
            for a in authorships[:5]
        )
        if len(authorships) > 5:
            author_names += " et al."

        doi = (work.get("doi") or "").replace("https://doi.org/", "")

        # Reconstruct abstract from inverted index
        abstract = _reconstruct_abstract(work.get("abstract_inverted_index"))

        results.append({
            "title": work.get("title", ""),
            "authors": author_names,
            "authors_list": [
                a.get("author", {}).get("display_name", "") for a in authorships
            ],
            "year": work.get("publication_year"),
            "citation_count": work.get("cited_by_count", 0),
            "doi": doi,
            "abstract": abstract,
            "source": "openalex",
        })

    return results


def _reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str:
    """Reconstruct abstract text from OpenAlex's inverted index format."""
    if not inverted_index:
        return ""
    word_positions: list[tuple[int, str]] = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort()
    return " ".join(word for _, word in word_positions)


def _generate_bibtex_key(paper: dict[str, Any]) -> str:
    """Generate a BibTeX key like 'smith2024' from paper metadata."""
    authors = paper.get("authors_list", [])
    first_author = authors[0] if authors else "unknown"
    # Take last name
    last_name = first_author.split()[-1].lower() if first_author else "unknown"
    # Clean non-alpha chars
    last_name = "".join(c for c in last_name if c.isalpha())
    year = paper.get("year", "")
    return f"{last_name}{year}"


def _generate_bibtex(paper: dict[str, Any], key: str) -> str:
    """Generate a BibTeX entry from paper metadata."""
    title = paper.get("title", "")
    authors = paper.get("authors", "")
    year = paper.get("year", "")
    doi = paper.get("doi", "")

    lines = [f"    @article{{{key},"]
    lines.append(f"      title = {{{title}}},")
    lines.append(f"      author = {{{authors}}},")
    lines.append(f"      year = {{{year}}},")
    if doi:
        lines.append(f"      doi = {{{doi}}},")
    lines.append("    }")
    return "\n".join(lines)


def _extract_doi_from_bibtex(bibtex: str) -> str | None:
    m = re.search(r"doi\s*=\s*\{([^}]+)\}", bibtex, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _extract_bibtex_key(bibtex: str) -> str | None:
    m = re.search(r"@\w+\s*\{\s*([^,\s]+)\s*,", bibtex)
    return m.group(1).strip() if m else None


async def _add_to_bibliography(
    input_data: dict[str, Any],
    project_id: str,
    _user_id: str,
    working_copies: dict[str, str],
    _api_bearer_token: str | None,
) -> tuple[str, list[AgentEvent]]:
    """Append a BibTeX entry to a project .bib file (working copy + duplicate check)."""
    bibtex = (input_data.get("bibtex") or "").strip()
    if not bibtex:
        return "Error: 'bibtex' is required", []

    bib_path = (input_data.get("bib_file") or "").strip()
    if not bib_path:
        files = await db_list_files(project_id)
        bib_files = [f["path"] for f in files if f.get("type") == "bib"]
        if not bib_files:
            return (
                "No .bib file in the project. Create one with create_file (e.g. refs.bib) first.",
                [],
            )
        bib_path = bib_files[0]

    new_doi = _extract_doi_from_bibtex(bibtex)
    new_key = _extract_bibtex_key(bibtex)

    if bib_path in working_copies:
        content = working_copies[bib_path]
    else:
        row = await get_file_by_path(project_id, bib_path)
        if row is None:
            return f"No bibliography file at '{bib_path}'.", []
        content = row.get("content") or ""

    if new_doi and new_doi.lower() in content.lower():
        return f"Skipped: an entry with DOI {new_doi} already exists in {bib_path}.", []

    if new_key and re.search(rf"@\w+\s*\{{\s*{re.escape(new_key)}\s*,", content):
        return f"Skipped: BibTeX key '{new_key}' already exists in {bib_path}.", []

    sep = "" if content.endswith("\n") or not content else "\n"
    updated = content + sep + bibtex.strip() + "\n"
    working_copies[bib_path] = updated

    msg = f"Prepared append to '{bib_path}' (pending user acceptance in the editor)."
    return msg, [EditProposed(file=bib_path, search=content, replace=updated)]


register_tool(
    name="search_papers",
    description=(
        "Search for academic papers using Semantic Scholar and OpenAlex. "
        "Returns paper titles, authors, years, citation counts, abstracts, "
        "and auto-generated BibTeX entries. Use this to find references for citations."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query describing the topic, e.g. 'transformer attention mechanisms'",
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of results to return (default 10, max 20)",
            },
            "year_min": {
                "type": "integer",
                "description": "Only return papers from this year or later",
            },
        },
        "required": ["query"],
    },
    handler=_search_papers,
)

register_tool(
    name="add_to_bibliography",
    description=(
        "Append a complete BibTeX entry to a .bib file in the project. "
        "Checks for duplicate DOI or duplicate citation key. "
        "If bib_file is omitted, uses the first .bib file in the project."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "bibtex": {
                "type": "string",
                "description": "Full BibTeX entry including @article{...} ... }",
            },
            "bib_file": {
                "type": "string",
                "description": "Target .bib path (optional)",
            },
        },
        "required": ["bibtex"],
    },
    handler=_add_to_bibliography,
)
