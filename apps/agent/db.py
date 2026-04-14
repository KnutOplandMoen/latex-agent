"""Async Postgres connection pool and project/file queries."""

from __future__ import annotations

from typing import Any

import asyncpg

from config import DATABASE_URL

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def check_membership(project_id: str, user_id: str) -> str | None:
    """Return the user's role in the project, or None if not a member."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
        project_id,
        user_id,
    )
    return row["role"] if row else None


async def list_files(project_id: str) -> list[dict[str, Any]]:
    """Return all files for a project (path + type, no content)."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, path, type FROM files WHERE project_id = $1 ORDER BY path",
        project_id,
    )
    return [dict(r) for r in rows]


async def get_file_by_path(project_id: str, path: str) -> dict[str, Any] | None:
    """Return a single file by project + path, including content."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, path, type, content FROM files WHERE project_id = $1 AND path = $2",
        project_id,
        path,
    )
    return dict(row) if row else None


async def get_all_file_contents(project_id: str) -> list[dict[str, Any]]:
    """Return all files with content for a project (used for search)."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, path, type, content FROM files WHERE project_id = $1 ORDER BY path",
        project_id,
    )
    return [dict(r) for r in rows]


async def create_file(project_id: str, path: str, file_type: str, content: str) -> dict[str, Any]:
    """Insert a new file and return it."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO files (project_id, path, type, content)
           VALUES ($1, $2, $3, $4)
           RETURNING id, path, type""",
        project_id,
        path,
        file_type,
        content,
    )
    return dict(row) if row else {}


async def update_file_content(project_id: str, path: str, content: str) -> bool:
    """Update a file's content column. Returns True if a row was updated."""
    pool = await get_pool()
    result = await pool.execute(
        "UPDATE files SET content = $1, updated_at = now() WHERE project_id = $2 AND path = $3",
        content,
        project_id,
        path,
    )
    return result != "UPDATE 0"
